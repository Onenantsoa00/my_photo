"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

import { useT } from "@/components/locale-provider";

/**
 * Champ image du back-office.
 *
 * L'admin peut coller une adresse ou envoyer un fichier depuis son appareil :
 * le fichier passe par /api/uploads (redimensionné et converti en WebP) et
 * l'URL renvoyée est stockée dans le champ caché du formulaire parent.
 */
export function ImageField({
  name,
  label,
  hint,
  defaultValue = "",
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string | null;
}) {
  const t = useT();
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setFailed(false);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/uploads", { method: "POST", body });
      const payload = (await response.json()) as { url?: string };

      if (!response.ok || !payload.url) throw new Error("upload");
      setUrl(payload.url);
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="label text-[11px]">{label}</label>
      <input type="hidden" name={name} value={url} />

      <div className="mt-1 flex gap-2">
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-sand-100 ring-1 ring-sand-300">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-ink-400">
              <ImagePlus className="h-5 w-5" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="/api/files/webp/…"
            aria-label={label}
            className="input px-2 py-1.5 text-xs"
          />

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="btn-outline btn-sm gap-1.5 px-2 py-1 text-[11px]"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {t("admin.choosePhoto")}
            </button>

            {url ? (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-600 hover:underline"
              >
                <X className="h-3 w-3" /> {t("admin.removePhoto")}
              </button>
            ) : null}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />

          {failed ? (
            <p className="mt-1 text-[11px] font-semibold text-accent-600">
              {t("admin.uploadFailed")}
            </p>
          ) : hint ? (
            <p className="muted mt-1 text-[11px] leading-snug">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
