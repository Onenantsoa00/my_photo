import { locales, localeLabels, type Locale } from "@/lib/i18n";
import { setLocaleAction } from "@/server/actions/locale";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  return (
    <form action={setLocaleAction} className="flex items-center gap-1">
      <span className="sr-only" id="locale-switcher-label">
        Langue / Fiteny
      </span>
      <div
        aria-labelledby="locale-switcher-label"
        className="flex rounded-lg border border-sand-300 bg-white p-0.5"
        role="group"
      >
        {locales.map((option) => (
          <button
            key={option}
            type="submit"
            name="locale"
            value={option}
            aria-pressed={option === locale}
            title={localeLabels[option]}
            className={
              option === locale
                ? "rounded-md bg-brand-600 px-2 py-1 text-xs font-bold text-white"
                : "rounded-md px-2 py-1 text-xs font-semibold text-ink-500 hover:bg-sand-100"
            }
          >
            {option.toUpperCase()}
          </button>
        ))}
      </div>
    </form>
  );
}
