"use client";

import BeerList from "@/components/BeerList";
import { useBeerSearch } from "@/hooks/useBeerSearch";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function VenuePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const id = searchParams.get("id") || "";
  const name = searchParams.get("name") || slug;

  const { beers, loading, error, searchVenueBeers } = useBeerSearch();

  useEffect(() => {
    if (slug && id) {
      searchVenueBeers(id, slug);
    }
  }, [slug, id, searchVenueBeers]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="bg-gradient-to-b from-amber-950/30 to-zinc-950 border-b border-zinc-800/50">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm mb-4"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl font-bold text-white">{decodeURIComponent(name)}</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Based on recent check-ins and available tap list data
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <BeerList
          beers={beers}
          loading={loading}
          emptyMessage="No beers found for this venue. Try scanning the menu instead!"
        />
      </div>
    </main>
  );
}
