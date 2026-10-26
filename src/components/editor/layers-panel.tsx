"use client";

import { useT } from "@/components/locale-provider";
import { labelFor, type Layer } from "@/lib/editor/types";

const TYPE_ICON: Record<Layer["type"], string> = {
  text: "T",
  image: "▣",
  shape: "◆",
};

export function LayersPanel({
  layers,
  selectedId,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onMove,
  onDuplicate,
  onDelete,
}: {
  layers: Layer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  // Le dernier calque du tableau est visuellement au-dessus : on l'affiche en
  // premier, comme dans un logiciel de PAO.
  const ordered = [...layers].reverse();

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <h2 className="px-3 pb-2 text-xs font-bold uppercase tracking-wide text-ink-500">
        {t("editor.layers")}
        <span className="ml-2 font-normal normal-case text-ink-500">
          ({layers.length})
        </span>
      </h2>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {ordered.length === 0 ? (
          <p className="px-2 py-4 text-xs text-ink-500">{t("editor.noLayers")}</p>
        ) : (
          <ul className="space-y-1">
            {ordered.map((layer) => {
              const active = layer.id === selectedId;

              return (
                <li key={layer.id}>
                  <div
                    className={
                      active
                        ? "flex items-center gap-1 rounded-lg border border-brand-500 bg-brand-50 p-1.5"
                        : "flex items-center gap-1 rounded-lg border border-transparent p-1.5 hover:bg-sand-100"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(layer.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title={labelFor(layer)}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded text-xs font-bold ${
                          layer.type === "text"
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                            : layer.type === "image"
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {TYPE_ICON[layer.type]}
                      </span>
                      <span className="truncate text-xs font-medium">
                        {labelFor(layer)}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center">
                      <IconButton
                        label={layer.visible ? t("editor.hide") : t("editor.show")}
                        onClick={() => onToggleVisible(layer.id)}
                        dim={!layer.visible}
                      >
                        {layer.visible ? "👁" : "🚫"}
                      </IconButton>
                      <IconButton
                        label={layer.locked ? t("editor.unlock") : t("editor.lock")}
                        onClick={() => onToggleLock(layer.id)}
                        dim={layer.locked}
                      >
                        {layer.locked ? "🔒" : "🔓"}
                      </IconButton>
                      <IconButton
                        label={t("editor.bringForward")}
                        onClick={() => onMove(layer.id, "up")}
                      >
                        ▲
                      </IconButton>
                      <IconButton
                        label={t("editor.sendBackward")}
                        onClick={() => onMove(layer.id, "down")}
                      >
                        ▼
                      </IconButton>
                      <IconButton
                        label={t("editor.duplicate")}
                        onClick={() => onDuplicate(layer.id)}
                      >
                        ⧉
                      </IconButton>
                      <IconButton
                        label={t("common.delete")}
                        onClick={() => onDelete(layer.id)}
                        danger
                      >
                        ✕
                      </IconButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function IconButton({
  children,
  label,
  onClick,
  dim,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  dim?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-6 w-6 place-items-center rounded text-[11px] leading-none transition-colors ${
        danger ? "hover:bg-accent-100 dark:hover:bg-accent-950" : "hover:bg-sand-200 dark:hover:bg-sand-300/40"
      } ${dim ? "opacity-50" : ""}`}
    >
      {children}
    </button>
  );
}
