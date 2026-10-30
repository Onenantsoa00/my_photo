"use client";

import { backgroundToCss } from "@/lib/editor/background";
import type { EditorDocument, ImageCrop, Layer } from "@/lib/editor/types";

/**
 * Rendu CSS d'un document de l'atelier, sans Konva.
 *
 * Sert aux vignettes de modèles (assistant de création et sélecteur de modèles
 * de l'atelier) : le rendu est instantané, ne charge pas react-konva et reste
 * utilisable côté serveur comme côté navigateur.
 */
export function TemplatePreview({
  document,
  width = 260,
  pageIndex = 0,
}: {
  document: EditorDocument;
  width?: number;
  pageIndex?: number;
}) {
  const scale = width / document.canvas.width;
  const page = document.pages[Math.min(pageIndex, document.pages.length - 1)];

  return (
    <div
      className="relative overflow-hidden rounded-lg ring-1 ring-sand-300"
      style={{
        width,
        height: document.canvas.height * scale,
        background: page ? backgroundToCss(page.background, scale) : "#ffffff",
      }}
    >
      {(page?.layers ?? []).map((layer) => (
        <PreviewLayer key={layer.id} layer={layer} scale={scale} />
      ))}
    </div>
  );
}

function cropStyle(crop: ImageCrop): React.CSSProperties {
  switch (crop) {
    case "circle":
      return { borderRadius: "50%" };
    case "heart":
      return {
        clipPath:
          "polygon(50% 92%, 6% 54%, 2% 26%, 12% 8%, 30% 4%, 42% 10%, 50% 22%, 58% 10%, 70% 4%, 88% 8%, 98% 26%, 94% 54%)",
      };
    case "star":
      return {
        clipPath:
          "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
      };
    case "diamond":
      return { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" };
    default:
      return {};
  }
}

function PreviewLayer({ layer, scale }: { layer: Layer; scale: number }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: layer.x * scale,
    top: layer.y * scale,
    width: layer.width * scale,
    height: layer.height * scale,
    opacity: layer.opacity,
    transform: `rotate(${layer.rotation}deg)`,
    overflow: "hidden",
  };

  if (layer.type === "text") {
    return (
      <div
        style={{
          ...style,
          color: layer.fill,
          fontFamily: layer.fontFamily,
          fontSize: layer.fontSize * scale,
          fontWeight: layer.fontStyle === "bold" ? 700 : 400,
          fontStyle: layer.fontStyle === "italic" ? "italic" : "normal",
          textAlign: layer.align,
          lineHeight: layer.lineHeight,
          whiteSpace: "pre-wrap",
        }}
      >
        {layer.text}
      </div>
    );
  }

  if (layer.type === "image") {
    const crop = cropStyle(layer.crop);

    return (
      <div
        style={{
          ...style,
          borderRadius:
            layer.crop === "circle"
              ? "50%"
              : layer.crop === "rounded"
                ? Math.min(layer.width, layer.height) * scale * 0.2
                : 0,
          ...crop,
          background:
            "linear-gradient(135deg,#dbeafe 0%,#fce7f3 55%,#dcfce7 100%)",
        }}
      />
    );
  }

  const common: React.CSSProperties = {
    ...style,
    background: layer.fill,
    border:
      layer.stroke !== "transparent" && layer.strokeWidth > 0
        ? `${Math.max(1, layer.strokeWidth * scale)}px solid ${layer.stroke}`
        : undefined,
  };

  if (layer.shape === "ellipse") {
    return <div style={{ ...common, borderRadius: "50%" }} />;
  }

  if (layer.shape === "triangle") {
    return (
      <div
        style={{
          ...style,
          background: layer.fill,
          clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
        }}
      />
    );
  }

  if (layer.shape === "star") {
    return (
      <div
        style={{
          ...style,
          background: layer.fill,
          clipPath:
            "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
        }}
      />
    );
  }

  return <div style={common} />;
}
