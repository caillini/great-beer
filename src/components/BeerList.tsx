"use client";

import type { Beer } from "@/lib/types";
import BeerCard from "./BeerCard";

interface BeerListProps {
  beers: Beer[];
  loading?: boolean;
  emptyMessage?: string;
}

export default function BeerList({
  beers,
  loading = false,
  emptyMessage = "No beers found",
}: BeerListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 animate-pulse"
          >
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-zinc-700" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-zinc-700 rounded w-48" />
                <div className="h-4 bg-zinc-700 rounded w-32" />
                <div className="h-3 bg-zinc-700 rounded w-24" />
              </div>
              <div className="w-16 h-7 bg-zinc-700 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (beers.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <div className="text-4xl mb-3">🍺</div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const sorted = [...beers].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-zinc-400 px-1">
        <span>
          {sorted.length} beer{sorted.length !== 1 ? "s" : ""} found
        </span>
        <span>Sorted by highest rating</span>
      </div>
      {sorted.map((beer, i) => (
        <BeerCard key={`${beer.name}-${beer.brewery}`} beer={beer} rank={i + 1} />
      ))}
    </div>
  );
}
