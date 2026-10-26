"use client";

import { BookOpen, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { TemplatePreview } from "@/components/editor/template-preview";
import { useLocale, useT } from "@/components/locale-provider";
import {
  TEMPLATES,
  THEMES,
  findTemplate,
  templatesForTheme,
  type Template,
} from "@/lib/editor/templates";
import { formatDimensions, formatMga } from "@/lib/format";
import {
  COVERS,
  ORIENTATIONS,
  PAPER_FORMATS,
  PHOTOBOOK_BASE_PRICE_MGA,
  PHOTOBOOK_EXTRA_PAGE_MGA,
  PHOTOBOOK_MAX_PAGES,
  PHOTOBOOK_MIN_PAGES,
  PHOTOBOOK_PAPER,
  PHOTOBOOK_SLUG,
  coverExtraMga,
  findPaper,
  normalizePageCount,
  photobookPriceBreakdown,
  photobookSku,
  selectionSize,
  type CoverId,
  type OrientationId,
  type PaperId,
} from "@/lib/photobook";

/** Format de photobook tel que fourni par le serveur (issu du catalogue). */
export type WizardVariant = {
  id: string;
  sku: string;
  label: string;
  priceMga: number;
  widthMm: number | null;
  heightMm: number | null;
};

type StartMode = "blank" | "template" | "theme";

const STEP_COUNT = 4;
const PAGE_PRESETS = [20, 30, 40, 60];

/** Mises en page pensées pour un livre : les autres modèles (mug, carte…) non. */
const PAGE_TEMPLATES: Template[] = TEMPLATES.filter((template) =>
  template.id.startsWith("pb-"),
);

export function CreateWizard({ variants }: { variants: WizardVariant[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [pageCount, setPageCount] = useState(PHOTOBOOK_MIN_PAGES);
  const [paper, setPaper] = useState<PaperId>(PHOTOBOOK_PAPER);
  const [orientation, setOrientation] = useState<OrientationId>("portrait");
  const [cover, setCover] = useState<CoverId>("rigide");
  const [mode, setMode] = useState<StartMode>("blank");
  const [themeId, setThemeId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const selection = { paper, orientation, cover };
  const selectedPaper = findPaper(paper);
  const isSquare = selectedPaper.isSquare;
  const sku = photobookSku(selection);
  const variant = useMemo(
    () => variants.find((item) => item.sku === sku) ?? null,
    [sku, variants],
  );

  const size = selectionSize(selection);
  const price = photobookPriceBreakdown(pageCount, coverExtraMga(selection));

  const selectedTemplate: Template | null = useMemo(
    () => (mode === "blank" || !templateId ? null : (findTemplate(templateId) ?? null)),
    [mode, templateId],
  );

  const templateName = (template: Template) =>
    locale === "mg" ? template.nameMg : template.nameFr;

  const departureLabel =
    mode === "blank"
      ? t("wizard.blank")
      : selectedTemplate
        ? templateName(selectedTemplate)
        : t("wizard.template");

  const canContinue = step < STEP_COUNT - 1 || mode === "blank" || Boolean(templateId);

  const startCreation = () => {
    if (!variant) return;

    const params = new URLSearchParams({
      product: PHOTOBOOK_SLUG,
      variant: variant.id,
      pages: String(pageCount),
    });
    if (selectedTemplate) params.set("template", selectedTemplate.id);

    router.push(`/editeur?${params.toString()}`);
  };

  const steps = [
    t("wizard.pages"),
    t("wizard.formatStep"),
    t("wizard.cover"),
    t("wizard.start"),
  ];

  return (
    <div className="container-page py-8 sm:py-10">
      <header className="max-w-3xl">
        <span className="badge-brand inline-flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" /> {locale === "mg" ? selectedPaper.nameMg : selectedPaper.nameFr}{" "}
          · {PHOTOBOOK_MIN_PAGES} pages minimum
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
          {t("wizard.title")}
        </h1>
        <p className="muted mt-2 leading-relaxed">{t("wizard.subtitle")}</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          {/* ------------------------------------------------------- Étapes */}
          <ol className="flex flex-wrap gap-2 text-xs font-semibold">
            {steps.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  aria-current={index === step}
                  className={
                    index === step
                      ? "rounded-full bg-brand-600 px-3 py-1.5 text-white shadow-sm shadow-brand-600/25"
                      : index < step
                        ? "rounded-full bg-brand-50 px-3 py-1.5 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-100 dark:ring-brand-800"
                        : "rounded-full bg-card px-3 py-1.5 text-ink-500 ring-1 ring-sand-300"
                  }
                >
                  {index + 1}. {label}
                </button>
              </li>
            ))}
          </ol>

          <p className="muted mt-3 text-xs">
            {t("wizard.step", { current: step + 1, total: STEP_COUNT })}
          </p>

          <section className="mt-5">
            {step === 0 ? (
              <div className="card p-5 sm:p-6">
                <p className="muted text-xs">{t("wizard.pagesHint")}</p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPageCount((value) => normalizePageCount(value - 1))}
                    disabled={pageCount <= PHOTOBOOK_MIN_PAGES}
                    className="grid h-12 w-12 place-items-center rounded-full border border-sand-300 bg-card text-ink-700 transition-colors hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={t("wizard.removePage")}
                  >
                    <Minus className="h-5 w-5" />
                  </button>

                  <div className="text-center">
                    <input
                      type="number"
                      min={PHOTOBOOK_MIN_PAGES}
                      max={PHOTOBOOK_MAX_PAGES}
                      value={pageCount}
                      onChange={(event) =>
                        setPageCount(normalizePageCount(Number(event.target.value)))
                      }
                      className="w-32 border-0 bg-transparent text-center text-5xl font-black tabular-nums tracking-tight text-brand-700 focus:outline-none dark:text-brand-300"
                      aria-label={t("wizard.pages")}
                    />
                    <span className="block text-xs font-semibold uppercase tracking-widest text-ink-500">
                      {t("wizard.pages")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPageCount((value) => normalizePageCount(value + 1))}
                    disabled={pageCount >= PHOTOBOOK_MAX_PAGES}
                    className="grid h-12 w-12 place-items-center rounded-full border border-sand-300 bg-card text-ink-700 transition-colors hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={t("wizard.addPage")}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                <input
                  type="range"
                  min={PHOTOBOOK_MIN_PAGES}
                  max={100}
                  step={1}
                  value={Math.min(pageCount, 100)}
                  onChange={(event) => setPageCount(normalizePageCount(Number(event.target.value)))}
                  className="mt-5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-sand-300 accent-brand-600"
                  aria-label={t("wizard.pages")}
                />

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {PAGE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPageCount(preset)}
                      className={
                        pageCount === preset
                          ? "rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
                          : "rounded-full border border-sand-300 bg-card px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-brand-300"
                      }
                    >
                      {preset} {t("editor.pagesShort")}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-2 rounded-xl bg-sand-100 p-4 text-sm sm:grid-cols-3">
                  <div>
                    <span className="muted block text-[11px]">{t("wizard.included")}</span>
                    <strong>{PHOTOBOOK_MIN_PAGES} {t("editor.pagesShort")}</strong>
                  </div>
                  <div>
                    <span className="muted block text-[11px]">{t("wizard.extraPages")}</span>
                    <strong>{price.extraPages} × {formatMga(PHOTOBOOK_EXTRA_PAGE_MGA)}</strong>
                  </div>
                  <div>
                    <span className="muted block text-[11px]">{t("wizard.price")}</span>
                    <strong className="text-brand-700 dark:text-brand-300">{formatMga(price.totalMga)}</strong>
                  </div>
                </div>

                <p className="muted mt-3 text-xs leading-relaxed">
                  {formatMga(PHOTOBOOK_BASE_PRICE_MGA)} pour {PHOTOBOOK_MIN_PAGES} pages, puis{" "}
                  {formatMga(PHOTOBOOK_EXTRA_PAGE_MGA)} par page supplémentaire.
                </p>

                {price.coverExtraMga > 0 ? (
                  <p className="muted mt-1 text-xs leading-relaxed">
                    {coverLabel(cover, locale)} : + {formatMga(price.coverExtraMga)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-6">
                <div>
                  <p className="muted text-xs">{t("wizard.paperHint")}</p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {PAPER_FORMATS.map((item) => {
                      const scale = 88 / Math.max(item.shortMm, item.longMm);
                      return (
                        <ChoiceCard
                          key={item.id}
                          active={item.id === paper}
                          onClick={() => {
                            setPaper(item.id);
                            // Un format carré n'a pas d'orientation à choisir.
                            if (item.isSquare) setOrientation("portrait");
                          }}
                          title={locale === "mg" ? item.nameMg : item.nameFr}
                          description={locale === "mg" ? item.labelMg : item.labelFr}
                          footer={`${(item.shortMm / 10).toLocaleString("fr-FR")} × ${(
                            item.longMm / 10
                          ).toLocaleString("fr-FR")} cm`}
                        >
                          <div
                            className="mx-auto rounded border border-sand-300 bg-white shadow-sm"
                            style={{
                              width: Math.round(item.shortMm * scale),
                              height: Math.round(item.longMm * scale),
                            }}
                          />
                        </ChoiceCard>
                      );
                    })}
                  </div>
                </div>

                {isSquare ? (
                  <p className="rounded-xl bg-sand-100 p-3 text-xs leading-relaxed text-ink-700">
                    {t("wizard.squareHint")}
                  </p>
                ) : (
                  <div>
                    <p className="muted text-xs">{t("wizard.orientationHint")}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {ORIENTATIONS.map((item) => {
                        const active = item.id === orientation;
                        return (
                          <ChoiceCard
                            key={item.id}
                            active={active}
                            onClick={() => setOrientation(item.id)}
                            title={locale === "mg" ? item.labelMg : item.labelFr}
                            footer={formatDimensions(size.widthMm, size.heightMm)}
                          >
                            <div
                              className="mx-auto rounded border border-sand-300 bg-white shadow-sm"
                              style={{
                                width: item.isPortrait ? 62 : 88,
                                height: item.isPortrait ? 88 : 62,
                              }}
                            />
                          </ChoiceCard>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {step === 2 ? (
              <ChoiceGrid hint={t("wizard.coverHint")}>
                {COVERS.map((item) => {
                  const active = item.id === cover;
                  return (
                    <ChoiceCard
                      key={item.id}
                      active={active}
                      onClick={() => setCover(item.id)}
                      title={locale === "mg" ? item.labelMg : item.labelFr}
                      description={locale === "mg" ? item.descriptionMg : item.descriptionFr}
                      footer={
                        item.extraPriceMga > 0
                          ? `+ ${formatMga(item.extraPriceMga)}`
                          : t("wizard.coverIncluded")
                      }
                    />
                  );
                })}
              </ChoiceGrid>
            ) : null}

            {step === 3 ? (
              <div>
                <p className="muted text-xs">{t("wizard.startHint")}</p>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <ModeCard
                    active={mode === "blank"}
                    onClick={() => {
                      setMode("blank");
                      setTemplateId(null);
                    }}
                    emoji="📄"
                    title={t("wizard.blank")}
                    description={t("wizard.blankHint")}
                  />
                  <ModeCard
                    active={mode === "template"}
                    onClick={() => {
                      setMode("template");
                      setTemplateId(null);
                    }}
                    emoji="🧩"
                    title={t("wizard.template")}
                    description={t("wizard.templateHint")}
                  />
                  <ModeCard
                    active={mode === "theme"}
                    onClick={() => {
                      setMode("theme");
                      setThemeId(null);
                      setTemplateId(null);
                    }}
                    emoji="🎨"
                    title={t("wizard.theme")}
                    description={t("wizard.themeHint")}
                  />
                </div>

                {mode === "template" ? (
                  <div className="mt-5">
                    <h2 className="text-sm font-bold">{t("wizard.chooseTemplate")}</h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {PAGE_TEMPLATES.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          name={templateName(template)}
                          description={templateDescription(template, locale)}
                          active={templateId === template.id}
                          onSelect={() => setTemplateId(template.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {mode === "theme" ? (
                  <div className="mt-5 space-y-5">
                    <div>
                      <h2 className="text-sm font-bold">{t("wizard.chooseTheme")}</h2>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {THEMES.map((theme) => {
                          const active = themeId === theme.id;
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => {
                                setThemeId(theme.id);
                                setTemplateId(null);
                              }}
                              className={
                                active
                                  ? "rounded-xl border-2 border-brand-600 bg-brand-50 p-4 text-left dark:bg-brand-900/30"
                                  : "rounded-xl border border-sand-300 bg-card p-4 text-left hover:border-brand-300"
                              }
                            >
                              <span className="text-2xl" aria-hidden>
                                {theme.emoji}
                              </span>
                              <span className="mt-2 block text-sm font-bold">
                                {locale === "mg" ? theme.nameMg : theme.nameFr}
                              </span>
                              <span className="muted mt-1 block text-xs">
                                {locale === "mg" ? theme.descriptionMg : theme.descriptionFr}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {themeId ? (
                      <div>
                        <h2 className="text-sm font-bold">{t("wizard.chooseTemplate")}</h2>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {templatesForTheme(themeId).map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              name={templateName(template)}
                              description={templateDescription(template, locale)}
                              active={templateId === template.id}
                              onSelect={() => setTemplateId(template.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {mode !== "blank" && !templateId ? (
                  <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {t("wizard.themeRequired")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* -------------------------------------------------- Navigation */}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-outline px-5 py-2.5"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
            >
              {t("wizard.back")}
            </button>

            {step < STEP_COUNT - 1 ? (
              <button
                type="button"
                className="btn-primary px-5 py-2.5"
                onClick={() => setStep((value) => Math.min(STEP_COUNT - 1, value + 1))}
              >
                {t("wizard.continue")}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary px-5 py-2.5"
                onClick={startCreation}
                disabled={!variant || !canContinue}
                title={variant ? undefined : t("editor.needProduct")}
              >
                <BookOpen className="h-4 w-4" /> {t("wizard.create")}
              </button>
            )}
          </div>

          {!variant ? (
            <p className="mt-3 text-xs font-semibold text-accent-700 dark:text-accent-300">
              Format indisponible : lancez <code>npm run db:seed</code> pour créer les formats de
              photobook.
            </p>
          ) : null}
        </div>

        {/* ------------------------------------------------------- Récapitulatif */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">
              {t("wizard.summary")}
            </h2>

            <dl className="mt-4 space-y-2 text-sm">
              <SummaryRow
                label={t("wizard.paper")}
                value={locale === "mg" ? selectedPaper.labelMg : selectedPaper.labelFr}
              />
              {isSquare ? null : (
                <SummaryRow
                  label={t("wizard.orientation")}
                  value={orientationLabel(orientation, locale)}
                />
              )}
              <SummaryRow label={t("wizard.cover")} value={coverLabel(cover, locale)} />
              <SummaryRow
                label={t("wizard.pages")}
                value={`${pageCount} ${t("editor.pagesShort")}`}
              />
              <SummaryRow label={t("wizard.departure")} value={departureLabel} />
            </dl>

            <p className="muted mt-3 text-xs">
              {formatDimensions(size.widthMm, size.heightMm)} ·{" "}
              {t("wizard.pagesLine", { pages: pageCount })}
            </p>

            <div className="mt-4 space-y-1.5 rounded-xl bg-sand-100 px-4 py-3 text-sm">
              <div className="flex justify-between text-ink-500">
                <span>{PHOTOBOOK_MIN_PAGES} {t("editor.pagesShort")}</span>
                <span>{formatMga(price.baseMga)}</span>
              </div>
              {price.extraPages > 0 ? (
                <div className="flex justify-between text-ink-500">
                  <span>+ {price.extraPages} × {formatMga(PHOTOBOOK_EXTRA_PAGE_MGA)}</span>
                  <span>{formatMga(price.extraMga)}</span>
                </div>
              ) : null}
              {price.coverExtraMga > 0 ? (
                <div className="flex justify-between text-ink-500">
                  <span className="truncate">{coverLabel(cover, locale)}</span>
                  <span>{formatMga(price.coverExtraMga)}</span>
                </div>
              ) : null}
              <div className="flex items-end justify-between border-t border-sand-200 pt-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {t("wizard.price")}
                </span>
                <span className="text-xl font-black text-brand-700 dark:text-brand-300">
                  {formatMga(price.totalMga)}
                </span>
              </div>
            </div>

            {selectedTemplate ? (
              <div className="mt-4 flex justify-center">
                <TemplatePreview document={selectedTemplate.build()} width={200} />
              </div>
            ) : null}

            <p className="muted mt-4 text-xs leading-relaxed">{t("wizard.needAccount")}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

function templateDescription(template: Template, locale: "fr" | "mg") {
  return locale === "mg" ? (template.descriptionMg ?? template.descriptionFr) : template.descriptionFr;
}

function orientationLabel(orientation: OrientationId, locale: "fr" | "mg") {
  const item = ORIENTATIONS.find((option) => option.id === orientation);
  if (!item) return "";
  return locale === "mg" ? item.labelMg : item.labelFr;
}

function coverLabel(cover: CoverId, locale: "fr" | "mg") {
  const item = COVERS.find((option) => option.id === cover);
  if (!item) return "";
  return locale === "mg" ? item.labelMg : item.labelFr;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

function ChoiceGrid({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="muted text-xs">{hint}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  description,
  footer,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  footer?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "rounded-xl border-2 border-brand-600 bg-brand-50 p-4 text-left dark:bg-brand-900/30"
          : "rounded-xl border border-sand-300 bg-card p-4 text-left hover:border-brand-300"
      }
    >
      {children ? <div className="mb-3 flex justify-center">{children}</div> : null}
      <span className="block text-sm font-bold">{title}</span>
      {description ? <span className="muted mt-1 block text-xs">{description}</span> : null}
      {footer ? (
        <span className="mt-2 block text-sm font-semibold text-brand-700 dark:text-brand-300">
          {footer}
        </span>
      ) : null}
    </button>
  );
}

function ModeCard({
  active,
  onClick,
  emoji,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "rounded-xl border-2 border-brand-600 bg-brand-50 p-4 text-left dark:bg-brand-900/30"
          : "rounded-xl border border-sand-300 bg-card p-4 text-left hover:border-brand-300"
      }
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="mt-2 block text-sm font-bold">{title}</span>
      <span className="muted mt-1 block text-xs">{description}</span>
    </button>
  );
}

function TemplateCard({
  template,
  name,
  description,
  active,
  onSelect,
}: {
  template: Template;
  name: string;
  description: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={
        active
          ? "rounded-xl border-2 border-brand-600 bg-brand-50 p-3 text-left dark:bg-brand-900/30"
          : "rounded-xl border border-sand-300 bg-card p-3 text-left hover:border-brand-300"
      }
    >
      <span className="flex justify-center">
        <TemplatePreview document={template.build()} width={150} />
      </span>
      <span className="mt-2 block text-xs font-bold">{name}</span>
      <span className="muted mt-1 block text-[11px] leading-snug">{description}</span>
    </button>
  );
}
