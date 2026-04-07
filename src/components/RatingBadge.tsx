"use client";

interface RatingBadgeProps {
  rating: number | null;
  size?: "sm" | "md" | "lg";
}

function getRatingColor(rating: number): string {
  if (rating >= 4.25) return "bg-emerald-500";
  if (rating >= 3.75) return "bg-green-500";
  if (rating >= 3.25) return "bg-yellow-500";
  if (rating >= 2.75) return "bg-orange-500";
  return "bg-red-500";
}

function getStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    "\u2605".repeat(full) +
    (half ? "\u00BD" : "") +
    "\u2606".repeat(empty)
  );
}

export default function RatingBadge({ rating, size = "md" }: RatingBadgeProps) {
  if (rating === null) {
    return (
      <span className="text-zinc-500 text-sm italic">No rating</span>
    );
  }

  const sizeClasses = {
    sm: "text-sm px-2 py-0.5",
    md: "text-base px-3 py-1",
    lg: "text-lg px-4 py-1.5",
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`${getRatingColor(rating)} text-white font-bold rounded-lg ${sizeClasses[size]}`}
      >
        {rating.toFixed(2)}
      </span>
      <span className="text-amber-400 tracking-wider" aria-label={`${rating} out of 5 stars`}>
        {getStars(rating)}
      </span>
    </div>
  );
}
