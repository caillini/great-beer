"use client";

import type { Venue } from "@/lib/types";

interface VenueCardProps {
  venue: Venue;
  onSelect: (venue: Venue) => void;
}

export default function VenueCard({ venue, onSelect }: VenueCardProps) {
  return (
    <button
      onClick={() => onSelect(venue)}
      className="w-full text-left bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 hover:bg-zinc-800 hover:border-amber-500/30 transition-all group"
    >
      <div className="flex items-center gap-3">
        {venue.imageUrl ? (
          <img
            src={venue.imageUrl}
            alt={venue.name}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-zinc-700 flex items-center justify-center flex-shrink-0 text-xl">
            🍻
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
            {venue.name}
          </h3>
          {venue.location && (
            <p className="text-sm text-zinc-400 truncate">{venue.location}</p>
          )}
        </div>
        <svg
          className="w-5 h-5 text-zinc-600 group-hover:text-amber-400 transition-colors flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </button>
  );
}
