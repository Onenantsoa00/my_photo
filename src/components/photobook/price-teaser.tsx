"use client";

import { Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useT } from "@/components/locale-provider";
import { formatMga } from "@/lib/format";
import {
  PHOTOBOOK_BASE_PRICE_MGA,
  PHOTOBOOK_EXTRA_PAGE_MGA,
  PHOTOBOOK_MAX_PAGES,
  PHOTOBOOK_MIN_PAGES,
  normalizePageCount,
  photobookPriceBreakdown,
} from "@/lib/photobook";

const PRESETS = [20, 30, 40, 60];

export function PriceTeaser() {
  const t = useT();
  const [pages, setPages] = useState(PHOTOBOOK_MIN_PAGES);
  const price = photobookPriceBreakdown(pages);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-brand-200/70 bg-gradient-to-br from-brand-50 via-card to-sand-50 p-5 shadow-xl shadow-brand-900/5 sm:p-7 dark:border-brand-800">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-700/20"
      />

      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-200">
          {t("editor.price")}
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-black tracking-tight text-ink-900 sm:text-4xl">
              {formatMga(price.totalMga)}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {pages} {t("editor.pagesShort")} · {formatMga(PHOTOBOOK_BASE_PRICE_MGA)} +{" "}
              {price.extraPages} × {formatMga(PHOTOBOOK_EXTRA_PAGE_MGA)}
            </p>
          </div>
          <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
            A4 · A5 · A6 · Carré
          </span>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPages((value) => normalizePageCount(value - 1))}
            disabled={pages <= PHOTOBOOK_MIN_PAGES}
            className="grid h-10 w-10 place-items-center rounded-full border border-sand-300 bg-card text-ink-700 hover:border-brand-400 hover:text-brand-700 disabled:opacity-40"
            aria-label={t("wizard.removePage")}
          >
            <Minus className="h-4 w-4" />
          </button>

          <input
            type="range"
            min={PHOTOBOOK_MIN_PAGES}
            max={100}
            step={1}
            value={Math.min(pages, 100)}
            onChange={(event) => setPages(normalizePageCount(Number(event.target.value)))}
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-sand-300 accent-brand-600"
            aria-label={t("wizard.pages")}
          />

          <button
            type="button"
            onClick={() => setPages((value) => normalizePageCount(value + 1))}
            disabled={pages >= PHOTOBOOK_MAX_PAGES}
            className="grid h-10 w-10 place-items-center rounded-full border border-sand-300 bg-card text-ink-700 hover:border-brand-400 hover:text-brand-700 disabled:opacity-40"
            aria-label={t("wizard.addPage")}
          >
            <Plus className="h-4 w-4" />
          </button>

          <span className="w-12 text-right text-lg font-black tabular-nums">{pages}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setPages(preset)}
              className={
                pages === preset
                  ? "rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold text-white"
                  : "rounded-full border border-sand-300 bg-card px-3 py-1 text-[11px] font-semibold text-ink-700 hover:border-brand-300"
              }
            >
              {preset}
            </button>
          ))}
        </div>

        <Link
          href="/creer"
          className="btn-primary mt-5 w-full py-3 text-sm"
        >
          {t("home.heroCta")}
        </Link>
      </div>
    </div>
  );
}
