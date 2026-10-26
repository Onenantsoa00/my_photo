"use client";

import { useMemo } from "react";

import { TemplatePreview } from "@/components/editor/template-preview";
import { useLocale, useT } from "@/components/locale-provider";
import { TEMPLATES, type Template } from "@/lib/editor/templates";

export function TemplatePicker({
  open,
  onClose,
  onApply,
  templates = TEMPLATES,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (template: Template) => void;
  /** Sous-ensemble affiché (par exemple les modèles d'un thème). */
  templates?: Template[];
}) {
  const locale = useLocale();
  const t = useT();

  // Construit une seule fois par ouverture : les modèles sont déterministes.
  const built = useMemo(
    () => templates.map((template) => ({ template, document: template.build() })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, templates],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={t("editor.templates")}
    >
      <div className="card w-full max-w-4xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("editor.templates")}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {built.map(({ template, document }) => (
            <article key={template.id} className="rounded-xl border border-sand-200 p-3">
              <div className="flex justify-center">
                <TemplatePreview document={document} />
              </div>
              <h3 className="mt-3 text-sm font-bold">
                {locale === "mg" ? template.nameMg : template.nameFr}
              </h3>
              <p className="muted mt-1 text-xs">
                {template.descriptionFr}
                {" · "}
                {template.targetWidthMm / 10} × {template.targetHeightMm / 10} cm
              </p>
              <button
                type="button"
                className="btn-primary mt-3 w-full py-2 text-xs"
                onClick={() => {
                  onApply(template);
                  onClose();
                }}
              >
                {t("editor.applyTemplate")}
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
