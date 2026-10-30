"use client";

import type Konva from "konva";
import {
  ArrowLeft,
  BookOpen,
  Circle,
  Copy,
  Diamond,
  Download,
  Heart,
  ImagePlus,
  Layers,
  LayoutTemplate,
  Lock,
  Plus,
  Redo2,
  Save,
  Settings2,
  Shapes,
  ShoppingBag,
  Sparkles,
  Square,
  Star,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { BackgroundControls } from "@/components/editor/background-controls";
import { Inspector } from "@/components/editor/inspector";
import { LayersPanel } from "@/components/editor/layers-panel";
import { PageStrip } from "@/components/editor/page-strip";
import { TemplatePicker } from "@/components/editor/template-picker";
import { useLocale, useT } from "@/components/locale-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { backgroundToCss } from "@/lib/editor/background";
import { computeExportInfo, downloadDataUrl, safeFilename } from "@/lib/editor/export";
import { fitDocument, type Template } from "@/lib/editor/templates";
import type { EditorDocument, EditorPage, ImageCrop, Layer } from "@/lib/editor/types";
import { formatMga } from "@/lib/format";
import type { TranslationKey } from "@/lib/i18n";
import {
  PHOTOBOOK_BASE_PRICE_MGA,
  PHOTOBOOK_EXTRA_PAGE_MGA,
  PHOTOBOOK_MAX_PAGES,
  PHOTOBOOK_MIN_PAGES,
  coverExtraFromSku,
  findPaper,
  photobookPriceBreakdown,
  type PaperId,
} from "@/lib/photobook";
import { orderDesignAction, saveDesignAction } from "@/server/actions/designs";
import { useEditor } from "@/components/editor/use-editor";

const CanvasStage = dynamic(() => import("@/components/editor/canvas-stage"), {
  ssr: false,
  loading: () => (
    <div className="grid h-96 w-[min(38rem,80vw)] place-items-center rounded-xl bg-card text-sm text-ink-500 ring-1 ring-sand-300">
      Chargement de l'atelier…
    </div>
  ),
});

export type EditorContext = {
  productId: string | null;
  variantId: string | null;
  productName: string | null;
  variantLabel: string | null;
  /** Référence du format (papier, orientation, couverture), pour le prix. */
  variantSku: string | null;
  targetWidthMm: number | null;
  targetHeightMm: number | null;
};

export type EditorShellProps = {
  initialDocument: EditorDocument;
  initialTitle: string;
  /** Message affiché à l'ouverture (par exemple un modèle appliqué). */
  initialNoticeKey?: TranslationKey | null;
  initialDesignId: string | null;
  /**
   * Le fichier d'impression se télécharge depuis l'atelier : le bouton est
   * réservé à l'équipe (admin). Le client commande depuis le panier, l'équipe
   * télécharge le fichier et fabrique le livre.
   */
  canExport: boolean;
  context: EditorContext;
  variants: {
    id: string;
    sku: string;
    label: string;
    widthMm: number | null;
    heightMm: number | null;
    priceMga: number;
  }[];
};

type UploadTarget =
  | { mode: "new"; crop?: ImageCrop }
  | { mode: "replace"; layerId: string };

type MobilePanel = "pages" | "tools" | "layers" | "settings" | null;

const PHOTO_SHAPES: { crop: ImageCrop; icon: typeof Circle; key: `editor.crop.${ImageCrop}` }[] = [
  { crop: "rounded", icon: Square, key: "editor.crop.rounded" },
  { crop: "circle", icon: Circle, key: "editor.crop.circle" },
  { crop: "heart", icon: Heart, key: "editor.crop.heart" },
  { crop: "star", icon: Star, key: "editor.crop.star" },
  { crop: "diamond", icon: Diamond, key: "editor.crop.diamond" },
];

export function EditorShell({
  initialDocument,
  initialTitle,
  initialNoticeKey = null,
  initialDesignId,
  canExport,
  context,
  variants,
}: EditorShellProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const editor = useEditor(initialDocument, {
    minPages: PHOTOBOOK_MIN_PAGES,
    maxPages: PHOTOBOOK_MAX_PAGES,
  });
  const { document, page, selectedId, selectedLayer, dirty, markClean } = editor;

  const [title, setTitle] = useState(initialTitle);
  const [designId, setDesignId] = useState<string | null>(initialDesignId);
  const [variantId, setVariantId] = useState(context.variantId);
  const [quantity, setQuantity] = useState(1);
  // Valeur identique au serveur et au client : le vrai ajustement est fait
  // après le montage par `fitCanvas` (sinon React signale une divergence
  // d'hydratation sur le pourcentage de zoom).
  const [zoom, setZoom] = useState(0.35);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(
    () => (initialNoticeKey ? { kind: "ok", text: t(initialNoticeKey) } : null),
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  const stageRef = useRef<Konva.Stage | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<UploadTarget>({ mode: "new" });
  const savingRef = useRef(false);
  // Tant que l'utilisateur n'a pas renommé la création, un modèle appliqué
  // peut donner son nom au document.
  const titleTouched = useRef(Boolean(initialTitle));

  const activeVariant = useMemo(
    () => variants.find((variant) => variant.id === variantId) ?? null,
    [variants, variantId],
  );

  // Le format peut être changé dans l'atelier : c'est toujours celui
  // sélectionné qui porte la couverture, donc le supplément de prix.
  const variantSku = activeVariant?.sku ?? context.variantSku;
  const formatLabel = useMemo(() => {
    const paperId = variantSku?.split("-")[1];
    if (!paperId) return null;
    try {
      const paper = findPaper(paperId as PaperId);
      return locale === "mg" ? paper.nameMg : paper.nameFr;
    } catch {
      return null;
    }
  }, [variantSku, locale]);

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

  const price = useMemo(
    () => photobookPriceBreakdown(document.pages.length, coverExtraFromSku(variantSku)),
    [document.pages.length, variantSku],
  );
  const orderTotalMga = price.totalMga * quantity;

  const emptySlots = page.layers.filter(
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

  const renderPreviewDataUrl = useCallback(() => {
    const maxSide = Math.max(document.canvas.width, document.canvas.height);
    const ratio = Math.min(1, 1100 / maxSide);
    return renderStageDataUrl(ratio, "image/jpeg");
  }, [document.canvas.width, document.canvas.height, renderStageDataUrl]);

  const exportFile = (format: "png" | "jpg") => {
    const dataUrl = renderStageDataUrl(
      exportInfo.pixelRatio,
      format === "png" ? "image/png" : "image/jpeg",
    );

    if (!dataUrl) return;

    const suffix = `page-${editor.pageIndex + 1}`;
    downloadDataUrl(dataUrl, safeFilename(`${title || "photobook"}-${suffix}`, format));
    setStatus({
      kind: "ok",
      text: `${t("editor.page")} ${editor.pageIndex + 1} · ${exportInfo.widthPx}×${exportInfo.heightPx} px`,
    });
  };

  // --------------------------------------------------------------- enregistrer

  const persist = useCallback(
    async (withPreview: boolean) => {
      if (savingRef.current) {
        return { ok: false as const, errorKey: "editor.saveFailed" as TranslationKey };
      }

      savingRef.current = true;
      setSaving(true);

      try {
        const result = await saveDesignAction({
          designId,
          title,
          document,
          previewDataUrl: withPreview ? renderPreviewDataUrl() : null,
          productId: context.productId,
          variantSku,
          targetWidthMm,
          targetHeightMm,
        });

        if (result.ok && result.designId) {
          setDesignId(result.designId);
          markClean();
          setLastSavedAt(new Date());

          // L'URL porte la création : un rafraîchissement la rouvre telle quelle.
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            if (url.searchParams.get("design") !== result.designId) {
              url.searchParams.set("design", result.designId);
              window.history.replaceState(null, "", url.toString());
            }
          }
        }

        return result;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [
      context.productId,
      designId,
      document,
      markClean,
      renderPreviewDataUrl,
      targetHeightMm,
      targetWidthMm,
      title,
      variantSku,
    ],
  );

  // Sauvegarde de secours : un brouillon est enregistré peu après la dernière
  // modification, pour que fermer l'onglet ne perde pas le travail.
  useEffect(() => {
    if (!dirty || uploading) return;

    const timer = window.setTimeout(() => {
      void persist(false);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [dirty, persist, uploading]);

  const handleSave = () => {
    startTransition(async () => {
      const result = await persist(true);
      setStatus(
        result.ok
          ? { kind: "ok", text: t("editor.saved") }
          : {
              kind: "error",
              text: result.errorKey ? t(result.errorKey) : t("editor.saveFailed"),
            },
      );
    });
  };

  const handleSaveAndQuit = () => {
    startTransition(async () => {
      const result = await persist(true);
      if (result.ok) {
        router.push("/compte");
        return;
      }
      setStatus({
        kind: "error",
        text: result.errorKey ? t(result.errorKey) : t("editor.saveFailed"),
      });
    });
  };

  // ------------------------------------------------------------------ commander

  const handleOrder = () => {
    const productId = context.productId;
    const selectedVariantId = variantId;

    if (!productId || !selectedVariantId) {
      setStatus({ kind: "error", text: t("editor.needProduct") });
      return;
    }

    if (document.pages.length < PHOTOBOOK_MIN_PAGES) {
      setStatus({ kind: "error", text: t("editor.minPages") });
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
        variantSku,
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
        editor.addImage(payload.url, payload.path, target.crop ?? "none");
      }

      setMobilePanel(null);
    } catch {
      setStatus({ kind: "error", text: t("editor.uploadError") });
    } finally {
      setUploading(false);
    }
  };

  // ------------------------------------------------------------------ modèles

  const applyTemplate = (template: Template) => {
    const built = fitDocument(template.build(), document.canvas.width, document.canvas.height);
    const builtPage: EditorPage | undefined = built.pages[0];

    if (!builtPage) return;

    editor.replaceActivePage(builtPage);
    if (!titleTouched.current) setTitle(template.nameFr);
    setStatus({ kind: "ok", text: template.nameFr });
  };

  const applyLayerPatch = (id: string, patch: Partial<Layer>, options?: { history?: boolean }) => {
    editor.patchLayer(id, patch, options);
  };

  const fitCanvas = useCallback(() => {
    const element = canvasWrapRef.current;
    if (!element) return;

    const availableWidth = Math.max(160, element.clientWidth - 32);
    const availableHeight = Math.max(200, element.clientHeight - 72);
    const next = Math.min(
      1,
      availableWidth / document.canvas.width,
      availableHeight / document.canvas.height,
    );

    setZoom(Math.max(0.08, next));
  }, [document.canvas.height, document.canvas.width]);

  useEffect(() => {
    fitCanvas();
    const element = canvasWrapRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => fitCanvas());
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitCanvas]);

  const hasProduct = Boolean(context.productId && variantId);

  const panelTitle: Record<Exclude<MobilePanel, null>, string> = {
    pages: t("editor.pages"),
    tools: t("editor.tools"),
    layers: t("editor.layers"),
    settings: t("editor.settings"),
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-sand-100 text-ink-900">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ------------------------------------------------------------- Barre */}
      <header className="z-30 shrink-0 border-b border-sand-200 bg-card/95 backdrop-blur">
        <div className="flex items-center gap-2 px-2 py-2 sm:px-3">
          <Link
            href="/compte"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-sand-300 text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
            title={t("editor.backToAccount")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white">
              M
            </span>
            <span className="hidden text-xs font-bold uppercase tracking-widest text-ink-500 md:block">
              {t("editor.photobookStudio")}
            </span>
          </div>

          <input
            value={title}
            onChange={(event) => {
              titleTouched.current = true;
              setTitle(event.target.value);
              // Le titre fait partie du brouillon : l'autosauvegarde doit
              // aussi se déclencher quand seul le nom du projet change.
              editor.markDirty();
            }}
            aria-label={t("editor.title")}
            placeholder={t("editor.untitled")}
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-bold hover:border-sand-300 focus:border-brand-500 focus:bg-card focus:outline-none"
          />

          <div className="hidden items-center gap-1.5 text-[11px] font-semibold text-ink-500 sm:flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                dirty ? "bg-amber-500" : "bg-brand-500"
              }`}
            />
            {saving
              ? t("editor.saving")
              : dirty
                ? t("editor.unsaved")
                : lastSavedAt
                  ? t("editor.savedAt", {
                      time: lastSavedAt.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    })
                  : t("editor.draft")}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleSaveAndQuit}
              disabled={isPending || saving}
              className="btn-ghost hidden items-center gap-1.5 px-2.5 py-2 text-xs sm:inline-flex"
              title={t("editor.saveAndQuit")}
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden xl:inline">{t("editor.saveAndQuitShort")}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || saving}
              className="btn-outline inline-flex items-center gap-1.5 px-2.5 py-2 text-xs"
              title={t("editor.save")}
            >
              <Save className="h-4 w-4" />
              <span className="hidden md:inline">{t("common.save")}</span>
            </button>

            <button
              type="button"
              onClick={handleOrder}
              disabled={isPending || !hasProduct}
              className="btn-accent inline-flex items-center gap-1.5 px-3 py-2 text-xs"
              title={hasProduct ? t("editor.order") : t("editor.needProduct")}
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">{t("editor.orderShort")}</span>
            </button>
          </div>
        </div>

        <div className="thin-scroll flex items-center gap-1.5 overflow-x-auto border-t border-sand-200/70 px-2 py-1.5 sm:px-3">
          <button
            type="button"
            onClick={editor.undo}
            disabled={!editor.canUndo}
            className="btn-outline btn-sm"
            title={t("editor.undo")}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={editor.redo}
            disabled={!editor.canRedo}
            className="btn-outline btn-sm"
            title={t("editor.redo")}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          <span className="mx-1 h-5 w-px bg-sand-200" />

          <div className="flex items-center gap-0.5 rounded-lg border border-sand-300 bg-card px-1">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setZoom((value) => Math.max(0.08, value - 0.1))}
              title="Zoom −"
            >
              −
            </button>
            <button
              type="button"
              onClick={fitCanvas}
              className="w-12 text-center text-[11px] font-bold tabular-nums hover:text-brand-700"
              title={t("editor.fitToScreen")}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setZoom((value) => Math.min(3, value + 0.1))}
              title="Zoom +"
            >
              +
            </button>
          </div>

          <span className="rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-semibold text-ink-500">
            {t("editor.page")} {editor.pageIndex + 1}/{editor.pageCount}
          </span>

          <span className="hidden items-center gap-1 text-[11px] font-semibold text-ink-500 sm:flex">
            {t("editor.exportHint")} · {exportInfo.effectiveDpi || "—"} dpi
          </span>

          <div className="ml-auto flex items-center gap-1">
            {canExport ? (
              <>
                <button
                  type="button"
                  className="btn-outline btn-sm inline-flex items-center gap-1"
                  onClick={() => exportFile("png")}
                >
                  <Download className="h-3.5 w-3.5" /> PNG
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm inline-flex items-center gap-1"
                  onClick={() => exportFile("jpg")}
                >
                  <Download className="h-3.5 w-3.5" /> JPG
                </button>
              </>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-semibold text-ink-500"
                title={t("editor.exportReserved")}
              >
                <Lock className="h-3 w-3" />
                {t("editor.exportReserved")}
              </span>
            )}
          </div>
        </div>
      </header>

      {status ? (
        <div
          role="status"
          className={
            status.kind === "ok"
              ? "shrink-0 border-b border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 dark:border-brand-800 dark:bg-brand-900/40 dark:text-brand-100"
              : "shrink-0 border-b border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-700 dark:border-accent-800 dark:bg-accent-900/40 dark:text-accent-100"
          }
        >
          {status.text}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* --------------------------------------------------- Colonne gauche */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sand-200 bg-card lg:flex">
          <div className="shrink-0 space-y-1.5 border-b border-sand-200 p-3">
            <ToolButton icon={Type} label={t("editor.addText")} onClick={() => editor.addText(t("editor.placeholderText"))} />
            <ToolButton
              icon={ImagePlus}
              label={uploading ? t("editor.uploading") : t("editor.uploadPhoto")}
              onClick={() => openFilePicker({ mode: "new", crop: "none" })}
              disabled={uploading}
            />
            <ToolButton icon={Shapes} label={t("editor.tool.shape")} onClick={() => editor.addShape("rect")} />
            <ToolButton icon={Sparkles} label={t("editor.tool.template")} onClick={() => setTemplateOpen(true)} />
          </div>

          <div className="shrink-0 border-b border-sand-200 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">
              {t("editor.photoInShape")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PHOTO_SHAPES.map(({ crop, icon: Icon, key }) => (
                <button
                  key={crop}
                  type="button"
                  onClick={() => openFilePicker({ mode: "new", crop })}
                  title={t(key)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-sand-300 bg-card text-ink-700 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="shrink-0 border-b border-sand-200 p-3">
            <BackgroundControls
              background={page.background}
              onChange={editor.setBackground}
            />
          </div>

          <LayersPanel
            layers={page.layers}
            selectedId={selectedId}
            onSelect={editor.select}
            onToggleVisible={(id) => {
              const layer = page.layers.find((item) => item.id === id);
              if (layer) editor.patchLayer(id, { visible: !layer.visible });
            }}
            onToggleLock={(id) => {
              const layer = page.layers.find((item) => item.id === id);
              if (layer) editor.patchLayer(id, { locked: !layer.locked });
            }}
            onMove={editor.moveLayer}
            onDuplicate={editor.duplicateLayer}
            onDelete={editor.removeLayer}
          />
        </aside>

        {/* ---------------------------------------------------------- Scène */}
        <div className="flex min-w-0 flex-1 flex-col">
          <PageStrip
            pages={document.pages}
            canvas={document.canvas}
            minPages={PHOTOBOOK_MIN_PAGES}
            pageIndex={editor.pageIndex}
            onSelect={editor.setPageIndex}
            onAdd={editor.addPage}
            onDuplicate={editor.duplicateActivePage}
            onDelete={() => editor.removePage()}
          />

          <div
            ref={canvasWrapRef}
            className="thin-scroll relative min-h-0 flex-1 overflow-auto bg-sand-100 p-4 sm:p-6"
          >
            <div className="mx-auto w-fit">
              <CanvasStage
                page={page}
                canvas={document.canvas}
                selectedId={selectedId}
                zoom={zoom}
                stageRef={stageRef}
                onSelect={editor.select}
                onGestureStart={editor.beginGesture}
                onGestureEnd={editor.endGesture}
                onChange={applyLayerPatch}
                onRequestPhoto={(layerId) => openFilePicker({ mode: "replace", layerId })}
              />
            </div>

            <div className="sticky bottom-2 mx-auto mt-3 w-fit max-w-full rounded-xl border border-sand-200 bg-card/95 px-3 py-2 text-center text-[11px] text-ink-500 shadow-sm backdrop-blur">
              {t("editor.page")} {editor.pageIndex + 1}/{editor.pageCount} ·{" "}
              {document.canvas.width}×{document.canvas.height} px
              {targetWidthMm && targetHeightMm ? (
                <> · {targetWidthMm / 10} × {targetHeightMm / 10} cm</>
              ) : null}
              {" · "}
              <strong>{exportInfo.effectiveDpi || "—"} dpi</strong>
              {emptySlots > 0 ? (
                <span className="ml-1 font-bold text-amber-700 dark:text-amber-300">
                  · {emptySlots} {t("editor.emptySlots")}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* --------------------------------------------------- Colonne droite */}
        <aside className="hidden w-72 shrink-0 flex-col border-l border-sand-200 bg-card lg:flex">
          <PriceCard
            pages={document.pages.length}
            price={price}
            format={formatLabel}
            quantity={quantity}
            onQuantity={setQuantity}
            total={orderTotalMga}
            hasProduct={hasProduct}
            onOrder={handleOrder}
            disabled={isPending || !hasProduct}
          />

          {hasProduct ? (
            <div className="shrink-0 border-b border-sand-200 p-3">
              <p className="truncate text-xs font-semibold">{context.productName}</p>
              <label className="label mt-2 text-[11px]" htmlFor="editor-variant">
                {t("editor.format")}
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
            </div>
          ) : (
            <div className="shrink-0 border-b border-sand-200 p-3">
              <p className="text-[11px] leading-relaxed text-ink-500">
                {t("editor.needProduct")}
              </p>
              <Link href="/creer" className="btn-outline mt-2 w-full py-1.5 text-xs">
                {t("nav.editor")}
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
      </div>

      {/* --------------------------------------------------- Barre mobile */}
      <nav className="grid shrink-0 grid-cols-5 border-t border-sand-200 bg-card lg:hidden">
        <MobileTab icon={BookOpen} label={t("editor.pagesShort")} onClick={() => setMobilePanel("pages")} />
        <MobileTab icon={ImagePlus} label={t("editor.tool.image")} onClick={() => setMobilePanel("tools")} />
        <MobileTab icon={Shapes} label={t("editor.tool.shape")} onClick={() => setMobilePanel("tools")} />
        <MobileTab icon={Layers} label={t("editor.layers")} onClick={() => setMobilePanel("layers")} />
        <MobileTab icon={Settings2} label={t("editor.settings")} onClick={() => setMobilePanel("settings")} />
      </nav>

      <Sheet
        open={mobilePanel !== null}
        onOpenChange={(open) => {
          if (!open) setMobilePanel(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl p-4">
          <SheetHeader className="px-0 pt-0">
            <SheetTitle>{mobilePanel ? panelTitle[mobilePanel] : ""}</SheetTitle>
            <SheetDescription>{t("editor.mobilePanelHint")}</SheetDescription>
          </SheetHeader>

          {mobilePanel === "pages" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {document.pages.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      editor.setPageIndex(index);
                      setMobilePanel(null);
                    }}
                    className={`relative aspect-[3/4] overflow-hidden rounded-lg border-2 ${
                      index === editor.pageIndex
                        ? "border-brand-600 ring-2 ring-brand-500/20"
                        : "border-sand-300"
                    }`}
                    style={{
                      background: backgroundToCss(
                        item.background,
                        72 / Math.max(1, document.canvas.width),
                      ),
                    }}
                  >
                    <span className="absolute inset-x-0 bottom-0 bg-card/90 py-0.5 text-[10px] font-bold text-ink-700">
                      {index + 1}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => editor.addPage()}
                  className="grid aspect-[3/4] place-items-center rounded-lg border-2 border-dashed border-sand-300 text-ink-500"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={editor.duplicateActivePage} className="btn-outline flex-1 text-xs">
                  <Copy className="h-3.5 w-3.5" /> {t("editor.duplicatePage")}
                </button>
                <button
                  type="button"
                  onClick={() => editor.removePage()}
                  disabled={document.pages.length <= PHOTOBOOK_MIN_PAGES}
                  className="btn-outline flex-1 text-xs text-accent-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("editor.deletePage")}
                </button>
              </div>
            </div>
          ) : null}

          {mobilePanel === "tools" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <ToolButton icon={Type} label={t("editor.addText")} onClick={() => { editor.addText(t("editor.placeholderText")); setMobilePanel(null); }} />
                <ToolButton icon={ImagePlus} label={t("editor.uploadPhoto")} onClick={() => openFilePicker({ mode: "new", crop: "none" })} disabled={uploading} />
                <ToolButton icon={Shapes} label={t("editor.tool.shape")} onClick={() => { editor.addShape("rect"); setMobilePanel(null); }} />
                <ToolButton icon={LayoutTemplate} label={t("editor.tool.template")} onClick={() => { setTemplateOpen(true); setMobilePanel(null); }} />
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  {t("editor.photoInShape")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PHOTO_SHAPES.map(({ crop, icon: Icon, key }) => (
                    <button
                      key={crop}
                      type="button"
                      onClick={() => {
                        openFilePicker({ mode: "new", crop });
                        setMobilePanel(null);
                      }}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-sand-300 text-ink-700"
                      title={t(key)}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <BackgroundControls
                  background={page.background}
                  onChange={editor.setBackground}
                />
              </div>
            </div>
          ) : null}

          {mobilePanel === "layers" ? (
            <LayersPanel
              layers={page.layers}
              selectedId={selectedId}
              onSelect={editor.select}
              onToggleVisible={(id) => {
                const layer = page.layers.find((item) => item.id === id);
                if (layer) editor.patchLayer(id, { visible: !layer.visible });
              }}
              onToggleLock={(id) => {
                const layer = page.layers.find((item) => item.id === id);
                if (layer) editor.patchLayer(id, { locked: !layer.locked });
              }}
              onMove={editor.moveLayer}
              onDuplicate={editor.duplicateLayer}
              onDelete={editor.removeLayer}
            />
          ) : null}

          {mobilePanel === "settings" ? (
            <div className="space-y-4">
              <PriceCard
                pages={document.pages.length}
                price={price}
                format={formatLabel}
                quantity={quantity}
                onQuantity={setQuantity}
                total={orderTotalMga}
                hasProduct={hasProduct}
                onOrder={handleOrder}
                disabled={isPending || !hasProduct}
              />
              <Inspector
                layer={selectedLayer}
                onPatch={applyLayerPatch}
                onGestureStart={editor.beginGesture}
                onGestureEnd={editor.endGesture}
                onReplacePhoto={(layerId) => openFilePicker({ mode: "replace", layerId })}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <TemplatePicker
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onApply={applyTemplate}
        onAddPhoto={(crop = "none") => openFilePicker({ mode: "new", crop })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Type;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn-outline w-full justify-start gap-2 py-2 text-xs"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-4 w-4 shrink-0 text-brand-600" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function MobileTab({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Type;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
    >
      <Icon className="h-4 w-4" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function PriceCard({
  pages,
  price,
  format,
  quantity,
  onQuantity,
  total,
  hasProduct,
  onOrder,
  disabled,
}: {
  pages: number;
  price: ReturnType<typeof photobookPriceBreakdown>;
  format: string | null;
  quantity: number;
  onQuantity: (value: number) => void;
  total: number;
  hasProduct: boolean;
  onOrder: () => void;
  disabled: boolean;
}) {
  const t = useT();

  return (
    <div className="shrink-0 border-b border-sand-200 p-3">
      <div className="rounded-xl bg-gradient-to-br from-brand-50 to-sand-50 p-3 ring-1 ring-brand-200/70 dark:from-brand-900/40 dark:to-sand-100 dark:ring-brand-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-700 dark:text-brand-200">
              {t("editor.price")}
            </p>
            <p className="mt-1 text-2xl font-black tracking-tight text-brand-800 dark:text-brand-100">
              {formatMga(price.totalMga)}
            </p>
            <p className="mt-1 text-[11px] text-ink-500">
              {pages} {t("editor.pagesShort")} · {price.includedPages}{" "}
              {t("editor.includedPages")} + {price.extraPages} ×{" "}
              {formatMga(PHOTOBOOK_EXTRA_PAGE_MGA)}
            </p>
            {price.coverExtraMga > 0 ? (
              <p className="mt-0.5 text-[11px] text-ink-500">
                + {t("editor.coverExtra")} · {formatMga(price.coverExtraMga)}
              </p>
            ) : null}
          </div>
          <span className="rounded-full bg-card/80 px-2 py-1 text-[10px] font-bold text-brand-700 ring-1 ring-brand-200 dark:text-brand-200">
            {format ?? "A4"}
          </span>
        </div>

        <div className="mt-3 flex items-end gap-2 border-t border-brand-200/60 pt-3 dark:border-brand-800">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-500" htmlFor="editor-qty">
            {t("common.quantity")}
          </label>
          <input
            id="editor-qty"
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(event) =>
              onQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))
            }
            className="input w-16 px-2 py-1 text-xs"
          />
          <span className="ml-auto text-xs font-semibold text-ink-700">
            {formatMga(total)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOrder}
        disabled={disabled}
        className="btn-accent mt-2 w-full py-2.5 text-sm"
        title={hasProduct ? undefined : t("editor.needProduct")}
      >
        <ShoppingBag className="h-4 w-4" /> {t("editor.order")}
      </button>
      <p className="mt-2 text-center text-[10px] leading-relaxed text-ink-500">
        {formatMga(PHOTOBOOK_BASE_PRICE_MGA)} · {PHOTOBOOK_MIN_PAGES}{" "}
        {t("editor.pagesShort")} {t("editor.includedPages")}
      </p>
    </div>
  );
}
