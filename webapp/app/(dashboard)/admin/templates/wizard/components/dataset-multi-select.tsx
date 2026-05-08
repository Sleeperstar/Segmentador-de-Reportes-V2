"use client";

import { AlertCircle } from "lucide-react";
import type { DatasetOption } from "@/lib/wizard/describe-dataset";

/**
 * Multi-select por checkboxes para listas de IDs de datasets. Reemplaza al
 * `<CommaSeparatedInput>` que pedía teclear los IDs separados por coma.
 *
 * IDs huérfanos: si `value` contiene IDs que no están en `options` (ej: la
 * plantilla apunta a un step que ya no existe), se muestran como filas
 * adicionales con tag "no encontrado" y permiten desmarcarlos para limpiarlos.
 */
export function DatasetMultiSelect({
  value,
  onChange,
  options,
  emptyMessage = "No hay datasets disponibles.",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  options: DatasetOption[];
  emptyMessage?: string;
}) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  const knownIds = new Set(options.map((o) => o.id));
  const orphans = value.filter((v) => !knownIds.has(v));

  if (options.length === 0 && orphans.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">{emptyMessage}</p>
    );
  }

  return (
    <div className="rounded-md border bg-background p-2 space-y-1 max-h-56 overflow-y-auto">
      {options.map((opt) => {
        const checked = value.includes(opt.id);
        return (
          <label
            key={opt.id}
            className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50 cursor-pointer"
            title={opt.hint}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(opt.id)}
              className="h-4 w-4"
            />
            <span className="truncate">{opt.label}</span>
          </label>
        );
      })}

      {orphans.map((id) => (
        <label
          key={`orphan-${id}`}
          className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-amber-50 cursor-pointer"
          title="Este dataset ya no existe en la plantilla. Desmárcalo para quitarlo."
        >
          <input
            type="checkbox"
            checked={true}
            onChange={() => toggle(id)}
            className="h-4 w-4"
          />
          <span className="font-mono text-xs">{id}</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-900">
            <AlertCircle className="h-3 w-3" />
            no encontrado
          </span>
        </label>
      ))}
    </div>
  );
}
