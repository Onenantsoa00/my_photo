"use client";

import Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Ellipse, Group, Image as KonvaImage, Layer, Rect, RegularPolygon, Stage, Star, Text, Transformer } from "react-konva";

import type {
  EditorDocument,
  ImageFilters,
  ImageLayer,
  Layer as LayerModel,
  ShapeLayer,
  TextLayer,
} from "@/lib/editor/types";

// ---------------------------------------------------------------------------
// Chargement des images
// ---------------------------------------------------------------------------

function useHtmlImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    let cancelled = false;
    const element = new window.Image();
    element.crossOrigin = "anonymous";

    element.onload = () => {
      if (!cancelled) setImage(element);
    };
    element.onerror = () => {
      if (!cancelled) setImage(null);
    };
    element.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return image;
}

function hasActiveFilters(filters: ImageFilters): boolean {
  return (
    filters.brightness !== 0 ||
    filters.contrast !== 0 ||
    filters.saturation !== 0 ||
    filters.blur !== 0 ||
    filters.grayscale ||
    filters.sepia
  );
}

// ---------------------------------------------------------------------------
// Types d'événements
// ---------------------------------------------------------------------------

export type LayerPatch = Partial<LayerModel>;

export type CanvasStageProps = {
  document: EditorDocument;
  selectedId: string | null;
  zoom: number;
  stageRef: React.RefObject<Konva.Stage | null>;
  onSelect: (id: string | null) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  /** Modification live, sans historique. */
  onChange: (id: string, patch: LayerPatch) => void;
};

const IMAGE_FILTER_LIST = [
  Konva.Filters.Brighten,
  Konva.Filters.Contrast,
  Konva.Filters.HSL,
  Konva.Filters.Blur,
  Konva.Filters.Grayscale,
  Konva.Filters.Sepia,
];

// ---------------------------------------------------------------------------
// Rendu des calques
// ---------------------------------------------------------------------------

function ImageNode({
  layer,
  onChange,
  onGestureStart,
  onGestureEnd,
  onSelect,
}: {
  layer: ImageLayer;
  onChange: CanvasStageProps["onChange"];
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onSelect: (id: string | null) => void;
}) {
  const image = useHtmlImage(layer.src);
  const nodeRef = useRef<Konva.Image | null>(null);
  const filters = layer.filters;

  // Konva applique les filtres sur un cache hors écran : il faut le
  // reconstruire à chaque changement de réglage.
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    if (image && hasActiveFilters(filters)) {
      node.cache();
    } else {
      node.clearCache();
    }

    node.getLayer()?.batchDraw();
  }, [
    image,
    filters.brightness,
    filters.contrast,
    filters.saturation,
    filters.blur,
    filters.grayscale,
    filters.sepia,
  ]);

  const shared = {
    id: layer.id,
    name: layer.id,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    opacity: layer.opacity,
    visible: layer.visible,
    draggable: !layer.locked,
    onMouseDown: () => onSelect(layer.id),
    onTap: () => onSelect(layer.id),
    onDragStart: onGestureStart,
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      onChange(layer.id, { x: event.target.x(), y: event.target.y() });
      onGestureEnd();
    },
    onTransformStart: onGestureStart,
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      const node = event.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      node.scaleX(1);
      node.scaleY(1);

      onChange(layer.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(10, layer.width * scaleX),
        height: Math.max(10, layer.height * scaleY),
      });
      onGestureEnd();
    },
  };

  if (!image) {
    // Emplacement vide : cadre pointillé cliquable pour envoyer une photo.
    return (
      <Group {...shared}>
        <Rect
          width={layer.width}
          height={layer.height}
          cornerRadius={layer.cornerRadius}
          fill="#f1f5f9"
          stroke="#94a3b8"
          strokeWidth={2}
          dash={[12, 8]}
        />
        <Text
          width={layer.width}
          height={layer.height}
          align="center"
          verticalAlign="middle"
          text="＋"
          fontSize={Math.min(layer.width, layer.height) * 0.3}
          fill="#94a3b8"
        />
      </Group>
    );
  }

  return (
    <KonvaImage
      {...shared}
      ref={nodeRef}
      image={image}
      width={layer.width}
      height={layer.height}
      cornerRadius={layer.cornerRadius}
      filters={IMAGE_FILTER_LIST}
      brightness={filters.brightness}
      contrast={filters.contrast}
      saturation={filters.saturation}
      blurRadius={filters.blur}
      grayscale={filters.grayscale ? "grayscale" : undefined}
      sepia={filters.sepia ? "sepia" : undefined}
    />
  );
}

function ShapeNode({
  layer,
  onChange,
  onGestureStart,
  onGestureEnd,
  onSelect,
}: {
  layer: ShapeLayer;
  onChange: CanvasStageProps["onChange"];
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onSelect: (id: string | null) => void;
}) {
  const stroke = layer.stroke === "transparent" ? undefined : layer.stroke;

  const shared = {
    id: layer.id,
    name: layer.id,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    opacity: layer.opacity,
    visible: layer.visible,
    draggable: !layer.locked,
    onMouseDown: () => onSelect(layer.id),
    onTap: () => onSelect(layer.id),
    onDragStart: onGestureStart,
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      onChange(layer.id, { x: event.target.x(), y: event.target.y() });
      onGestureEnd();
    },
    onTransformStart: onGestureStart,
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      const node = event.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      node.scaleX(1);
      node.scaleY(1);

      onChange(layer.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(8, layer.width * scaleX),
        height: Math.max(8, layer.height * scaleY),
      });
      onGestureEnd();
    },
  };

  const { width, height, fill, strokeWidth, cornerRadius, shape } = layer;

  if (shape === "rect" || shape === "line") {
    return (
      <Rect
        {...shared}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={cornerRadius}
      />
    );
  }

  // Les formes centrées (ellipse, triangle, étoile) sont enveloppées dans un
  // groupe : le groupe est ancré en haut à gauche comme les autres calques, ce
  // qui rend la transformation homogène.
  const radius = Math.min(width, height) / 2;

  return (
    <Group {...shared}>
      {shape === "ellipse" ? (
        <Ellipse
          x={width / 2}
          y={height / 2}
          radiusX={width / 2}
          radiusY={height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          cornerRadius={cornerRadius}
        />
      ) : null}

      {shape === "triangle" ? (
        <RegularPolygon
          x={width / 2}
          y={height / 2}
          sides={3}
          radius={radius}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ) : null}

      {shape === "star" ? (
        <Star
          x={width / 2}
          y={height / 2}
          numPoints={5}
          innerRadius={radius * 0.45}
          outerRadius={radius}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ) : null}
    </Group>
  );
}

function TextNode({
  layer,
  onChange,
  onGestureStart,
  onGestureEnd,
  onSelect,
}: {
  layer: TextLayer;
  onChange: CanvasStageProps["onChange"];
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onSelect: (id: string | null) => void;
}) {
  return (
    <Text
      id={layer.id}
      name={layer.id}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      text={layer.text}
      fontFamily={layer.fontFamily}
      fontSize={layer.fontSize}
      fontStyle={layer.fontStyle}
      align={layer.align}
      fill={layer.fill}
      lineHeight={layer.lineHeight}
      letterSpacing={layer.letterSpacing}
      onMouseDown={() => onSelect(layer.id)}
      onTap={() => onSelect(layer.id)}
      onDragStart={onGestureStart}
      onDragEnd={(event) => {
        onChange(layer.id, { x: event.target.x(), y: event.target.y() });
        onGestureEnd();
      }}
      onTransformStart={onGestureStart}
      onTransformEnd={(event) => {
        const node = event.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        node.scaleX(1);
        node.scaleY(1);

        // Redimensionner un texte change le corps de la police, pas la boîte :
        // on ne met à l'échelle que la largeur, la hauteur suit le texte.
        onChange(layer.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(24, layer.width * scaleX),
          fontSize: Math.max(6, layer.fontSize * scaleY),
        });
        onGestureEnd();
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Scène
// ---------------------------------------------------------------------------

export default function CanvasStage({
  document,
  selectedId,
  zoom,
  stageRef,
  onSelect,
  onGestureStart,
  onGestureEnd,
  onChange,
}: CanvasStageProps) {
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const { width, height, background } = document.canvas;

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (!selectedId) {
      transformer.nodes([]);
      return;
    }

    const node = stage.findOne(`#${selectedId}`);
    const model = document.layers.find((layer) => layer.id === selectedId);

    if (!node || (model && (model.locked || !model.visible))) {
      transformer.nodes([]);
      return;
    }

    transformer.nodes([node]);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, document.layers, stageRef, zoom]);

  return (
    <Stage
      ref={stageRef}
      width={width * zoom}
      height={height * zoom}
      scaleX={zoom}
      scaleY={zoom}
      onMouseDown={(event) => {
        // Un clic sur le fond (la scène elle-même) désélectionne.
        if (event.target === event.target.getStage()) onSelect(null);
      }}
      onTouchStart={(event) => {
        if (event.target === event.target.getStage()) onSelect(null);
      }}
      className="bg-white shadow-xl ring-1 ring-sand-300"
    >
      <Layer listening={false}>
        <Rect x={0} y={0} width={width} height={height} fill={background} />
      </Layer>

      <Layer>
        {document.layers.map((layer) => {
          if (!layer.visible) return null;

          if (layer.type === "text") {
            return (
              <TextNode
                key={layer.id}
                layer={layer}
                onChange={onChange}
                onGestureStart={onGestureStart}
                onGestureEnd={onGestureEnd}
                onSelect={onSelect}
              />
            );
          }

          if (layer.type === "image") {
            return (
              <ImageNode
                key={layer.id}
                layer={layer}
                onChange={onChange}
                onGestureStart={onGestureStart}
                onGestureEnd={onGestureEnd}
                onSelect={onSelect}
              />
            );
          }

          return (
            <ShapeNode
              key={layer.id}
              layer={layer}
              onChange={onChange}
              onGestureStart={onGestureStart}
              onGestureEnd={onGestureEnd}
              onSelect={onSelect}
            />
          );
        })}

        <Transformer
          ref={transformerRef}
          rotateEnabled
          keepRatio={false}
          anchorSize={10}
          anchorStroke="#127f53"
          anchorFill="#ffffff"
          borderStroke="#127f53"
          borderDash={[4, 4]}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 12 || Math.abs(newBox.height) < 12) {
              return oldBox;
            }
            return newBox;
          }}
        />
      </Layer>
    </Stage>
  );
}
