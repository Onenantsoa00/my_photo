import { Star } from "lucide-react";

const SIZES = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
} as const;

/** Cinq étoiles remplies à hauteur de la note (arrondie). */
export function Stars({
  value,
  size = "md",
  className = "",
}: {
  value: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const rounded = Math.round(Math.min(5, Math.max(0, value)));
  const icon = SIZES[size];

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-amber-500 ${className}`}
      aria-label={`${value.toFixed(1)} / 5`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={icon}
          fill={star <= rounded ? "currentColor" : "none"}
          strokeWidth={star <= rounded ? 0 : 1.8}
        />
      ))}
    </span>
  );
}
