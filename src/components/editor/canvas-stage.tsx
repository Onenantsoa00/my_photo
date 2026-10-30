"use client";

import Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Rect,
  RegularPolygon,
  Stage,
  Star,
  Text,
  Transformer,
} from "react-konva";

import {
  gradientEndpoints,
  patternTile,
  type PageBackground,
} from "@/lib/editor/background";
import {
  imageLayout,
  type EditorPage,
  type ImageCrop,
  type ImageFilters,
  type ImageLayer,
  type Layer as LayerModel,
  type ShapeLayer,
  type TextLayer,
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
// Découpes
// ---------------------------------------------------------------------------

function drawCrop(
  ctx: Konva.Context,
  width: number,
  height: number,
  crop: ImageCrop,
) {
  const w = width;
  const h = height;

  ctx.beginPath();

  if (crop === "circle") {
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (crop === "heart") {
    ctx.moveTo(w / 2, h * 0.92);
    ctx.bezierCurveTo(w * 0.08, h * 0.56, w * 0.02, h * 0.12, w * 0.3, h * 0.07);
    ctx.bezierCurveTo(w * 0.42, h * 0.04, w * 0.5, h * 0.16, w * 0.5, h * 0.24);
    ctx.bezierCurveTo(w * 0.5, h * 0.16, w * 0.58, h * 0.04, w * 0.7, h * 0.07);
    ctx.bezierCurveTo(w * 0.98, h * 0.12, w * 0.92, h * 0.56, w * 0.5, h * 0.92);
  } else if (crop === "diamond") {
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(0, h / 2);
  } else if (crop === "star") {
    const cx = w / 2;
    const cy = h / 2;
    const outer = Math.min(w, h) / 2;
    const inner = outer * 0.45;

    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? outer : inner;
      const angle = (Math.PI / 5) * index - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  } else {
    ctx.rect(0, 0, w, h);
  }

  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Fond de page
// ---------------------------------------------------------------------------

/**
 * Le fond part à l'impression : il est donc dessiné dans Konva, pas derrière
 * le canevas. Uni, dégradé ou motif répété selon le choix du client.
 */
function BackgroundNode({
  background,
  width,
  height,
}: {
  background: PageBackground;
  width: number;
  height: number;
}) {
  const tile = useMemo(
    () => (background.kind === "pattern" ? patternTile(background) : null),
    [background],
  );

  if (background.kind === "gradient") {
    const points = gradientEndpoints(background, width, height);

    return (
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fillLinearGradientStartPoint={{ x: points.x1, y: points.y1 }}
        fillLinearGradientEndPoint={{ x: points.x2, y: points.y2 }}
        fillLinearGradientColorStops={[0, background.from, 1, background.to]}
      />
    );
  }

  if (background.kind === "pattern") {
    return (
      <>
        <Rect x={0} y={0} width={width} height={height} fill={background.surface} />
        {tile ? (
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            // Konva accepte un canevas pour un motif répété, les types de
            // react-konva ne déclarent que HTMLImageElement.
            fillPatternImage={tile as unknown as HTMLImageElement}
            fillPatternRepeat="repeat"
            // Même décalage que la vignette DOM : le motif s'ajuste à la page.
            fillPatternOffset={{
              x: (background.offsetX ?? 0) % Math.max(8, background.size),
              y: (background.offsetY ?? 0) % Math.max(8, background.size),
            }}
          />
        ) : null}
      </>
    );
  }

  return <Rect x={0} y={0} width={width} height={height} fill={background.color} />;
}

// ---------------------------------------------------------------------------
// Types d'événements
// ---------------------------------------------------------------------------

export type LayerPatch = Partial<LayerModel>;

export type CanvasStageProps = {
  page: EditorPage;
  canvas: { width: number; height: number };
  selectedId: string | null;
  zoom: number;
  stageRef: React.RefObject<Konva.Stage | null>;
  onSelect: (id: string | null) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  /** Modification live, sans historique. */
  onChange: (id: string, patch: LayerPatch) => void;
  /** Emplacement photo vide : ouvrir le sélecteur de fichier. */
  onRequestPhoto: (id: string) => void;
};

const IMAGE_FILTER_LIST = [
  Konva.Filters.Brighten,
  Konva.Filters.Contrast,
  Konva.Filters.HSL,
  Konva.Filters.Blur,
  Konva.Filters.Grayscale,
  Konva.Filters.Sepia,
];

function transformPatch(
  layer: ImageLayer | ShapeLayer,
  node: Konva.Node,
  minimum = 10,
): LayerPatch {
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();

  node.scaleX(1);
  node.scaleY(1);

  return {
    x: node.x(),
    y: node.y(),
    rotation: node.rotation(),
    width: Math.max(minimum, layer.width * scaleX),
    height: Math.max(minimum, layer.height * scaleY),
  };
}

// ---------------------------------------------------------------------------
// Rendu des calques
// ---------------------------------------------------------------------------

function ImageNode({
  layer,
  onChange,
  onGestureStart,
  onGestureEnd,
  onSelect,
  onRequestPhoto,
}: {
  layer: ImageLayer;
  onChange: CanvasStageProps["onChange"];
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onSelect: (id: string | null) => void;
  onRequestPhoto: (id: string) => void;
}) {
  const image = useHtmlImage(layer.src);
  const nodeRef = useRef<Konva.Image | null>(null);
  const filters = layer.filters;
  const masked = layer.crop !== "none" && layer.crop !== "rounded";

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
    // Un emplacement vide est une invitation : un clic ou un tap ouvre la
    // galerie / le sélecteur de fichier du téléphone.
    onTap: image
      ? () => onSelect(layer.id)
      : () => {
          if (!layer.locked) onRequestPhoto(layer.id);
        },
    onClick: image
      ? undefined
      : () => {
          if (!layer.locked) onRequestPhoto(layer.id);
        },
    onDragStart: onGestureStart,
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      onChange(layer.id, { x: event.target.x(), y: event.target.y() });
      onGestureEnd();
    },
    onTransformStart: onGestureStart,
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      onChange(layer.id, transformPatch(layer, event.target));
      onGestureEnd();
    },
  };

  if (!image) {
    // Emplacement vide : cadre pointillé cliquable pour envoyer une photo.
    if (masked) {
      return (
        <Group
          {...shared}
          clipFunc={(ctx: Konva.Context) =>
            drawCrop(ctx, layer.width, layer.height, layer.crop)
          }
        >
          <Rect width={layer.width} height={layer.height} fill="#f1f5f9" />
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

  // Cadrage choisi par le client : la fenêtre source est calculée pour que le
  // nœud garde exactement la taille du cadre (aucun débordement de la forme).
  const layout = imageLayout(layer, {
    width: image.naturalWidth || image.width || layer.width,
    height: image.naturalHeight || image.height || layer.height,
  });

  const imageProps = {
    ref: nodeRef,
    image,
    x: layout.node.x,
    y: layout.node.y,
    width: layout.node.width,
    height: layout.node.height,
    crop: layout.source,
    filters: IMAGE_FILTER_LIST,
    brightness: filters.brightness,
    contrast: filters.contrast,
    saturation: filters.saturation,
    blurRadius: filters.blur,
    grayscale: filters.grayscale ? "grayscale" : undefined,
    sepia: filters.sepia ? "sepia" : undefined,
  } as const;

  if (masked) {
    return (
      <Group
        {...shared}
        clipFunc={(ctx: Konva.Context) =>
          drawCrop(ctx, layer.width, layer.height, layer.crop)
        }
      >
        <KonvaImage {...imageProps} cornerRadius={0} />
      </Group>
    );
  }

  return <KonvaImage {...shared} {...imageProps} cornerRadius={layer.cornerRadius} />;
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
      onChange(layer.id, transformPatch(layer, event.target, 8));
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
  page,
  canvas,
  selectedId,
  zoom,
  stageRef,
  onSelect,
  onGestureStart,
  onGestureEnd,
  onChange,
  onRequestPhoto,
}: CanvasStageProps) {
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const { width, height } = canvas;

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (!selectedId) {
      transformer.nodes([]);
      return;
    }

    const node = stage.findOne(`#${selectedId}`);
    const model = page.layers.find((layer) => layer.id === selectedId);

    if (!node || (model && (model.locked || !model.visible))) {
      transformer.nodes([]);
      return;
    }

    transformer.nodes([node]);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, page.layers, stageRef, zoom]);

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
        <BackgroundNode background={page.background} width={width} height={height} />
      </Layer>

      <Layer>
        {page.layers.map((layer) => {
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
                onRequestPhoto={onRequestPhoto}
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
