"use client";

import type { Beer } from "@/lib/types";
import RatingBadge from "./RatingBadge";

interface BeerCardProps {
  beer: Beer;
  rank: number;
}

export default function BeerCard({ beer, rank }: BeerCardProps) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 hover:bg-zinc-800 transition-colors">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
          {rank}
        </div>

        {beer.imageUrl && (
          <img
            src={beer.imageUrl}
            alt={beer.name}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate">
                {beer.untappdUrl ? (
                  <a
                    href={beer.untappdUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-amber-400 transition-colors"
                  >
                    {beer.name}
                  </a>
                ) : (
                  beer.name
                )}
              </h3>
              {beer.brewery && (
                <p className="text-zinc-400 text-sm">{beer.brewery}</p>
              )}
            </div>
            <div className="flex-shrink-0">
              <RatingBadge rating={beer.rating} size="sm" />
            </div>
          </div>

          {beer.style && (
            <span className="inline-block mt-1 text-xs bg-zinc-700/50 text-zinc-300 px-2 py-0.5 rounded-full">
              {beer.style}
            </span>
          )}

          <div className="flex gap-3 mt-1.5 text-xs text-zinc-500">
            {beer.abv !== null && <span>{beer.abv}% ABV</span>}
            {beer.ibu !== null && <span>{beer.ibu} IBU</span>}
            {beer.ratingCount !== null && (
              <span>{beer.ratingCount.toLocaleString()} ratings</span>
            )}
          </div>

          {beer.description && (
            <p className="mt-2 text-sm text-zinc-400 line-clamp-2">
              {beer.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
