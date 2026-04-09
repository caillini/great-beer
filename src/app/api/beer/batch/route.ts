import { searchBeer } from "@/lib/scraper/untappd";
import type { Beer, BeerSearchResult, MenuBeerEntry } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

async function searchWithFallback(entry: MenuBeerEntry): Promise<Beer | null> {
  const { brewery, beerName, style } = entry;

  // Strategy 1: Search with all three — brewery + beer name + style
  if (brewery && beerName && style) {
    const query1 = `${brewery} ${beerName} ${style}`;
    console.log(`[batch] Try 1: "${query1}"`);
    const result1 = await searchBeer(query1);
    if (result1) {
      console.log(`[batch]   → found: "${result1.name}" (${result1.rating})`);
      return result1;
    }
  }

  // Strategy 2: Search with beer name + brewery
  if (brewery && beerName) {
    const query2 = `${brewery} ${beerName}`;
    console.log(`[batch] Try 2: "${query2}"`);
    const result2 = await searchBeer(query2);
    if (result2) {
      console.log(`[batch]   → found: "${result2.name}" (${result2.rating})`);
      return result2;
    }
  }

  // Strategy 3: Search with beer name + style
  if (beerName && style) {
    const query3 = `${beerName} ${style}`;
    console.log(`[batch] Try 3: "${query3}"`);
    const result3 = await searchBeer(query3);
    if (result3) {
      console.log(`[batch]   → found: "${result3.name}" (${result3.rating})`);
      return result3;
    }
  }

  // Strategy 4: Search with just beer name (if we haven't tried it yet)
  if (beerName && (!brewery || !style)) {
    const query4 = brewery ? `${brewery} ${beerName}` : beerName;
    console.log(`[batch] Try 4: "${query4}"`);
    const result4 = await searchBeer(query4);
    if (result4) {
      console.log(`[batch]   → found: "${result4.name}" (${result4.rating})`);
      return result4;
    }
  }

  console.log(`[batch]   → NO MATCH for ${brewery} ${beerName} ${style}`);
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
