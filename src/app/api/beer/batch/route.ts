import { searchBeer } from "@/lib/scraper/untappd";
import type { BeerSearchResult } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: { beerNames: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { beerNames } = body;
  if (!Array.isArray(beerNames) || beerNames.length === 0) {
    return NextResponse.json(
      { error: "beerNames must be a non-empty array" },
      { status: 400 }
    );
  }

  if (beerNames.length > 30) {
    return NextResponse.json(
      { error: "Maximum 30 beers per request" },
      { status: 400 }
    );
  }

  // Stream results as they come in
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const name of beerNames) {
        try {
          const beer = await searchBeer(name.trim());
          console.log(`[batch] "${name}" → ${beer ? `found: "${beer.name}" (${beer.rating})` : "NO MATCH"}`);
          const result: BeerSearchResult = {
            query: name,
            match: beer,
            confidence: beer
              ? beer.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(beer.name.toLowerCase())
                ? "exact"
                : "fuzzy"
              : "none",
          };
          controller.enqueue(
            encoder.encode(JSON.stringify(result) + "\n")
          );
        } catch {
          const result: BeerSearchResult = {
            query: name,
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
