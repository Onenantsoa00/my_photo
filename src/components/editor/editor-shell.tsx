"use client";

import type Konva from "konva";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";

import { Inspector } from "@/components/editor/inspector";
import { LayersPanel } from "@/components/editor/layers-panel";
import { TemplatePicker } from "@/components/editor/template-picker";
import { useT } from "@/components/locale-provider";
import type { TranslationKey } from "@/lib/i18n";
import { computeExportInfo, downloadDataUrl, safeFilename } from "@/lib/editor/export";
import { useEditor } from "@/components/editor/use-editor";
import type { EditorDocument, Layer } from "@/lib/editor/types";
import { fitDocument, type Template } from "@/lib/editor/templates";
import { orderDesignAction, saveDesignAction } from "@/server/actions/designs";

const CanvasStage = dynamic(() => import("@/components/editor/canvas-stage"), {
  ssr: false,
  loading: () => (
    <div className="grid h-80 w-[38rem] place-items-center rounded-xl bg-white text-sm text-ink-500 ring-1 ring-sand-300">
      Chargement de l'atelier…
    </div>
  ),
});

export type EditorContext = {
  productId: string | null;
  variantId: string | null;
  productName: string | null;
  variantLabel: string | null;
  targetWidthMm: number | null;
  targetHeightMm: number | null;
};

export type EditorShellProps = {
  initialDocument: EditorDocument;
  initialTitle: string;
  /** Message affiché à l'ouverture (par exemple un modèle appliqué). */
  initialNoticeKey?: TranslationKey | null;
  initialDesignId: string | null;
  context: EditorContext;
  variants: {
    id: string;
    label: string;
    widthMm: number | null;
    heightMm: number | null;
    priceMga: number;
  }[];
};

type UploadTarget = { mode: "new" } | { mode: "replace"; layerId: string };

export function EditorShell({
  initialDocument,
  initialTitle,
  initialNoticeKey = null,
  initialDesignId,
  context,
  variants,
}: EditorShellProps) {
  const t = useT();
  const router = useRouter();

  const editor = useEditor(initialDocument);
  const { document, selectedId, selectedLayer } = editor;

  const [title, setTitle] = useState(initialTitle);
  const [designId, setDesignId] = useState<string | null>(initialDesignId);
  const [variantId, setVariantId] = useState(context.variantId);
  const [quantity, setQuantity] = useState(1);
  const [zoom, setZoom] = useState(() =>
    Math.min(1, Math.max(0.15, 720 / document.canvas.width)),
  );
  const [templateOpen, setTemplateOpen] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(() =>
    initialNoticeKey ? { kind: "ok", text: t(initialNoticeKey) } : null,
  );
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const stageRef = useRef<Konva.Stage | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<UploadTarget>({ mode: "new" });
  // Tant que l'utilisateur n'a pas renommé la création, un modèle appliqué
  // peut donner son nom au document.
  const titleTouched = useRef(Boolean(initialTitle));

  const activeVariant = useMemo(
    () => variants.find((variant) => variant.id === variantId) ?? null,
    [variants, variantId],
  );

  /** Dimensions cibles : celles du format choisi, sinon celles du plan de travail. */
  const targetWidthMm = activeVariant?.widthMm ?? context.targetWidthMm;
  const targetHeightMm = activeVariant?.heightMm ?? context.targetHeightMm;

  const exportInfo = useMemo(
    () =>
      computeExportInfo(
        document.canvas.width,
        document.canvas.height,
        targetWidthMm,
        targetHeightMm,
      ),
    [document.canvas.width, document.canvas.height, targetWidthMm, targetHeightMm],
  );

  const emptySlots = document.layers.filter(
    (layer) => layer.type === "image" && !layer.src,
  ).length;

  // ------------------------------------------------------------------ export

  const renderStageDataUrl = useCallback(
    (pixelRatio: number, mimeType: "image/png" | "image/jpeg") => {
      const stage = stageRef.current;
      if (!stage) return null;

      // La poignée de sélection ne doit jamais apparaître sur le fichier.
      const transformer = stage.findOne(".selection");
      const wasVisible = transformer?.visible() ?? false;
      transformer?.hide();
      stage.draw();

      const dataUrl = stage.toDataURL({
        pixelRatio,
        mimeType,
        quality: mimeType === "image/jpeg" ? 0.92 : undefined,
      });

      if (wasVisible) transformer?.show();
      stage.draw();

      return dataUrl;
    },
    [],
  );

  const exportFile = (format: "png" | "jpg") => {
    const dataUrl = renderStageDataUrl(
      exportInfo.pixelRatio,
      format === "png" ? "image/png" : "image/jpeg",
    );

    if (!dataUrl) return;

    downloadDataUrl(dataUrl, safeFilename(title, format));
    setStatus({
      kind: "ok",
      text:
        format === "png"
          ? `${t("editor.exportPng")} · ${exportInfo.widthPx}×${exportInfo.heightPx} px`
          : `${t("editor.exportJpg")} · ${exportInfo.widthPx}×${exportInfo.heightPx} px`,
    });
  };

  /** Aperçu léger envoyé au serveur pour la vignette de commande. */
  const renderPreviewDataUrl = useCallback(() => {
    const maxSide = Math.max(document.canvas.width, document.canvas.height);
    const ratio = Math.min(1, 1100 / maxSide);
    return renderStageDataUrl(ratio, "image/jpeg");
  }, [document.canvas.width, document.canvas.height, renderStageDataUrl]);

  // --------------------------------------------------------------- enregistrer

  const persist = useCallback(
    async (withPreview: boolean) => {
      const result = await saveDesignAction({
        designId,
        title,
        document,
        previewDataUrl: withPreview ? renderPreviewDataUrl() : null,
        productId: context.productId,
        targetWidthMm,
        targetHeightMm,
      });

      if (result.ok && result.designId) {
        setDesignId(result.designId);
        editor.markClean();
      }

      return result;
    },
    [context.productId, designId, document, editor, renderPreviewDataUrl, targetHeightMm, targetWidthMm, title],
  );

  const handleSave = () => {
    startTransition(async () => {
      const result = await persist(true);
      setStatus(
        result.ok
          ? { kind: "ok", text: t("editor.saved") }
          : { kind: "error", text: result.errorKey ? t(result.errorKey) : t("editor.noLayers") },
      );
    });
  };

  // ------------------------------------------------------------------ commander

  const handleOrder = () => {
    // Capturés en locales : la vérification doit tenir à l'intérieur du closure
    // asynchrone, un contexte mutable ne serait pas réduit par TypeScript.
    const productId = context.productId;
    const selectedVariantId = variantId;

    if (!productId || !selectedVariantId) {
      setStatus({ kind: "error", text: t("editor.needProduct") });
      return;
    }

    startTransition(async () => {
      const result = await orderDesignAction({
        designId,
        title,
        document,
        previewDataUrl: renderPreviewDataUrl(),
        productId,
        variantId: selectedVariantId,
        quantity,
      });

      if (result.ok && result.cartPath) {
        router.push(result.cartPath);
        return;
      }

      setStatus({
        kind: "error",
        text: result.errorKey ? t(result.errorKey) : t("editor.needProduct"),
      });
    });
  };

  // ------------------------------------------------------------------- photos

  const openFilePicker = (target: UploadTarget) => {
    uploadTargetRef.current = target;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setStatus(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/uploads", { method: "POST", body });
      if (!response.ok) throw new Error("upload failed");

      const payload = (await response.json()) as { url: string; path: string };
      const target = uploadTargetRef.current;

      if (target.mode === "replace") {
        editor.patchImage(target.layerId, { src: payload.url, uploadPath: payload.path });
      } else {
        editor.addImage(payload.url, payload.path);
      }
    } catch {
      setStatus({ kind: "error", text: t("editor.uploadError") });
    } finally {
      setUploading(false);
    }
  };

  // ------------------------------------------------------------------ modèles

  const applyTemplate = (template: Template) => {
    const built = template.build();

    // Le modèle apporte la composition ; le format commandé impose sa forme.
    // On adapte donc la composition au plan de travail courant plutôt que de
    // changer la taille du plan de travail.
    const adapted = fitDocument(
      built,
      document.canvas.width,
      document.canvas.height,
    );

    editor.replaceDocument(adapted);
    if (!titleTouched.current) setTitle(template.nameFr);
    setStatus({ kind: "ok", text: template.nameFr });
  };

  const applyLayerPatch = (id: string, patch: Partial<Layer>, options?: { history?: boolean }) => {
    editor.patchLayer(id, patch, options);
  };

  const hasProduct = Boolean(context.productId && variantId);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-sand-100">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ------------------------------------------------------------- Barre */}
      <div className="flex flex-wrap items-center gap-2 border-b border-sand-200 bg-white px-3 py-2">
        <input
          value={title}
          onChange={(event) => {
            titleTouched.current = true;
            setTitle(event.target.value);
          }}
          aria-label={t("editor.title")}
          className="w-40 rounded-lg border border-transparent px-2 py-1.5 text-sm font-semibold hover:border-sand-300 focus:border-brand-500 focus:outline-none sm:w-56"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={editor.undo}
            disabled={!editor.canUndo}
            className="btn-outline btn-sm"
            title={t("editor.undo")}
          >
            ↶
          </button>
          <button
            type="button"
            onClick={editor.redo}
            disabled={!editor.canRedo}
            className="btn-outline btn-sm"
            title={t("editor.redo")}
          >
            ↷
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-sand-300 bg-white px-1">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setZoom((value) => Math.max(0.1, value - 0.1))}
            title="Zoom −"
          >
            −
          </button>
          <span className="w-10 text-center text-xs font-semibold tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setZoom((value) => Math.min(3, value + 0.1))}
            title="Zoom +"
          >
            +
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editor.dirty ? (
            <span className="badge-warn">{t("editor.unsaved")}</span>
          ) : null}

          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={handleSave}
            disabled={isPending}
          >
            💾 {t("editor.save")}
          </button>

          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => exportFile("png")}
          >
            ⬇ PNG
          </button>
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => exportFile("jpg")}
          >
            ⬇ JPG
          </button>

          <button
            type="button"
            className="btn-accent btn-sm"
            onClick={handleOrder}
            disabled={isPending || !hasProduct}
            title={hasProduct ? undefined : t("editor.needProduct")}
          >
            🛒 {t("editor.order")}
          </button>
        </div>
      </div>

      {status ? (
        <div
          role="status"
          className={
            status.kind === "ok"
              ? "border-b border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800"
              : "border-b border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-700"
          }
        >
          {status.text}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* ---------------------------------------------------------- Colonne gauche */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-sand-200 bg-white">
          <div className="space-y-2 border-b border-sand-200 p-3">
            <button
              type="button"
              className="btn-outline w-full justify-start py-2 text-xs"
              onClick={() => editor.addText(t("editor.placeholderText"))}
            >
              🅣 {t("editor.addText")}
            </button>
            <button
              type="button"
              className="btn-outline w-full justify-start py-2 text-xs"
              onClick={() => openFilePicker({ mode: "new" })}
              disabled={uploading}
            >
              🖼 {uploading ? t("editor.uploading") : t("editor.uploadPhoto")}
            </button>
            <button
              type="button"
              className="btn-outline w-full justify-start py-2 text-xs"
              onClick={() => editor.addShape("rect")}
            >
              ◆ {t("editor.tool.shape")}
            </button>
            <button
              type="button"
              className="btn-outline w-full justify-start py-2 text-xs"
              onClick={() => setTemplateOpen(true)}
            >
              ✨ {t("editor.tool.template")}
            </button>
          </div>

          <div className="border-b border-sand-200 p-3">
            <label className="label text-[11px]">{t("editor.tool.background")}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={document.canvas.background}
                onChange={(event) => editor.setBackground(event.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-sand-300 bg-white p-0.5"
              />
              <div className="flex gap-1">
                {["#ffffff", "#f8fafc", "#0f172a", "#0f766e", "#e2372f"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    onClick={() => editor.setBackground(color)}
                    className="h-6 w-6 rounded-full border border-sand-300"
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <LayersPanel
            document={document}
            selectedId={selectedId}
            onSelect={editor.select}
            onToggleVisible={(id) => {
              const layer = document.layers.find((item) => item.id === id);
              if (layer) editor.patchLayer(id, { visible: !layer.visible });
            }}
            onToggleLock={(id) => {
              const layer = document.layers.find((item) => item.id === id);
              if (layer) editor.patchLayer(id, { locked: !layer.locked });
            }}
            onMove={editor.moveLayer}
            onDuplicate={editor.duplicateLayer}
            onDelete={editor.removeLayer}
          />
        </aside>

        {/* -------------------------------------------------------------- Scène */}
        <div className="thin-scroll relative min-w-0 flex-1 overflow-auto p-8">
          <div className="mx-auto w-fit">
            <CanvasStage
              document={document}
              selectedId={selectedId}
              zoom={zoom}
              stageRef={stageRef}
              onSelect={editor.select}
              onGestureStart={editor.beginGesture}
              onGestureEnd={editor.endGesture}
              onChange={applyLayerPatch}
            />
          </div>

          <div className="mx-auto mt-4 w-fit rounded-xl bg-white/90 px-3 py-2 text-center text-xs text-ink-500 ring-1 ring-sand-200">
            {t("editor.canvas")} · {document.canvas.width}×{document.canvas.height} px
            {targetWidthMm && targetHeightMm ? (
              <>
                {" · "}
                {t("editor.side")} {targetWidthMm / 10} × {targetHeightMm / 10} cm
              </>
            ) : null}
            {" · "}
            {t("editor.exportHint")} : <strong>{exportInfo.effectiveDpi || "—"} dpi</strong> (
            {exportInfo.widthPx}×{exportInfo.heightPx} px)
            {exportInfo.lowResolution ? (
              <span className="ml-1 font-bold text-accent-600">
                · {t("editor.exportHint")} ⚠
              </span>
            ) : null}
            {emptySlots > 0 ? (
              <span className="ml-2 font-bold text-amber-700">
                · {emptySlots} emplacement(s) photo vide(s)
              </span>
            ) : null}
          </div>
        </div>

        {/* -------------------------------------------------------- Colonne droite */}
        <aside className="flex w-64 shrink-0 flex-col border-l border-sand-200 bg-white">
          {hasProduct ? (
            <div className="border-b border-sand-200 p-3">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-ink-500">
                {t("editor.side")}
              </h2>
              <p className="mt-1 truncate text-xs font-semibold">{context.productName}</p>

              <label className="label mt-2 text-[11px]" htmlFor="editor-variant">
                {t("product.chooseFormat")}
              </label>
              <select
                id="editor-variant"
                className="input px-2 py-1.5 text-xs"
                value={variantId ?? ""}
                onChange={(event) => setVariantId(event.target.value)}
              >
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </select>

              <label className="label mt-2 text-[11px]" htmlFor="editor-quantity">
                {t("common.quantity")}
              </label>
              <input
                id="editor-quantity"
                type="number"
                min={1}
                max={500}
                className="input px-2 py-1.5 text-xs"
                value={quantity}
                onChange={(event) =>
                  setQuantity(Math.max(1, Math.min(500, Number(event.target.value) || 1)))
                }
              />
            </div>
          ) : (
            <div className="border-b border-sand-200 p-3">
              <p className="text-[11px] leading-relaxed text-ink-500">
                {t("editor.needProduct")}
              </p>
              <Link href="/produits" className="btn-outline mt-2 w-full py-1.5 text-xs">
                {t("nav.products")}
              </Link>
            </div>
          )}

          <Inspector
            layer={selectedLayer}
            onPatch={applyLayerPatch}
            onGestureStart={editor.beginGesture}
            onGestureEnd={editor.endGesture}
            onReplacePhoto={(layerId) => openFilePicker({ mode: "replace", layerId })}
          />
        </aside>
      </div>      <TemplatePicker
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onApply={applyTemplate}
      />
    </div>
  );
}
