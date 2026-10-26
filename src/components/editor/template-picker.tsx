"use client";

import { Circle, Diamond, Heart, ImagePlus, Square, Star } from "lucide-react";
import { useMemo } from "react";

import { TemplatePreview } from "@/components/editor/template-preview";
import { useLocale, useT } from "@/components/locale-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TEMPLATES, type Template } from "@/lib/editor/templates";
import type { ImageCrop } from "@/lib/editor/types";

const SHAPE_PHOTOS: { crop: ImageCrop; icon: typeof Circle; key: `editor.crop.${ImageCrop}` }[] = [
  { crop: "circle", icon: Circle, key: "editor.crop.circle" },
  { crop: "rounded", icon: Square, key: "editor.crop.rounded" },
  { crop: "heart", icon: Heart, key: "editor.crop.heart" },
  { crop: "star", icon: Star, key: "editor.crop.star" },
  { crop: "diamond", icon: Diamond, key: "editor.crop.diamond" },
];

export function TemplatePicker({
  open,
  onClose,
  onApply,
  onAddPhoto,
  templates = TEMPLATES,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (template: Template) => void;
  onAddPhoto: (crop?: ImageCrop) => void;
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-7xl overflow-y-auto rounded-2xl border-0 p-4 sm:w-[calc(100%-2rem)] sm:max-w-7xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            {t("editor.templates")}
          </DialogTitle>
          <DialogDescription>{t("editor.templatesHint")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {/* ------------------------------------------------ photo libre */}
          <div className="flex flex-col rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/70 p-3 dark:bg-brand-900/20">
            <button
              type="button"
              onClick={() => {
                onAddPhoto("none");
                onClose();
              }}
              className="flex flex-1 flex-col items-center justify-center rounded-lg px-3 py-6 text-center transition-colors hover:bg-brand-100/70 dark:hover:bg-brand-900/30"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/25">
                <ImagePlus className="h-6 w-6" />
              </span>
              <span className="mt-3 text-sm font-bold">{t("editor.addPhotoFromDevice")}</span>
              <span className="mt-1 text-xs text-ink-500">
                {t("editor.addPhotoFromDeviceHint")}
              </span>
            </button>

            <div className="mt-3 border-t border-brand-200 pt-3 dark:border-brand-800">
              <p className="text-[11px] font-semibold text-ink-500">
                {t("editor.photoInShape")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SHAPE_PHOTOS.map(({ crop, icon: Icon, key }) => (
                  <button
                    key={crop}
                    type="button"
                    title={t(key)}
                    onClick={() => {
                      onAddPhoto(crop);
                      onClose();
                    }}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-sand-300 bg-card text-ink-700 transition-colors hover:border-brand-400 hover:text-brand-700"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {built.map(({ template, document }) => (
            <article
              key={template.id}
              className="group flex flex-col rounded-xl border border-sand-200 bg-card p-3 transition-shadow hover:shadow-md"
            >
              <div className="flex justify-center overflow-hidden rounded-lg bg-sand-100 p-2">
                <TemplatePreview document={document} width={260} />
              </div>
              <h3 className="mt-3 text-sm font-bold">
                {locale === "mg" ? template.nameMg : template.nameFr}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
                {locale === "mg"
                  ? (template.descriptionMg ?? template.descriptionFr)
                  : template.descriptionFr}
              </p>
              <button
                type="button"
                className="btn-primary mt-auto w-full py-2 text-xs"
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
      </DialogContent>
    </Dialog>
  );
}
