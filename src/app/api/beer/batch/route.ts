import { searchBeer } from "@/lib/scraper/untappd";
import type { Beer, BeerSearchResult, MenuBeerEntry } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

async function searchWithFallback(entry: MenuBeerEntry): Promise<Beer | null> {
  const { brewery, beerName, style } = entry;

  // Phase 1: Strict brewery matching — only accept results from the correct brewery
  if (brewery && beerName) {
    // Try: "Headlands Party Wave" with strict brewery match
    const q1 = `${brewery} ${beerName}`;
    console.log(`[batch] Try 1 (strict): "${q1}"`);
    const r1 = await searchBeer(q1, brewery);
    if (r1) {
      console.log(`[batch]   → found: "${r1.name}" by "${r1.brewery}" (${r1.rating})`);
      return r1;
    }

    // Try: "Headlands Brewing Party Wave" (append "Brewing" to help Untappd)
    const q2 = `${brewery} Brewing ${beerName}`;
    console.log(`[batch] Try 2 (strict): "${q2}"`);
    const r2 = await searchBeer(q2, brewery);
    if (r2) {
      console.log(`[batch]   → found: "${r2.name}" by "${r2.brewery}" (${r2.rating})`);
      return r2;
    }

    // Try with style added: "Headlands Party Wave Light Lager"
    if (style) {
      const q3 = `${brewery} ${beerName} ${style}`;
      console.log(`[batch] Try 3 (strict): "${q3}"`);
      const r3 = await searchBeer(q3, brewery);
      if (r3) {
        console.log(`[batch]   → found: "${r3.name}" by "${r3.brewery}" (${r3.rating})`);
        return r3;
      }
    }

    // Try just beer name but still require brewery match
    console.log(`[batch] Try 4 (strict): "${beerName}"`);
    const r4 = await searchBeer(beerName, brewery);
    if (r4) {
      console.log(`[batch]   → found: "${r4.name}" by "${r4.brewery}" (${r4.rating})`);
      return r4;
    }
  }

  // Phase 2: No brewery info — search without brewery constraint
  if (beerName) {
    const fallbackQuery = brewery ? `${brewery} ${beerName}` : beerName;
    console.log(`[batch] Try 5 (no brewery constraint): "${fallbackQuery}"`);
    const r5 = await searchBeer(fallbackQuery);
    if (r5) {
      console.log(`[batch]   → found: "${r5.name}" by "${r5.brewery}" (${r5.rating})`);
      return r5;
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
