"use client";

import type { Beer, BeerSearchResult } from "@/lib/types";
import { useCallback, useState } from "react";

export function useBeerSearch() {
  const [beers, setBeers] = useState<Beer[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const searchBatch = useCallback(async (beerNames: string[]) => {
    setLoading(true);
    setError(null);
    setBeers([]);
    setProgress({ done: 0, total: beerNames.length });

    try {
      const res = await fetch("/api/beer/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beerNames }),
      });

      if (!res.ok) throw new Error("Batch search failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let doneCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const result: BeerSearchResult = JSON.parse(line);
            if (result.match) {
              setBeers((prev) =>
                [...prev, result.match!].sort(
                  (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
                )
              );
            }
            doneCount++;
            setProgress({ done: doneCount, total: beerNames.length });
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch {
      setError("Failed to look up beers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const searchVenueBeers = useCallback(
    async (venueId: string, slug: string) => {
      setLoading(true);
      setError(null);
      setBeers([]);

      try {
        const res = await fetch(
          `/api/venue/${venueId}/beers?slug=${encodeURIComponent(slug)}`
        );
        if (!res.ok) throw new Error("Failed to fetch venue beers");
        const data = await res.json();
        setBeers(data.beers || []);
      } catch {
        setError("Failed to load beers for this venue. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { beers, loading, progress, error, searchBatch, searchVenueBeers };
}
