"use client";

import type { DatasetOption } from "@/lib/wizard/describe-dataset";

/**
 * Select para elegir el "dataset origen" de un paso. Muestra nombres
 * amigables (ej: "Reporte CORTE 1 (hoja Excel)") pero internamente lee/escribe
 * el ID interno del step.
 *
 * Si el `value` actual no está entre las opciones (ej: ID huérfano de una
 * plantilla cargada), lo muestra como opción adicional con tag "(no
 * encontrado)" para no perderlo en silencio.
 */
export function DatasetSelect({
  value,
  onChange,
  options,
  placeholder = "Selecciona un dataset...",
  className = "",
  required = false,
}: {
  value: string;
  onChange: (id: string) => void;
  options: DatasetOption[];
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const known = options.some((o) => o.id === value);
  const showOrphan = value && !known;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-10 w-full rounded-md border border-input bg-background px-3 text-sm ${
        required && !value ? "border-amber-400" : ""
      } ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id} title={opt.hint}>
          {opt.label}
        </option>
      ))}
      {showOrphan && (
        <option value={value}>{`${value} (no encontrado)`}</option>
      )}
    </select>
  );
}
