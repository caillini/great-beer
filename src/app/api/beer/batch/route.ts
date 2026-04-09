import {
  searchBeer,
  searchBrewery,
  findBeerAtBrewery,
} from "@/lib/scraper/untappd";
import type { BreweryInfo } from "@/lib/scraper/parser";
import type { Beer, BeerSearchResult, MenuBeerEntry } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

// Cache brewery lookups across beers in the same batch request
const breweryCache = new Map<string, BreweryInfo | null>();

async function getBreweryInfo(
  breweryName: string
): Promise<BreweryInfo | null> {
  const key = breweryName.toLowerCase();
  if (breweryCache.has(key)) return breweryCache.get(key) || null;
  const info = await searchBrewery(breweryName);
  breweryCache.set(key, info);
  return info;
}

async function searchWithFallback(entry: MenuBeerEntry): Promise<Beer | null> {
  const { brewery, beerName, style } = entry;
  const label = `${brewery} / ${beerName} / ${style}`;

  // Strategy 1: Search by BREWERY (producer) on Untappd
  // Find the brewery page, load their beer list, match beer
  if (brewery) {
    console.log(`[batch] Strategy 1 -- brewery lookup for "${brewery}"`);
    const breweryInfo = await getBreweryInfo(brewery);
    if (breweryInfo) {
      console.log(
        `[batch]   Found brewery: "${breweryInfo.name}" -> ${breweryInfo.beerListUrl}`
      );
      const beer = await findBeerAtBrewery(breweryInfo, beerName, style);
      if (beer) {
        console.log(
          `[batch]   -> MATCH: "${beer.name}" (${beer.rating}) [via brewery page]`
        );
        return beer;
      }
      console.log(`[batch]   -> beer "${beerName}" not found on brewery page`);
    } else {
      console.log(`[batch]   -> brewery "${brewery}" not found on Untappd`);
    }
  }

  // Strategy 2: Search "brewery + beerName + style" (most specific, type=beer)
  if (brewery && beerName && style) {
    const q2 = `${brewery} ${beerName} ${style}`;
    console.log(`[batch] Strategy 2 -- beer search: "${q2}" (prefer ${brewery})`);
    const r2 = await searchBeer(q2, brewery);
    if (r2) {
      console.log(
        `[batch]   -> MATCH: "${r2.name}" by "${r2.brewery}" (${r2.rating})`
      );
      return r2;
    }
  }

  // Strategy 3: Search "brewery + beerName" (type=beer), prefer brewery
  if (brewery && beerName) {
    const q3 = `${brewery} ${beerName}`;
    console.log(`[batch] Strategy 3 -- beer search: "${q3}" (prefer ${brewery})`);
    const r3 = await searchBeer(q3, brewery);
    if (r3) {
      console.log(
        `[batch]   -> MATCH: "${r3.name}" by "${r3.brewery}" (${r3.rating})`
      );
      return r3;
    }
  }

  // Strategy 4: Search "beerName + style" (type=beer), prefer brewery if known
  if (beerName && style) {
    const q4 = `${beerName} ${style}`;
    console.log(`[batch] Strategy 4 -- beer search: "${q4}"${brewery ? ` (prefer ${brewery})` : ""}`);
    const r4 = await searchBeer(q4, brewery || undefined);
    if (r4) {
      console.log(
        `[batch]   -> MATCH: "${r4.name}" by "${r4.brewery}" (${r4.rating})`
      );
      return r4;
    }
  }

  // Strategy 5: Search just beerName (type=beer), prefer brewery if known
  if (beerName) {
    console.log(`[batch] Strategy 5 -- beer search: "${beerName}"${brewery ? ` (prefer ${brewery})` : ""}`);
    const r5 = await searchBeer(beerName, brewery || undefined);
    if (r5) {
      console.log(
        `[batch]   -> MATCH: "${r5.name}" by "${r5.brewery}" (${r5.rating})`
      );
      return r5;
    }
  }

  console.log(`[batch]   -> NO MATCH for [${label}]`);
  return null;
}

export async function POST(request: NextRequest) {
  let body: { beers?: MenuBeerEntry[]; beerNames?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Support both new structured format and legacy string format
  let entries: MenuBeerEntry[];

  if (body.beers && Array.isArray(body.beers)) {
    entries = body.beers;
  } else if (body.beerNames && Array.isArray(body.beerNames)) {
    // Legacy: convert plain strings to entries
    entries = body.beerNames.map((name) => ({
      brewery: "",
      beerName: name,
      style: "",
    }));
  } else {
    return NextResponse.json(
      { error: "beers must be a non-empty array" },
      { status: 400 }
    );
  }

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "beers must be a non-empty array" },
      { status: 400 }
    );
  }

  if (entries.length > 30) {
    return NextResponse.json(
      { error: "Maximum 30 beers per request" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const entry of entries) {
        const displayName = [entry.brewery, entry.beerName, entry.style]
          .filter(Boolean)
          .join(" ");
        try {
          const beer = await searchWithFallback(entry);
          const result: BeerSearchResult = {
            query: displayName,
            match: beer,
            confidence: beer ? "exact" : "none",
          };
          controller.enqueue(
            encoder.encode(JSON.stringify(result) + "\n")
          );
        } catch {
          const result: BeerSearchResult = {
            query: displayName,
            match: null,
            confidence: "none",
          };
          controller.enqueue(
            encoder.encode(JSON.stringify(result) + "\n")
          );
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
    },
  });
}
