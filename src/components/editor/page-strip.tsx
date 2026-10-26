"use client";

import { Copy, Plus, Trash2 } from "lucide-react";

import { useT } from "@/components/locale-provider";
import { backgroundToCss } from "@/lib/editor/background";
import type { EditorPage } from "@/lib/editor/types";

export function PageStrip({
  pages,
  canvas,
  minPages,
  pageIndex,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: {
  pages: EditorPage[];
  canvas: { width: number; height: number };
  minPages: number;
  pageIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const canDelete = pages.length > minPages;

  return (
    <div className="flex items-center gap-2 border-b border-sand-200 bg-card px-2 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 thin-scroll">
        {pages.map((page, index) => {
          const active = index === pageIndex;

          return (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-current={active ? "page" : undefined}
              title={`${t("editor.page")} ${index + 1} · ${page.layers.length} ${t("editor.layers").toLowerCase()}`}
              className={`group relative h-16 w-12 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                active
                  ? "border-brand-600 shadow-sm ring-2 ring-brand-500/20"
                  : "border-sand-300 opacity-80 hover:border-brand-300 hover:opacity-100"
              }`}
              style={{ background: backgroundToCss(page.background) }}
            >
              <span className="pointer-events-none absolute inset-1 overflow-hidden rounded-sm">
                {page.layers.slice(0, 4).map((layer) => (
                  <span
                    key={layer.id}
                    className="absolute rounded-[1px] bg-ink-900/25"
                    style={{
                      left: `${(layer.x / canvas.width) * 100}%`,
                      top: `${(layer.y / canvas.height) * 100}%`,
                      width: `${Math.max(8, (layer.width / canvas.width) * 100)}%`,
                      height: `${Math.max(8, (layer.height / canvas.height) * 100)}%`,
                      background:
                        layer.type === "text"
                          ? "rgba(15,23,42,.28)"
                          : layer.type === "image"
                            ? "rgba(59,130,246,.32)"
                            : "rgba(245,158,11,.35)",
                    }}
                  />
                ))}
              </span>
              <span
                className={`absolute bottom-0 inset-x-0 py-0.5 text-center text-[9px] font-bold ${
                  active
                    ? "bg-brand-600 text-white"
                    : "bg-card/85 text-ink-500 backdrop-blur-sm"
                }`}
              >
                {index === 0 ? t("editor.coverShort") : index + 1}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onAdd}
          title={t("editor.addPage")}
          className="grid h-16 w-12 shrink-0 place-items-center rounded-md border-2 border-dashed border-sand-300 text-ink-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30"
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">{t("editor.addPage")}</span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="hidden px-1 text-[11px] font-semibold tabular-nums text-ink-500 sm:block">
          {pages.length} {t("editor.pagesShort")}
        </span>
        <button
          type="button"
          onClick={onDuplicate}
          title={t("editor.duplicatePage")}
          className="grid h-8 w-8 place-items-center rounded-lg border border-sand-300 text-ink-500 hover:bg-sand-100 hover:text-ink-900"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? t("editor.deletePage") : t("editor.minPagesHint")}
          className="grid h-8 w-8 place-items-center rounded-lg border border-sand-300 text-ink-500 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
