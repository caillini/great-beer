import * as cheerio from "cheerio";
import type { Beer, Venue } from "../types";

export interface BreweryInfo {
  id: string;
  name: string;
  slug: string;
  beerListUrl: string;
}

/**
 * Parse brewery search results from Untappd search page (?type=brewery)
 * HTML structure: links containing /w/{slug}/{id} and /brewery/{id}
 */
export function parseBrewerySearchResults(html: string): BreweryInfo[] {
  const $ = cheerio.load(html);
  const breweries: BreweryInfo[] = [];

  // Find all beer list links that match /w/{slug}/{id}/beer
  const beerListLinks = $('a[href*="/w/"][href*="/beer"]');
  beerListLinks.each((_i, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/\/w\/([^/]+)\/(\d+)\/beer/);
    if (!match) return;

    const slug = match[1];
    const id = match[2];

    // Find brewery name: look for nearby links to the brewery page
    const parent = $(el).parent();
    // Go up to find the result item container
    const container = parent.closest("div").length ? parent.closest("div") : parent;

    // Look for the brewery name link (usually links to /{VanityUrl} or /brewery/{id})
    let name = "";
    container.find("a").each((_j, link) => {
      const linkHref = $(link).attr("href") || "";
      const linkText = $(link).text().trim();
      // Brewery name links go to /{vanity} or /brewery/{id} (not /w/ links)
      if (
        linkText &&
        !linkHref.includes("/w/") &&
        !linkHref.includes("/beer") &&
        linkText !== "Follow" &&
        !linkText.match(/^\d+ Beer/) &&
        !linkText.match(/^\d+ Rating/) &&
        linkText.length > 1
      ) {
        if (!name) name = linkText;
      }
    });

    if (!name) {
      // Fallback: derive name from slug
      name = slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Avoid duplicates
    if (!breweries.find((b) => b.id === id)) {
      breweries.push({
        id,
        name,
        slug,
        beerListUrl: `https://untappd.com/w/${slug}/${id}/beer`,
      });
    }
  });

  // Fallback: also try /w/{slug}/{id} links (without /beer)
  if (breweries.length === 0) {
    $('a[href*="/w/"]').each((_i, el) => {
      const href = $(el).attr("href") || "";
      const match = href.match(/\/w\/([^/]+)\/(\d+)$/);
      if (!match) return;

      const slug = match[1];
      const id = match[2];
      const name =
        $(el).text().trim() ||
        slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      if (!breweries.find((b) => b.id === id)) {
        breweries.push({
          id,
          name,
          slug,
          beerListUrl: `https://untappd.com/w/${slug}/${id}/beer`,
        });
      }
    });
  }

  return breweries;
}

/**
 * Parse a brewery's beer list page (/w/{slug}/{id}/beer)
 * Uses #beer-container .beer-item structure
 */
export function parseBreweryBeers(html: string): Beer[] {
  const $ = cheerio.load(html);
  const beers: Beer[] = [];

  // Primary: #beer-container .beer-item
  $("#beer-container .beer-item, .beer-list .beer-item, .beer-item").each(
    (_i, el) => {
      const $el = $(el);
      const nameEl = $el.find("a[href*='/b/'], .beer-name a, .name a, h5 a, h6 a").first();
      const name = nameEl.text().trim();
      if (!name) return;

      const href = nameEl.attr("href") || "";
      const brewery = $el.find(".brewery a, .brewery").first().text().trim();
      const style = $el.find(".style, .beer-style, p.style").first().text().trim();

      const fullText = $el.text();
      const abvMatch = fullText.match(/([\d.]+)%\s*ABV/i) || fullText.match(/([\d.]+)%/);
      const ibuMatch = fullText.match(/([\d.]+)\s*IBU/i);

      const ratingEl = $el.find(".caps, .num, [data-rating]").first();
      const ratingText =
        ratingEl.attr("data-rating") || ratingEl.text().trim();
      const rating = ratingText ? parseFloat(ratingText) : null;

      const ratingCountEl = $el.find(".raters, .ratings, .count").first();
      const ratingCountText = ratingCountEl.text().replace(/[^0-9]/g, "");
      const ratingCount = ratingCountText ? parseInt(ratingCountText) : null;

      const description = $el
        .find(".beer-desc, .desc, p.desc")
        .first()
        .text()
        .trim();
      const imageUrl =
        $el.find("img.lazy, img").first().attr("data-original") ||
        $el.find("img").first().attr("src") ||
        null;

      beers.push({
        name,
        brewery,
        style,
        abv: abvMatch ? parseFloat(abvMatch[1]) : null,
        ibu: ibuMatch ? parseFloat(ibuMatch[1]) : null,
        rating: rating && !isNaN(rating) ? rating : null,
        ratingCount,
        description,
        imageUrl,
        untappdUrl: href ? `https://untappd.com${href}` : null,
      });
    }
  );

  return beers;
}

export function parseVenueSearchResults(html: string): Venue[] {
  const $ = cheerio.load(html);
  const venues: Venue[] = [];

  $(".results-container .venue-item, .results-container .beer-item").each(
    (_i, el) => {
      const $el = $(el);
      const linkEl = $el.find("a.track-click, a[href*='/v/']").first();
      const href = linkEl.attr("href") || "";

      // Extract slug and id from URL like /v/slug/12345
      const match = href.match(/\/v\/([^/]+)\/(\d+)/);
      if (!match) return;

      const name =
        $el.find(".venue-name, .name h5, .name a").first().text().trim() || "";
      const location =
        $el.find(".venue-location, .location").first().text().trim() || "";
      const img = $el.find("img").first().attr("src") || null;

      if (name) {
        venues.push({
          id: match[2],
          name,
          slug: match[1],
          location,
          imageUrl: img,
          untappdUrl: `https://untappd.com${href}`,
        });
      }
    }
  );

  return venues;
}

export function parseBeerSearchResults(html: string): Beer[] {
  const $ = cheerio.load(html);
  const beers: Beer[] = [];

  $(".results-container .beer-item").each((_i, el) => {
    const $el = $(el);
    const nameEl = $el.find(".beer-name, .name a, h5 a").first();
    const name = nameEl.text().trim();
    const href = nameEl.attr("href") || $el.find("a").first().attr("href") || "";
    const brewery = $el.find(".brewery a, .brewery").first().text().trim();
    const style = $el.find(".style, .beer-style").first().text().trim();

    const details = $el.find(".details, .beer-details").first().text();
    const abvMatch = details.match(/([\d.]+)%\s*ABV/i);
    const ibuMatch = details.match(/([\d.]+)\s*IBU/i);

    const ratingEl = $el.find(".caps, .rating .num, .num").first();
    const ratingText = ratingEl.attr("data-rating") || ratingEl.text().trim();
    const rating = ratingText ? parseFloat(ratingText) : null;

    const ratingCountEl = $el.find(".raters, .ratings").first();
    const ratingCountText = ratingCountEl.text().replace(/[^0-9]/g, "");
    const ratingCount = ratingCountText ? parseInt(ratingCountText) : null;

    const description = $el.find(".beer-desc, .desc, p.desc").first().text().trim();
    const imageUrl = $el.find("img.lazy, img").first().attr("data-original") ||
      $el.find("img").first().attr("src") || null;

    if (name) {
      beers.push({
        name,
        brewery,
        style,
        abv: abvMatch ? parseFloat(abvMatch[1]) : null,
        ibu: ibuMatch ? parseFloat(ibuMatch[1]) : null,
        rating: rating && !isNaN(rating) ? rating : null,
        ratingCount,
        description,
        imageUrl,
        untappdUrl: href ? `https://untappd.com${href}` : null,
      });
    }
  });

  return beers;
}

export function parseVenueBeers(html: string): Beer[] {
  const $ = cheerio.load(html);
  const beersMap = new Map<string, Beer>();

  // Parse from menu/tap list section if available
  $(".menu-section .beer-item, .tap-list .beer-item, .menu-item").each(
    (_i, el) => {
      const $el = $(el);
      const name = $el.find(".beer-name, .name a, h5 a, h6 a").first().text().trim();
      if (!name || beersMap.has(name)) return;

      const brewery = $el.find(".brewery a, .brewery").first().text().trim();
      const style = $el.find(".style, .beer-style").first().text().trim();

      const details = $el.text();
      const abvMatch = details.match(/([\d.]+)%/);
      const ratingEl = $el.find(".caps, .num").first();
      const ratingText = ratingEl.attr("data-rating") || ratingEl.text().trim();
      const rating = ratingText ? parseFloat(ratingText) : null;

      beersMap.set(name, {
        name,
        brewery,
        style,
        abv: abvMatch ? parseFloat(abvMatch[1]) : null,
        ibu: null,
        rating: rating && !isNaN(rating) ? rating : null,
        ratingCount: null,
        description: "",
        imageUrl: $el.find("img").first().attr("src") || null,
        untappdUrl: null,
      });
    }
  );

  // Also parse from recent check-ins as a fallback
  $(
    ".checkin .beer-name, .recent-checkin .beer-name, .item .beer-name, #main-stream .item"
  ).each((_i, el) => {
    const $el = $(el);
    const beerLink = $el.is("a") ? $el : $el.find("a").first();
    const name = beerLink.text().trim();
    if (!name || beersMap.has(name)) return;

    const parent = $el.closest(".item, .checkin");
    const brewery = parent.find(".brewery a, .brewery").first().text().trim();
    const style = parent.find(".style, .beer-style").first().text().trim();
    const ratingEl = parent.find(".caps, .num").first();
    const ratingText = ratingEl.attr("data-rating") || ratingEl.text().trim();
    const rating = ratingText ? parseFloat(ratingText) : null;

    beersMap.set(name, {
      name,
      brewery,
      style,
      abv: null,
      ibu: null,
      rating: rating && !isNaN(rating) ? rating : null,
      ratingCount: null,
      description: "",
      imageUrl: null,
      untappdUrl: null,
    });
  });

  return Array.from(beersMap.values());
}
