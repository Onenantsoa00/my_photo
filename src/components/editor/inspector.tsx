"use client";

import { useT } from "@/components/locale-provider";
import { FONT_STACKS } from "@/lib/editor/templates";
import type {
  ImageFilters,
  ImageLayer,
  Layer,
  ShapeKind,
  ShapeLayer,
  TextLayer,
} from "@/lib/editor/types";

type PatchOptions = { history?: boolean };

export type InspectorProps = {
  layer: Layer | null;
  onPatch: (id: string, patch: Partial<Layer>, options?: PatchOptions) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onReplacePhoto: (id: string) => void;
};

const SHAPES: ShapeKind[] = ["rect", "ellipse", "triangle", "star", "line"];

const SHAPE_LABEL_KEY: Record<ShapeKind, "editor.shape.rect" | "editor.shape.ellipse" | "editor.shape.triangle" | "editor.shape.star" | "editor.shape.line"> = {
  rect: "editor.shape.rect",
  ellipse: "editor.shape.ellipse",
  triangle: "editor.shape.triangle",
  star: "editor.shape.star",
  line: "editor.shape.line",
};

export function Inspector({
  layer,
  onPatch,
  onGestureStart,
  onGestureEnd,
  onReplacePhoto,
}: InspectorProps) {
  const t = useT();

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <h2 className="px-3 pb-2 text-xs font-bold uppercase tracking-wide text-ink-500">
        {t("editor.inspector")}
      </h2>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {!layer ? (
          <p className="py-4 text-xs text-ink-500">{t("editor.noSelection")}</p>
        ) : (
          <div className="space-y-5">
            {layer.type === "text" ? (
              <TextSection
                layer={layer}
                onPatch={onPatch}
                onGestureStart={onGestureStart}
                onGestureEnd={onGestureEnd}
              />
            ) : null}

            {layer.type === "image" ? (
              <ImageSection
                layer={layer}
                onPatch={onPatch}
                onGestureStart={onGestureStart}
                onGestureEnd={onGestureEnd}
                onReplacePhoto={onReplacePhoto}
              />
            ) : null}

            {layer.type === "shape" ? (
              <ShapeSection
                layer={layer}
                onPatch={onPatch}
                onGestureStart={onGestureStart}
                onGestureEnd={onGestureEnd}
              />
            ) : null}

            <GeometrySection
              layer={layer}
              onPatch={onPatch}
              onGestureStart={onGestureStart}
              onGestureEnd={onGestureEnd}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Blocs réutilisables
// ---------------------------------------------------------------------------

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-sand-200 pb-4 last:border-b-0">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onLiveChange,
  onGestureStart,
  onGestureEnd,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onLiveChange: (value: number) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-500">
        {label}
        {suffix ? <span className="text-ink-500"> ({suffix})</span> : null}
      </span>
      <input
        className="input px-2 py-1.5 text-xs"
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onGestureStart();
            onLiveChange(next);
            onGestureEnd();
          }
        }}
      />
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onLiveChange,
  onGestureStart,
  onGestureEnd,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  onLiveChange: (value: number) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-ink-500">
        <span>{label}</span>
        <span className="tabular-nums text-ink-700">{display ?? value.toFixed(2)}</span>
      </span>
      <input
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-sand-300 accent-brand-600"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onGestureStart}
        onKeyDown={onGestureStart}
        onChange={(event) => onLiveChange(Number(event.target.value))}
        onPointerUp={onGestureEnd}
        onKeyUp={onGestureEnd}
        onBlur={onGestureEnd}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onLiveChange,
  onGestureStart,
  onGestureEnd,
}: {
  label: string;
  value: string;
  onLiveChange: (value: string) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-ink-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase text-ink-500">{value}</span>
        <input
          type="color"
          value={value.startsWith("#") ? value : "#000000"}
          onFocus={onGestureStart}
          onBlur={onGestureEnd}
          onChange={(event) => onLiveChange(event.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-sand-300 bg-white p-0.5"
        />
      </span>
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-ink-500">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-sand-300 accent-brand-600"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Sections par type de calque
// ---------------------------------------------------------------------------

function TextSection({
  layer,
  onPatch,
  onGestureStart,
  onGestureEnd,
}: {
  layer: TextLayer;
  onPatch: InspectorProps["onPatch"];
  onGestureStart: () => void;
  onGestureEnd: () => void;
}) {
  const t = useT();
  const live = (patch: Partial<TextLayer>) =>
    onPatch(layer.id, patch as Partial<Layer>, { history: false });

  return (
    <Group title={t("editor.tool.text")}>
      <textarea
        className="input min-h-20 resize-y text-xs"
        value={layer.text}
        onChange={(event) => live({ text: event.target.value })}
        onFocus={onGestureStart}
        onBlur={onGestureEnd}
        placeholder={t("editor.placeholderText")}
      />

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-ink-500">
          {t("editor.font")}
        </span>
        <select
          className="input px-2 py-1.5 text-xs"
          value={layer.fontFamily}
          onChange={(event) => onPatch(layer.id, { fontFamily: event.target.value })}
        >
          {FONT_STACKS.map((font) => (
            <option key={font.label} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </label>

      <SliderField
        label={t("editor.fontSize")}
        value={layer.fontSize}
        min={8}
        max={400}
        step={1}
        display={`${Math.round(layer.fontSize)} px`}
        onLiveChange={(value) => live({ fontSize: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-ink-500">
            {t("editor.fontWeight")}
          </span>
          <select
            className="input px-2 py-1.5 text-xs"
            value={layer.fontStyle}
            onChange={(event) =>
              onPatch(layer.id, {
                fontStyle: event.target.value as TextLayer["fontStyle"],
              })
            }
          >
            <option value="normal">Regular</option>
            <option value="bold">Bold</option>
            <option value="italic">Italic</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-ink-500">
            {t("editor.align")}
          </span>
          <select
            className="input px-2 py-1.5 text-xs"
            value={layer.align}
            onChange={(event) =>
              onPatch(layer.id, { align: event.target.value as TextLayer["align"] })
            }
          >
            <option value="left">◧</option>
            <option value="center">◫</option>
            <option value="right">◨</option>
          </select>
        </label>
      </div>

      <ColorField
        label={t("editor.color")}
        value={layer.fill}
        onLiveChange={(value) => live({ fill: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />

      <SliderField
        label={t("editor.lineHeight")}
        value={layer.lineHeight}
        min={0.8}
        max={2.5}
        step={0.05}
        onLiveChange={(value) => live({ lineHeight: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />

      <SliderField
        label={t("editor.letterSpacing")}
        value={layer.letterSpacing}
        min={-5}
        max={40}
        step={0.5}
        display={`${layer.letterSpacing} px`}
        onLiveChange={(value) => live({ letterSpacing: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />
    </Group>
  );
}

function ImageSection({
  layer,
  onPatch,
  onGestureStart,
  onGestureEnd,
  onReplacePhoto,
}: {
  layer: ImageLayer;
  onPatch: InspectorProps["onPatch"];
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onReplacePhoto: (id: string) => void;
}) {
  const t = useT();
  const filters = layer.filters;

  const live = (patch: Partial<ImageLayer>) =>
    onPatch(layer.id, patch as Partial<Layer>, { history: false });

  const setFilter = (patch: Partial<ImageFilters>) => {
    live({ filters: { ...filters, ...patch } });
  };

  return (
    <Group title={t("editor.tool.image")}>
      <button
        type="button"
        onClick={() => onReplacePhoto(layer.id)}
        className="btn-outline w-full py-2 text-xs"
      >
        {t("editor.uploadPhoto")}
      </button>

      <SliderField
        label={t("editor.cornerRadius")}
        value={layer.cornerRadius}
        min={0}
        max={400}
        step={1}
        display={`${Math.round(layer.cornerRadius)} px`}
        onLiveChange={(value) => live({ cornerRadius: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />

      <Group title={t("editor.filters")}>
        <SliderField
          label={t("editor.brightness")}
          value={filters.brightness}
          min={-1}
          max={1}
          step={0.02}
          onLiveChange={(value) => setFilter({ brightness: value })}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
        <SliderField
          label={t("editor.contrast")}
          value={filters.contrast}
          min={-100}
          max={100}
          step={1}
          display={String(Math.round(filters.contrast))}
          onLiveChange={(value) => setFilter({ contrast: value })}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
        <SliderField
          label={t("editor.saturation")}
          value={filters.saturation}
          min={-1}
          max={5}
          step={0.1}
          onLiveChange={(value) => setFilter({ saturation: value })}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
        <SliderField
          label={t("editor.blur")}
          value={filters.blur}
          min={0}
          max={40}
          step={1}
          display={`${Math.round(filters.blur)} px`}
          onLiveChange={(value) => setFilter({ blur: value })}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />

        <ToggleRow
          label={t("editor.grayscale")}
          checked={filters.grayscale}
          onChange={(checked) => onPatch(layer.id, { filters: { ...filters, grayscale: checked } })}
        />
        <ToggleRow
          label={t("editor.sepia")}
          checked={filters.sepia}
          onChange={(checked) => onPatch(layer.id, { filters: { ...filters, sepia: checked } })}
        />

        <button
          type="button"
          onClick={() =>
            onPatch(layer.id, {
              filters: {
                brightness: 0,
                contrast: 0,
                saturation: 0,
                blur: 0,
                grayscale: false,
                sepia: false,
              },
            })
          }
          className="btn-ghost w-full py-1.5 text-xs"
        >
          {t("editor.resetFilters")}
        </button>
      </Group>
    </Group>
  );
}

function ShapeSection({
  layer,
  onPatch,
  onGestureStart,
  onGestureEnd,
}: {
  layer: ShapeLayer;
  onPatch: InspectorProps["onPatch"];
  onGestureStart: () => void;
  onGestureEnd: () => void;
}) {
  const t = useT();
  const live = (patch: Partial<ShapeLayer>) =>
    onPatch(layer.id, patch as Partial<Layer>, { history: false });

  return (
    <Group title={t("editor.tool.shape")}>
      <div className="grid grid-cols-5 gap-1">
        {SHAPES.map((shape) => (
          <button
            key={shape}
            type="button"
            title={t(SHAPE_LABEL_KEY[shape])}
            onClick={() => onPatch(layer.id, { shape })}
            className={`grid h-8 place-items-center rounded-lg border text-xs ${
              layer.shape === shape
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-sand-300 bg-white hover:bg-sand-100"
            }`}
          >
            {shape === "rect"
              ? "▭"
              : shape === "ellipse"
                ? "◯"
                : shape === "triangle"
                  ? "△"
                  : shape === "star"
                    ? "★"
                    : "▬"}
          </button>
        ))}
      </div>

      <ColorField
        label={t("editor.color")}
        value={layer.fill}
        onLiveChange={(value) => live({ fill: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />

      <ColorField
        label={t("editor.stroke")}
        value={layer.stroke === "transparent" ? "#000000" : layer.stroke}
        onLiveChange={(value) => live({ stroke: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />

      <SliderField
        label={t("editor.strokeWidth")}
        value={layer.strokeWidth}
        min={0}
        max={40}
        step={1}
        display={`${Math.round(layer.strokeWidth)} px`}
        onLiveChange={(value) => live({ strokeWidth: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />

      <SliderField
        label={t("editor.cornerRadius")}
        value={layer.cornerRadius}
        min={0}
        max={200}
        step={1}
        display={`${Math.round(layer.cornerRadius)} px`}
        onLiveChange={(value) => live({ cornerRadius: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />
    </Group>
  );
}

function GeometrySection({
  layer,
  onPatch,
  onGestureStart,
  onGestureEnd,
}: {
  layer: Layer;
  onPatch: InspectorProps["onPatch"];
  onGestureStart: () => void;
  onGestureEnd: () => void;
}) {
  const t = useT();
  const live = (patch: Partial<Layer>) =>
    onPatch(layer.id, patch, { history: false });

  return (
    <Group title={`${t("editor.position")} / ${t("editor.size")}`}>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="X"
          value={layer.x}
          onLiveChange={(value) => live({ x: value })}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
        <NumberField
          label="Y"
          value={layer.y}
          onLiveChange={(value) => live({ y: value })}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
        <NumberField
          label="L"
          value={layer.width}
          min={8}
          onLiveChange={(value) => live({ width: Math.max(8, value) })}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
        <NumberField
          label="H"
          value={layer.height}
          min={8}
          onLiveChange={(value) => live({ height: Math.max(8, value) })}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
      </div>

      <SliderField
        label={t("editor.rotation")}
        value={layer.rotation}
        min={-180}
        max={180}
        step={1}
        display={`${Math.round(layer.rotation)}°`}
        onLiveChange={(value) => live({ rotation: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />

      <SliderField
        label={t("editor.opacity")}
        value={layer.opacity}
        min={0}
        max={1}
        step={0.01}
        display={`${Math.round(layer.opacity * 100)} %`}
        onLiveChange={(value) => live({ opacity: value })}
        onGestureStart={onGestureStart}
        onGestureEnd={onGestureEnd}
      />

      <ToggleRow
        label={layer.locked ? t("editor.unlock") : t("editor.lock")}
        checked={layer.locked}
        onChange={(checked) => onPatch(layer.id, { locked: checked })}
      />
      <ToggleRow
        label={layer.visible ? t("editor.hide") : t("editor.show")}
        checked={!layer.visible}
        onChange={(checked) => onPatch(layer.id, { visible: !checked })}
      />
    </Group>
  );
}
