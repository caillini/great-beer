"use client";

import type { Venue } from "@/lib/types";
import { useCallback, useState } from "react";

export function useVenueSearch() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/venue/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setVenues(data.venues || []);
    } catch {
      setError("Failed to search venues. Please try again.");
      setVenues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { venues, loading, error, search };
}
