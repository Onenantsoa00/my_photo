"use client";

import { MoveHorizontal, MoveVertical, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

import { useT } from "@/components/locale-provider";
import {
  BACKGROUND_PATTERNS,
  GRADIENT_ANGLES,
  PATTERN_SIZES,
  backgroundBaseColor,
  backgroundToCss,
  type BackgroundPatternId,
  type PageBackground,
} from "@/lib/editor/background";

const SOLID_SWATCHES = ["#ffffff", "#f8fafc", "#0f172a", "#0f766e", "#e2372f"];

type TabId = "solid" | "gradient" | "pattern";

const TABS: { id: TabId; key: "editor.bgSolid" | "editor.bgGradient" | "editor.bgPattern" }[] = [
  { id: "solid", key: "editor.bgSolid" },
  { id: "gradient", key: "editor.bgGradient" },
  { id: "pattern", key: "editor.bgPattern" },
];

/**
 * Sélecteur de fond de page : uni, dégradé personnalisable ou motif répété.
 * Utilisé à la fois dans la barre latérale de l'atelier et dans le panneau
 * mobile des réglages.
 */
export function BackgroundControls({
  background,
  onChange,
}: {
  background: PageBackground;
  onChange: (background: PageBackground) => void;
}) {
  const t = useT();
  const active: TabId = background.kind;

  const switchTab = (next: TabId) => {
    if (next === active) return;
    const base = backgroundBaseColor(background);

    if (next === "solid") {
      onChange({ kind: "solid", color: base });
      return;
    }

    if (next === "gradient") {
      onChange(
        background.kind === "gradient"
          ? background
          : {
              kind: "gradient",
              from: base,
              to: base.toLowerCase() === "#ffffff" ? "#dbeafe" : "#ffffff",
              angle: 135,
            },
      );
      return;
    }

    onChange(
      background.kind === "pattern"
        ? background
        : {
            kind: "pattern",
            pattern: "dots",
            color: "#94a3b8",
            surface: base,
            size: 64,
          },
    );
  };

  const pickPattern = (pattern: BackgroundPatternId) => {
    const current = background.kind === "pattern" ? background : null;
    onChange({
      kind: "pattern",
      pattern,
      color: current?.color ?? "#94a3b8",
      surface: current?.surface ?? backgroundBaseColor(background),
      size: current?.size ?? 64,
    });
  };

  return (
    <div>
      <label className="label text-[11px]">{t("editor.tool.background")}</label>

      <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-sand-100 p-1 dark:bg-sand-200/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active === tab.id}
            onClick={() => switchTab(tab.id)}
            className={
              active === tab.id
                ? "rounded-md bg-card px-2 py-1.5 text-[11px] font-bold text-ink-900 shadow-sm"
                : "rounded-md px-2 py-1.5 text-[11px] font-semibold text-ink-500 transition-colors hover:text-ink-800"
            }
          >
            {t(tab.key)}
          </button>
        ))}
      </div>

      {background.kind === "solid" ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={background.color}
            onChange={(event) => onChange({ kind: "solid", color: event.target.value })}
            className="h-8 w-10 cursor-pointer rounded border border-sand-300 bg-card p-0.5"
            aria-label={t("editor.bgSolid")}
          />
          <div className="flex flex-wrap gap-1">
            {SOLID_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => onChange({ kind: "solid", color })}
                className="h-6 w-6 rounded-full border border-sand-300"
                style={{ background: color }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {background.kind === "gradient" ? (
        <div className="mt-2 space-y-2">
          <div
            className="h-10 rounded-lg ring-1 ring-sand-300"
            style={{ background: backgroundToCss(background) }}
            aria-hidden
          />

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500">
              {t("editor.bgFrom")}
              <input
                type="color"
                value={background.from}
                onChange={(event) =>
                  onChange({ ...background, from: event.target.value })
                }
                className="h-7 w-8 cursor-pointer rounded border border-sand-300 bg-card p-0.5"
                aria-label={t("editor.bgFrom")}
              />
            </label>

            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500">
              {t("editor.bgTo")}
              <input
                type="color"
                value={background.to}
                onChange={(event) => onChange({ ...background, to: event.target.value })}
                className="h-7 w-8 cursor-pointer rounded border border-sand-300 bg-card p-0.5"
                aria-label={t("editor.bgTo")}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {GRADIENT_ANGLES.map((option) => (
              <button
                key={option.angle}
                type="button"
                title={t(option.key)}
                aria-label={t(option.key)}
                aria-pressed={background.angle === option.angle}
                onClick={() => onChange({ ...background, angle: option.angle })}
                className={
                  background.angle === option.angle
                    ? "grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white"
                    : "grid h-8 w-8 place-items-center rounded-lg border border-sand-300 bg-card text-sm text-ink-700 hover:border-brand-400"
                }
              >
                {option.arrow}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {background.kind === "pattern" ? (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-5 gap-1.5">
            {BACKGROUND_PATTERNS.map((option) => {
              const preview: PageBackground = { ...background, pattern: option.id };
              return (
                <button
                  key={option.id}
                  type="button"
                  title={t(option.key)}
                  aria-label={t(option.key)}
                  aria-pressed={background.pattern === option.id}
                  onClick={() => pickPattern(option.id)}
                  className={`h-9 rounded-lg ring-1 transition ${
                    background.pattern === option.id
                      ? "ring-2 ring-brand-600"
                      : "ring-sand-300 hover:ring-brand-400"
                  }`}
                  style={{ background: backgroundToCss(preview, 0.45) }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500">
              {t("editor.bgMotif")}
              <input
                type="color"
                value={background.color}
                onChange={(event) =>
                  onChange({ ...background, color: event.target.value })
                }
                className="h-7 w-8 cursor-pointer rounded border border-sand-300 bg-card p-0.5"
                aria-label={t("editor.bgMotif")}
              />
            </label>

            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500">
              {t("editor.bgSurface")}
              <input
                type="color"
                value={background.surface}
                onChange={(event) =>
                  onChange({ ...background, surface: event.target.value })
                }
                className="h-7 w-8 cursor-pointer rounded border border-sand-300 bg-card p-0.5"
                aria-label={t("editor.bgSurface")}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PATTERN_SIZES.map((option) => (
              <button
                key={option.size}
                type="button"
                aria-pressed={background.size === option.size}
                onClick={() => onChange({ ...background, size: option.size })}
                className={
                  background.size === option.size
                    ? "rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white"
                    : "rounded-full border border-sand-300 bg-card px-2.5 py-1 text-[11px] font-semibold text-ink-700 hover:border-brand-400"
                }
              >
                {t(option.key)}
              </button>
            ))}
          </div>

          {/* Agrandir / réduire / ajuster le motif choisi. */}
          <div className="rounded-xl bg-sand-100 p-2 dark:bg-sand-200/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-ink-600">
                {t("editor.bgSize")}
              </span>
              <span className="tabular-nums text-[11px] font-bold text-ink-800">
                {Math.round(background.size)} px
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                title={t("editor.bgShrink")}
                aria-label={t("editor.bgShrink")}
                onClick={() =>
                  onChange({
                    ...background,
                    size: Math.max(16, background.size - 8),
                  })
                }
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-sand-300 bg-card text-ink-700 hover:border-brand-400"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>

              <input
                type="range"
                min={16}
                max={256}
                step={4}
                value={background.size}
                aria-label={t("editor.bgSize")}
                onChange={(event) =>
                  onChange({ ...background, size: Number(event.target.value) })
                }
                className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-sand-300 accent-brand-600"
              />

              <button
                type="button"
                title={t("editor.bgEnlarge")}
                aria-label={t("editor.bgEnlarge")}
                onClick={() =>
                  onChange({
                    ...background,
                    size: Math.min(256, background.size + 8),
                  })
                }
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-sand-300 bg-card text-ink-700 hover:border-brand-400"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-ink-600">
                  <MoveHorizontal className="h-3 w-3" /> {t("editor.bgOffsetX")}
                </span>
                <input
                  type="range"
                  min={-256}
                  max={256}
                  step={4}
                  value={background.offsetX ?? 0}
                  aria-label={t("editor.bgOffsetX")}
                  onChange={(event) =>
                    onChange({ ...background, offsetX: Number(event.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-sand-300 accent-brand-600"
                />
              </label>

              <label className="block">
                <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-ink-600">
                  <MoveVertical className="h-3 w-3" /> {t("editor.bgOffsetY")}
                </span>
                <input
                  type="range"
                  min={-256}
                  max={256}
                  step={4}
                  value={background.offsetY ?? 0}
                  aria-label={t("editor.bgOffsetY")}
                  onChange={(event) =>
                    onChange({ ...background, offsetY: Number(event.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-sand-300 accent-brand-600"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => onChange({ ...background, offsetX: 0, offsetY: 0 })}
              disabled={!background.offsetX && !background.offsetY}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sand-300 bg-card py-1.5 text-[11px] font-semibold text-ink-700 hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" /> {t("editor.bgRecenter")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
