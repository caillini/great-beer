"use client";

interface RatingBadgeProps {
  rating: number | null;
  size?: "sm" | "md" | "lg";
}

function getRatingColor(rating: number): string {
  if (rating >= 4.0) return "bg-green-500";
  if (rating >= 3.0) return "bg-yellow-500";
  return "bg-red-500";
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
    <span
      className={`${getRatingColor(rating)} text-white font-bold rounded-lg ${sizeClasses[size]}`}
    >
      {rating.toFixed(2)}
    </span>
  );
}
