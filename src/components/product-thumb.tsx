import type { Locale } from "@/lib/i18n";

const GRADIENTS: Record<string, string> = {
  tirages: "from-sky-100 via-sky-200 to-sky-300",
  cadres: "from-amber-100 via-amber-200 to-amber-300",
  albums: "from-rose-100 via-rose-200 to-rose-300",
  objets: "from-violet-100 via-violet-200 to-violet-300",
  cartes: "from-emerald-100 via-emerald-200 to-emerald-300",
  affiches: "from-orange-100 via-orange-200 to-orange-300",
};

const ICONS: Record<string, string> = {
  tirages: "🖼️",
  cadres: "🪟",
  albums: "📔",
  objets: "☕",
  cartes: "💌",
  affiches: "📐",
};

export function ProductThumb({
  categorySlug,
  imageUrl,
  label,
  className = "",
}: {
  categorySlug: string;
  imageUrl?: string | null;
  label: string;
  locale?: Locale;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={label}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  const gradient = GRADIENTS[categorySlug] ?? "from-sand-100 via-sand-200 to-sand-300";
  const icon = ICONS[categorySlug] ?? "📷";

  return (
    <div
      role="img"
      aria-label={label}
      className={`grid h-full w-full place-items-center bg-gradient-to-br ${gradient} ${className}`}
    >
      <span className="text-4xl opacity-70" aria-hidden>
        {icon}
      </span>
    </div>
  );
}
