"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  DEFAULT_FILTERS,
  createId,
  type EditorDocument,
  type ImageLayer,
  type Layer,
  type ShapeLayer,
  type TextLayer,
} from "@/lib/editor/types";
import { makeImageLayer, makeShapeLayer, makeTextLayer } from "@/lib/editor/templates";

const HISTORY_LIMIT = 60;

export type EditorApi = ReturnType<typeof useEditor>;

export function useEditor(initial: EditorDocument) {
  const [document, setDocument] = useState<EditorDocument>(initial);
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
  const update = useCallback((updater: (current: EditorDocument) => EditorDocument) => {
    setDocument((current) => updater(current));
    setDirty(true);
  }, []);

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

  // ------------------------------------------------------------------ calques

  const addLayer = useCallback(
    (layer: Layer, options: { select?: boolean } = {}) => {
      commit((current) => ({ ...current, layers: [...current.layers, layer] }));
      if (options.select !== false) setSelectedId(layer.id);
      return layer;
    },
    [commit],
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
    (src: string, uploadPath: string) => {
      const canvas = documentRef.current.canvas;
      const width = Math.round(canvas.width * 0.5);
      const height = Math.round(canvas.height * 0.5);

      return addLayer(
        makeImageLayer({
          src,
          uploadPath,
          width,
          height,
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
      const apply = (current: EditorDocument): EditorDocument => ({
        ...current,
        layers: current.layers.map((layer) =>
          layer.id === id ? ({ ...layer, ...patch } as Layer) : layer,
        ),
      });

      if (options.history === false) {
        update(apply);
      } else {
        commit(apply);
      }
    },
    [commit, update],
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
      commit((current) => ({
        ...current,
        layers: current.layers.filter((layer) => layer.id !== id),
      }));
      setSelectedId((current) => (current === id ? null : current));
    },
    [commit],
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const source = documentRef.current.layers.find((layer) => layer.id === id);
      if (!source) return;

      const clone = { ...source, id: createId(), x: source.x + 24, y: source.y + 24 } as Layer;
      commit((current) => ({ ...current, layers: [...current.layers, clone] }));
      setSelectedId(clone.id);
    },
    [commit],
  );

  const moveLayer = useCallback(
    (id: string, direction: "up" | "down") => {
      commit((current) => {
        const index = current.layers.findIndex((layer) => layer.id === id);
        if (index === -1) return current;

        const target = direction === "up" ? index + 1 : index - 1;
        if (target < 0 || target >= current.layers.length) return current;

        const layers = [...current.layers];
        const [moved] = layers.splice(index, 1);
        layers.splice(target, 0, moved);

        return { ...current, layers };
      });
    },
    [commit],
  );

  const setBackground = useCallback(
    (background: string) => {
      commit((current) => ({
        ...current,
        canvas: { ...current.canvas, background },
      }));
    },
    [commit],
  );

  const replaceDocument = useCallback(
    (next: EditorDocument) => {
      pushHistory(documentRef.current);
      setDocument(next);
      setSelectedId(null);
      setDirty(true);
    },
    [pushHistory],
  );

  /** Rattache le plan de travail au format réel choisi (pour l'export 300 dpi). */
  const resizeCanvas = useCallback(
    (width: number, height: number) => {
      commit((current) => ({ ...current, canvas: { ...current.canvas, width, height } }));
    },
    [commit],
  );

  const selectedLayer = useMemo(
    () => document.layers.find((layer) => layer.id === selectedId) ?? null,
    [document.layers, selectedId],
  );

  return {
    document,
    selectedId,
    selectedLayer,
    dirty,
    markClean: () => setDirty(false),
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
    resizeCanvas,
    beginGesture,
    endGesture,
    undo,
    redo,
  };
}
