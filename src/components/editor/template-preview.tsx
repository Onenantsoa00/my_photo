"use client";

import type { EditorDocument, Layer } from "@/lib/editor/types";

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
}: {
  document: EditorDocument;
  width?: number;
}) {
  const scale = width / document.canvas.width;

  return (
    <div
      className="relative overflow-hidden rounded-lg ring-1 ring-sand-300"
      style={{
        width,
        height: document.canvas.height * scale,
        background: document.canvas.background,
      }}
    >
      {document.layers.map((layer) => (
        <PreviewLayer key={layer.id} layer={layer} scale={scale} />
      ))}
    </div>
  );
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
    borderRadius: "cornerRadius" in layer ? layer.cornerRadius * scale : 0,
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
    return (
      <div
        style={{
          ...style,
          background: "repeating-linear-gradient(45deg,#e2e8f0 0 8px,#f1f5f9 8px 16px)",
          border: "1px dashed #94a3b8",
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
