import type { Beer, Venue } from "../types";
import { getCached, setCache } from "./cache";
import {
  parseBeerSearchResults,
  parseVenueBeers,
  parseVenueSearchResults,
} from "./parser";
import { throttle } from "./rate-limiter";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchPage(url: string): Promise<string> {
  await throttle();

  const response = await fetch(url, {
    headers: {
      "User-Agent": getRandomUA(),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    console.error(`[untappd] HTTP ${response.status} for ${url}`);
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  console.log(`[untappd] Fetched ${url} (${html.length} bytes)`);
  return html;
}

export async function searchVenues(query: string): Promise<Venue[]> {
  const cacheKey = `venue-search:${query.toLowerCase()}`;
  const cached = getCached<Venue[]>(cacheKey);
  if (cached) return cached;

  try {
    const html = await fetchPage(
      `https://untappd.com/search?q=${encodeURIComponent(query)}&type=venue`
    );
    const venues = parseVenueSearchResults(html);
    setCache(cacheKey, venues, 60 * 60 * 1000); // 1 hour
    return venues;
  } catch (error) {
    console.error("Venue search failed:", error);
    return [];
  }
}

export async function getVenueBeers(
  slug: string,
  id: string
): Promise<Beer[]> {
  const cacheKey = `venue-beers:${slug}:${id}`;
  const cached = getCached<Beer[]>(cacheKey);
  if (cached) return cached;

  try {
    const html = await fetchPage(`https://untappd.com/v/${slug}/${id}`);
    const beers = parseVenueBeers(html);

    // Look up ratings for beers that don't have them
    const beersWithRatings = await enrichBeersWithRatings(beers);
    const sorted = beersWithRatings.sort(
      (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
    );

    setCache(cacheKey, sorted, 30 * 60 * 1000); // 30 minutes
    return sorted;
  } catch (error) {
    console.error("Venue beers fetch failed:", error);
    return [];
  }
}

/**
 * Search Untappd for a beer.
 * @param query - search query string
 * @param preferredBrewery - if set, ONLY return results from this brewery (strict mode)
 */
export async function searchBeer(
  query: string,
  preferredBrewery?: string
): Promise<Beer | null> {
  const cacheKey = `beer-search-v2:${query.toLowerCase()}:${(preferredBrewery || "").toLowerCase()}`;
  const cached = getCached<Beer | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const html = await fetchPage(
      `https://untappd.com/search?q=${encodeURIComponent(query)}&type=beer`
    );
    const beers = parseBeerSearchResults(html);

    console.log(
      `[search] Query "${query}" returned ${beers.length} results: ${beers
        .slice(0, 5)
        .map((b) => `"${b.name}" by "${b.brewery}"`)
        .join(", ")}`
    );

    const match = findBestMatch(query, beers, preferredBrewery);
    if (match) {
      setCache(cacheKey, match, 24 * 60 * 60 * 1000); // 24 hours
    }
    return match;
  } catch (error) {
    console.error(`Beer search failed for "${query}":`, error);
    return null;
  }
}

function breweryMatches(resultBrewery: string, targetBrewery: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(brewing|brewery|beer|brew|co\.?|company|craft|artisan)\b/gi, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  const a = normalize(resultBrewery);
  const b = normalize(targetBrewery);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function findBestMatch(
  query: string,
  beers: Beer[],
  preferredBrewery?: string
): Beer | null {
  if (beers.length === 0) return null;

  // If we have a preferred brewery, ONLY return results from that brewery
  if (preferredBrewery) {
    const breweryMatched = beers.filter((b) =>
      breweryMatches(b.brewery, preferredBrewery)
    );
    if (breweryMatched.length > 0) {
      console.log(
        `[match] Found ${breweryMatched.length} result(s) matching brewery "${preferredBrewery}"`
      );
      return findBestNameMatch(query, breweryMatched);
    }
    // No results from this brewery — return null, don't return wrong brewery
    console.log(
      `[match] No results matching brewery "${preferredBrewery}" — skipping`
    );
    return null;
  }

  // No brewery preference — pick best name match from all results
  return findBestNameMatch(query, beers);
}

function findBestNameMatch(query: string, beers: Beer[]): Beer | null {
  if (beers.length === 0) return null;

  const q = query.toLowerCase().trim();

  // Try exact name match first
  const exact = beers.find((b) => b.name.toLowerCase() === q);
  if (exact) return exact;

  // Try name contains query
  const contains = beers.find((b) => b.name.toLowerCase().includes(q));
  if (contains) return contains;

  // Try query contains beer name
  const reverse = beers.find((b) => q.includes(b.name.toLowerCase()));
  if (reverse) return reverse;

  // Return first result as best guess
  return beers[0];
}

async function enrichBeersWithRatings(beers: Beer[]): Promise<Beer[]> {
  const results: Beer[] = [];

  for (const beer of beers) {
    if (beer.rating !== null) {
      results.push(beer);
      continue;
    }

    const searched = await searchBeer(`${beer.name} ${beer.brewery}`);
    if (searched) {
      results.push({
        ...beer,
        rating: searched.rating,
        ratingCount: searched.ratingCount,
        style: beer.style || searched.style,
        abv: beer.abv ?? searched.abv,
        ibu: beer.ibu ?? searched.ibu,
        description: beer.description || searched.description,
        imageUrl: beer.imageUrl || searched.imageUrl,
        untappdUrl: beer.untappdUrl || searched.untappdUrl,
      });
    } else {
      results.push(beer);
    }
  }

  return results;
}
