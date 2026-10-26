"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { PageBackground } from "@/lib/editor/background";
import {
  DEFAULT_FILTERS,
  createId,
  createPage,
  duplicatePage,
  ensurePageCount,
  type EditorDocument,
  type EditorPage,
  type ImageCrop,
  type ImageLayer,
  type Layer,
  type ShapeLayer,
  type TextLayer,
} from "@/lib/editor/types";
import { makeImageLayer, makeShapeLayer, makeTextLayer } from "@/lib/editor/templates";

const HISTORY_LIMIT = 60;

export type EditorApi = ReturnType<typeof useEditor>;

type EditorOptions = {
  /** Nombre de pages incompressible (20 pour un photobook). */
  minPages?: number;
  /** Nombre de pages maximal (300 pour un photobook). */
  maxPages?: number;
};

export function useEditor(initial: EditorDocument, options: EditorOptions = {}) {
  const minPages = Math.max(1, options.minPages ?? 1);
  const maxPages = Math.max(minPages, options.maxPages ?? Number.POSITIVE_INFINITY);

  const [document, setDocument] = useState<EditorDocument>(() =>
    ensurePageCount(initial, minPages),
  );
  const [pageIndex, setPageIndexState] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const documentRef = useRef(document);
  documentRef.current = document;

  const past = useRef<EditorDocument[]>([]);
  const future = useRef<EditorDocument[]>([]);
  // Instantané pris au début d'un geste (glisser, redimensionner) : on ne
  // pousse qu'une seule entrée d'historique pour tout le geste.
  const gestureSnapshot = useRef<EditorDocument | null>(null);
  const [, forceHistoryRender] = useState(0);

  const safePageIndex = Math.min(pageIndex, document.pages.length - 1);
  const page: EditorPage = document.pages[safePageIndex] ?? document.pages[0];

  const bumpHistory = useCallback(() => {
    forceHistoryRender((value) => value + 1);
  }, []);

  const pushHistory = useCallback(
    (snapshot: EditorDocument) => {
      past.current.push(snapshot);
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
      future.current = [];
      bumpHistory();
    },
    [bumpHistory],
  );

  /** Modification ponctuelle, enregistrée dans l'historique. */
  const commit = useCallback(
    (updater: (current: EditorDocument) => EditorDocument) => {
      const previous = documentRef.current;
      const next = updater(previous);
      if (next === previous) return;

      pushHistory(previous);
      setDocument(next);
      setDirty(true);
    },
    [pushHistory],
  );

  /** Modification continue (pendant un glisser) : pas d'historique. */
  const update = useCallback(
    (updater: (current: EditorDocument) => EditorDocument) => {
      setDocument((current) => updater(current));
      setDirty(true);
    },
    [],
  );

  /** Applique une modification à la page active uniquement. */
  const mapActivePage = useCallback(
    (updater: (page: EditorPage) => EditorPage) => {
      return (current: EditorDocument): EditorDocument => {
        const index = Math.min(pageIndex, current.pages.length - 1);
        return {
          ...current,
          pages: current.pages.map((item, itemIndex) =>
            itemIndex === index ? updater(item) : item,
          ),
        };
      };
    },
    [pageIndex],
  );

  const beginGesture = useCallback(() => {
    gestureSnapshot.current = documentRef.current;
  }, []);

  const endGesture = useCallback(() => {
    if (gestureSnapshot.current) {
      pushHistory(gestureSnapshot.current);
      gestureSnapshot.current = null;
    }
  }, [pushHistory]);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;

    future.current.push(documentRef.current);
    setDocument(previous);
    setDirty(true);
    bumpHistory();
  }, [bumpHistory]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;

    past.current.push(documentRef.current);
    setDocument(next);
    setDirty(true);
    bumpHistory();
  }, [bumpHistory]);

  const select = useCallback((id: string | null) => setSelectedId(id), []);

  const setPageIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(documentRef.current.pages.length - 1, index));
      setPageIndexState(clamped);
      setSelectedId(null);
    },
    [],
  );

  // ------------------------------------------------------------------- pages

  const addPage = useCallback(() => {
    if (documentRef.current.pages.length >= maxPages) return;

    const index = Math.min(pageIndex, documentRef.current.pages.length - 1);
    const background =
      documentRef.current.pages[index]?.background ?? "#ffffff";
    const nextIndex = documentRef.current.pages.length;

    commit((current) => ({
      ...current,
      pages: [...current.pages, createPage(background)],
    }));
    setPageIndexState(nextIndex);
    setSelectedId(null);
  }, [commit, maxPages, pageIndex]);

  const duplicateActivePage = useCallback(() => {
    if (documentRef.current.pages.length >= maxPages) return;

    const index = Math.min(pageIndex, documentRef.current.pages.length - 1);
    const source = documentRef.current.pages[index];
    if (!source) return;

    commit((current) => {
      const pages = [...current.pages];
      pages.splice(index + 1, 0, duplicatePage(source));
      return { ...current, pages };
    });
    setPageIndexState(index + 1);
    setSelectedId(null);
  }, [commit, maxPages, pageIndex]);

  const removePage = useCallback(
    (index = pageIndex) => {
      if (documentRef.current.pages.length <= minPages) return false;

      const target = Math.max(
        0,
        Math.min(documentRef.current.pages.length - 1, index),
      );

      commit((current) => ({
        ...current,
        pages: current.pages.filter((_, itemIndex) => itemIndex !== target),
      }));

      setPageIndexState(Math.max(0, Math.min(target, documentRef.current.pages.length - 2)));
      setSelectedId(null);
      return true;
    },
    [commit, minPages, pageIndex],
  );

  // ------------------------------------------------------------------ calques

  const addLayer = useCallback(
    (layer: Layer, options: { select?: boolean } = {}) => {
      commit(mapActivePage((current) => ({ ...current, layers: [...current.layers, layer] })));
      if (options.select !== false) setSelectedId(layer.id);
      return layer;
    },
    [commit, mapActivePage],
  );

  const addText = useCallback(
    (text: string) => {
      const canvas = documentRef.current.canvas;
      return addLayer(
        makeTextLayer({
          text,
          x: Math.round(canvas.width * 0.1),
          y: Math.round(canvas.height * 0.4),
          width: Math.round(canvas.width * 0.8),
          fontSize: Math.round(canvas.width / 14),
        }),
      );
    },
    [addLayer],
  );

  const addImage = useCallback(
    (src: string, uploadPath: string, crop: ImageCrop = "none") => {
      const canvas = documentRef.current.canvas;
      const width = Math.round(canvas.width * 0.5);
      const height = Math.round(canvas.height * 0.5);

      return addLayer(
        makeImageLayer({
          src,
          uploadPath,
          width,
          height,
          crop,
          cornerRadius:
            crop === "rounded" ? Math.round(Math.min(width, height) * 0.16) : 0,
          x: Math.round((canvas.width - width) / 2),
          y: Math.round((canvas.height - height) / 2),
          filters: { ...DEFAULT_FILTERS },
        }),
      );
    },
    [addLayer],
  );

  const addShape = useCallback(
    (shape: ShapeLayer["shape"]) => {
      const canvas = documentRef.current.canvas;
      const size = Math.round(Math.min(canvas.width, canvas.height) * 0.35);

      return addLayer(
        makeShapeLayer({
          shape,
          width: shape === "line" ? Math.round(canvas.width * 0.6) : size,
          height: shape === "line" ? 8 : size,
          x: Math.round((canvas.width - (shape === "line" ? canvas.width * 0.6 : size)) / 2),
          y: Math.round((canvas.height - (shape === "line" ? 8 : size)) / 2),
          cornerRadius: shape === "rect" ? 8 : 0,
        }),
      );
    },
    [addLayer],
  );

  const patchLayer = useCallback(
    (id: string, patch: Partial<Layer>, options: { history?: boolean } = {}) => {
      const apply = mapActivePage((current) => ({
        ...current,
        layers: current.layers.map((layer) =>
          layer.id === id ? ({ ...layer, ...patch } as Layer) : layer,
        ),
      }));

      if (options.history === false) {
        update(apply);
      } else {
        commit(apply);
      }
    },
    [commit, mapActivePage, update],
  );

  const patchText = useCallback(
    (id: string, patch: Partial<TextLayer>, options?: { history?: boolean }) =>
      patchLayer(id, patch as Partial<Layer>, options),
    [patchLayer],
  );

  const patchImage = useCallback(
    (id: string, patch: Partial<ImageLayer>, options?: { history?: boolean }) =>
      patchLayer(id, patch as Partial<Layer>, options),
    [patchLayer],
  );

  const patchShape = useCallback(
    (id: string, patch: Partial<ShapeLayer>, options?: { history?: boolean }) =>
      patchLayer(id, patch as Partial<Layer>, options),
    [patchLayer],
  );

  const removeLayer = useCallback(
    (id: string) => {
      commit(
        mapActivePage((current) => ({
          ...current,
          layers: current.layers.filter((layer) => layer.id !== id),
        })),
      );
      setSelectedId((current) => (current === id ? null : current));
    },
    [commit, mapActivePage],
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const source = page.layers.find((layer) => layer.id === id);
      if (!source) return;

      const clone = {
        ...source,
        id: createId(source.type),
        x: source.x + 24,
        y: source.y + 24,
      } as Layer;

      commit(
        mapActivePage((current) => ({
          ...current,
          layers: [...current.layers, clone],
        })),
      );
      setSelectedId(clone.id);
    },
    [commit, mapActivePage, page.layers],
  );

  const moveLayer = useCallback(
    (id: string, direction: "up" | "down") => {
      commit(
        mapActivePage((current) => {
          const index = current.layers.findIndex((layer) => layer.id === id);
          if (index === -1) return current;

          const target = direction === "up" ? index + 1 : index - 1;
          if (target < 0 || target >= current.layers.length) return current;

          const layers = [...current.layers];
          const [moved] = layers.splice(index, 1);
          layers.splice(target, 0, moved);

          return { ...current, layers };
        }),
      );
    },
    [commit, mapActivePage],
  );

  const setBackground = useCallback(
    (background: PageBackground) => {
      commit(mapActivePage((current) => ({ ...current, background })));
    },
    [commit, mapActivePage],
  );

  const replaceDocument = useCallback(
    (next: EditorDocument) => {
      pushHistory(documentRef.current);
      setDocument(ensurePageCount(next, minPages));
      setPageIndexState(0);
      setSelectedId(null);
      setDirty(true);
    },
    [minPages, pushHistory],
  );

  /** Remplace uniquement le contenu de la page active (application d'un modèle). */
  const replaceActivePage = useCallback(
    (nextPage: EditorPage) => {
      commit(
        mapActivePage((current) => ({
          id: current.id,
          background: nextPage.background,
          layers: nextPage.layers,
        })),
      );
      setSelectedId(null);
    },
    [commit, mapActivePage],
  );

  const markClean = useCallback(() => setDirty(false), []);
  /** Signale une modification hors document (titre) pour l'autosauvegarde. */
  const markDirty = useCallback(() => setDirty(true), []);

  /** Rattache le plan de travail au format réel choisi (pour l'export 300 dpi). */
  const resizeCanvas = useCallback(
    (width: number, height: number) => {
      commit((current) => ({
        ...current,
        canvas: { ...current.canvas, width, height },
      }));
    },
    [commit],
  );

  const selectedLayer = useMemo(
    () => page.layers.find((layer) => layer.id === selectedId) ?? null,
    [page.layers, selectedId],
  );

  return {
    document,
    page,
    pages: document.pages,
    pageIndex: safePageIndex,
    pageCount: document.pages.length,
    selectedId,
    selectedLayer,
    dirty,
    markClean,
    markDirty,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    setBackground,
    select,
    addText,
    addImage,
    addShape,
    patchLayer,
    patchText,
    patchImage,
    patchShape,
    removeLayer,
    duplicateLayer,
    moveLayer,
    replaceDocument,
    replaceActivePage,
    resizeCanvas,
    setPageIndex,
    addPage,
    duplicateActivePage,
    removePage,
    minimumPages: minPages,
    maximumPages: maxPages,
    beginGesture,
    endGesture,
    undo,
    redo,
  };
}
