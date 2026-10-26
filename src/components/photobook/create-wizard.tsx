"use client";

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
  PHOTOBOOK_PAGES,
  PHOTOBOOK_SLUG,
  photobookSku,
  selectionPriceMga,
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

/** Mises en page pensées pour un livre : les autres modèles (mug, carte…) non. */
const PAGE_TEMPLATES: Template[] = TEMPLATES.filter((template) =>
  template.id.startsWith("pb-"),
);

export function CreateWizard({ variants }: { variants: WizardVariant[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [paper, setPaper] = useState<PaperId>("a4");
  const [orientation, setOrientation] = useState<OrientationId>("portrait");
  const [cover, setCover] = useState<CoverId>("rigide");
  const [mode, setMode] = useState<StartMode>("blank");
  const [themeId, setThemeId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const selection = { paper, orientation, cover };
  const sku = photobookSku(selection);
  const variant = useMemo(
    () => variants.find((item) => item.sku === sku) ?? null,
    [sku, variants],
  );

  const size = selectionSize(selection);
  const priceMga = variant?.priceMga ?? selectionPriceMga(selection);

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

    const params = new URLSearchParams({ product: PHOTOBOOK_SLUG, variant: variant.id });
    if (selectedTemplate) params.set("template", selectedTemplate.id);

    router.push(`/editeur?${params.toString()}`);
  };

  const steps = [
    t("wizard.paper"),
    t("wizard.orientation"),
    t("wizard.cover"),
    t("wizard.start"),
  ];

  return (
    <div className="container-page py-10">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight">{t("wizard.title")}</h1>
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
                      ? "rounded-full bg-brand-600 px-3 py-1.5 text-white"
                      : index < step
                        ? "rounded-full bg-brand-50 px-3 py-1.5 text-brand-700 ring-1 ring-brand-200"
                        : "rounded-full bg-white px-3 py-1.5 text-ink-500 ring-1 ring-sand-300"
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
              <ChoiceGrid hint={t("wizard.paperHint")}>
                {PAPER_FORMATS.map((format) => {
                  const active = format.id === paper;
                  return (
                    <ChoiceCard
                      key={format.id}
                      active={active}
                      onClick={() => setPaper(format.id)}
                      title={locale === "mg" ? format.labelMg : format.labelFr}
                      footer={formatMga(format.basePriceMga)}
                    >
                      <div
                        className="mx-auto rounded border border-sand-300 bg-white"
                        style={{
                          width: 52,
                          height: Math.min(74, (52 * format.longMm) / format.shortMm),
                        }}
                      />
                    </ChoiceCard>
                  );
                })}
              </ChoiceGrid>
            ) : null}

            {step === 1 ? (
              <ChoiceGrid hint={t("wizard.orientationHint")}>
                {ORIENTATIONS.map((item) => {
                  const active = item.id === orientation;
                  const width = item.isPortrait ? 52 : 74;
                  const height = item.isPortrait ? 74 : 52;
                  return (
                    <ChoiceCard
                      key={item.id}
                      active={active}
                      onClick={() => setOrientation(item.id)}
                      title={locale === "mg" ? item.labelMg : item.labelFr}
                      footer={formatDimensions(
                        item.isPortrait ? size.widthMm : size.heightMm,
                        item.isPortrait ? size.heightMm : size.widthMm,
                      )}
                    >
                      <div
                        className="mx-auto rounded border border-sand-300 bg-white"
                        style={{ width, height }}
                      />
                    </ChoiceCard>
                  );
                })}
              </ChoiceGrid>
            ) : null}

            {step === 2 ? (
              <ChoiceGrid hint={t("wizard.coverHint")}>
                {COVERS.map((item) => {
                  const active = item.id === cover;
                  // Prix réel du format correspondant à cette couverture, tel
                  // qu'il figure au catalogue (et non recalculé à l'écran).
                  const coverPrice =
                    variants.find(
                      (candidate) =>
                        candidate.sku ===
                        photobookSku({ paper, orientation, cover: item.id }),
                    )?.priceMga ??
                    selectionPriceMga({ paper, orientation, cover: item.id });

                  return (
                    <ChoiceCard
                      key={item.id}
                      active={active}
                      onClick={() => setCover(item.id)}
                      title={locale === "mg" ? item.labelMg : item.labelFr}
                      description={locale === "mg" ? item.descriptionMg : item.descriptionFr}
                      footer={formatMga(coverPrice)}
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
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                                  ? "rounded-xl border-2 border-brand-600 bg-brand-50 p-4 text-left"
                                  : "rounded-xl border border-sand-300 bg-white p-4 text-left hover:border-brand-300"
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
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  <p className="mt-3 text-xs font-semibold text-amber-700">
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
                {t("wizard.create")}
              </button>
            )}
          </div>

          {!variant ? (
            <p className="mt-3 text-xs font-semibold text-accent-700">
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
              <SummaryRow label={t("wizard.paper")} value={paperLabel(paper, locale)} />
              <SummaryRow
                label={t("wizard.orientation")}
                value={orientationLabel(orientation, locale)}
              />
              <SummaryRow label={t("wizard.cover")} value={coverLabel(cover, locale)} />
              <SummaryRow label={t("wizard.departure")} value={departureLabel} />
            </dl>

            <p className="muted mt-3 text-xs">
              {t("wizard.pagesLine", { pages: PHOTOBOOK_PAGES })} ·{" "}
              {formatDimensions(size.widthMm, size.heightMm)}
            </p>

            <div className="mt-4 rounded-xl bg-sand-100 px-4 py-3">
              <span className="muted block text-xs">{t("wizard.price")}</span>
              <span className="text-xl font-bold text-brand-700">{formatMga(priceMga)}</span>
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

function paperLabel(paper: PaperId, locale: "fr" | "mg") {
  const format = PAPER_FORMATS.find((item) => item.id === paper);
  if (!format) return "";
  return locale === "mg" ? format.labelMg : format.labelFr;
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
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
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
          ? "rounded-xl border-2 border-brand-600 bg-brand-50 p-4 text-left"
          : "rounded-xl border border-sand-300 bg-white p-4 text-left hover:border-brand-300"
      }
    >
      {children ? <div className="mb-3 flex justify-center">{children}</div> : null}
      <span className="block text-sm font-bold">{title}</span>
      {description ? <span className="muted mt-1 block text-xs">{description}</span> : null}
      {footer ? (
        <span className="mt-2 block text-sm font-semibold text-brand-700">{footer}</span>
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
          ? "rounded-xl border-2 border-brand-600 bg-brand-50 p-4 text-left"
          : "rounded-xl border border-sand-300 bg-white p-4 text-left hover:border-brand-300"
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
          ? "rounded-xl border-2 border-brand-600 bg-brand-50 p-3 text-left"
          : "rounded-xl border border-sand-300 bg-white p-3 text-left hover:border-brand-300"
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
