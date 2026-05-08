/**
 * Traducciones inglés→español de los valores técnicos del pipeline para
 * mostrarlos al usuario no técnico en el wizard de admin.
 *
 * Las funciones lookup devuelven `{ label, hint? }`. `label` es lo que se ve en
 * la opción del select; `hint` es texto opcional para tooltip o ayuda
 * contextual. El valor del `<option>` se mantiene como el código original
 * (ej: "equals") para no cambiar el JSON guardado.
 */

import type {
  AggregateSpec,
  DeriveOp,
  FileNameTransform,
  FilterOp,
  HeaderStrategy,
  OutputFormat,
  PipelineStep,
  ValidateRule,
} from "@/lib/pipeline/types";

export type Aggregate = AggregateSpec["aggregate"];
export type OutputFormatKind = OutputFormat["format"];
export type Scope = NonNullable<AggregateSpec["scope"]>;
export type OnMismatch = NonNullable<ValidateRule["onMismatch"]>;
export type DerivedVarFrom = "fileName" | "regexGroup";

export type LabelEntry = {
  label: string;
  hint?: string;
};

/* ---------- Filtros ---------- */

export const FILTER_OP_LABELS: Record<FilterOp, LabelEntry> = {
  equals: { label: "es igual a" },
  not_equals: { label: "es distinto de" },
  in: {
    label: "está en la lista",
    hint: "Lista de valores separados por coma",
  },
  not_in: {
    label: "no está en la lista",
    hint: "Lista de valores separados por coma",
  },
  contains: { label: "contiene" },
  not_null: { label: "tiene valor (no vacío)" },
  is_null: { label: "está vacío" },
  gt: { label: "mayor que" },
  gte: { label: "mayor o igual que" },
  lt: { label: "menor que" },
  lte: { label: "menor o igual que" },
  between: {
    label: "entre",
    hint: "Necesita un valor mínimo y un valor máximo",
  },
};

export function filterOpLabel(op: FilterOp): string {
  return FILTER_OP_LABELS[op]?.label ?? op;
}

/* ---------- Derivar columna ---------- */

export const DERIVE_OP_LABELS: Record<DeriveOp, LabelEntry> = {
  strip_suffix: {
    label: "Quitar texto al final",
    hint: "Elimina el primer sufijo de la lista que coincida (ej: 'PROVINCIA').",
  },
  lookup: {
    label: "Tabla de equivalencias",
    hint: "Mapea valores de una columna a otros valores (ej: 'PIURA' → 'Piura Centro').",
  },
  normalize_name: {
    label: "Normalizar texto",
    hint: "Aplica mayúsculas, quita tildes y espacios extra.",
  },
  concat: {
    label: "Concatenar columnas",
    hint: "Une dos o más columnas con un separador.",
  },
  regex_replace: {
    label: "Reemplazar con patrón (regex)",
    hint: "Usa una expresión regular para sustituir partes del texto.",
  },
  constant: {
    label: "Valor constante",
    hint: "Asigna el mismo valor a todas las filas.",
  },
};

export function deriveOpLabel(op: DeriveOp): string {
  return DERIVE_OP_LABELS[op]?.label ?? op;
}

/* ---------- Agregados ---------- */

export const AGGREGATE_LABELS: Record<Aggregate, LabelEntry> = {
  sum: { label: "Sumar" },
  count: { label: "Contar (no vacíos)" },
  count_distinct: { label: "Contar valores únicos" },
  min: { label: "Mínimo" },
  max: { label: "Máximo" },
  avg: { label: "Promedio" },
};

export function aggregateLabel(agg: Aggregate): string {
  return AGGREGATE_LABELS[agg]?.label ?? agg;
}

/* ---------- Scope de validación ---------- */

export const SCOPE_LABELS: Record<Scope, LabelEntry> = {
  global: {
    label: "Total general",
    hint: "Compara los totales sumados de todos los datos.",
  },
  per_agency: {
    label: "Por agencia",
    hint: "Compara los totales de cada agencia por separado.",
  },
};

export function scopeLabel(scope: Scope): string {
  return SCOPE_LABELS[scope]?.label ?? scope;
}

/* ---------- onMismatch ---------- */

export const ON_MISMATCH_LABELS: Record<OnMismatch, LabelEntry> = {
  warn: { label: "Advertencia (no detiene el proceso)" },
  error: { label: "Error (detiene el proceso)" },
};

export function onMismatchLabel(value: OnMismatch): string {
  return ON_MISMATCH_LABELS[value]?.label ?? value;
}

/* ---------- Formato de columnas de salida ---------- */

export const OUTPUT_FORMAT_LABELS: Record<OutputFormatKind, LabelEntry> = {
  percent: { label: "Porcentaje" },
  number: { label: "Número decimal" },
  currency: { label: "Moneda" },
  integer: { label: "Entero" },
};

export function outputFormatLabel(format: OutputFormatKind): string {
  return OUTPUT_FORMAT_LABELS[format]?.label ?? format;
}

/* ---------- Estrategia de detección de cabecera ---------- */

export const HEADER_STRATEGY_LABELS: Record<HeaderStrategy, LabelEntry> = {
  auto: {
    label: "Detectar automáticamente",
    hint: "El sistema busca la fila que contenga las columnas esperadas.",
  },
  fixed_row: {
    label: "Fila fija",
    hint: "Indica exactamente en qué fila está la cabecera (ej: 1).",
  },
  multi_level: {
    label: "Cabecera en varias filas",
    hint: "La cabecera se compone uniendo los valores de varias filas (ej: 1 y 2).",
  },
};

export function headerStrategyLabel(strategy: HeaderStrategy): string {
  return HEADER_STRATEGY_LABELS[strategy]?.label ?? strategy;
}

/* ---------- Transformaciones del nombre de archivo ---------- */

export const FILENAME_TRANSFORM_LABELS: Record<FileNameTransform, LabelEntry> = {
  monthYearToYYYYMM: {
    label: "Mes + Año → YYYYMM (ej: MARZO 2026 → 202603)",
  },
  upper: { label: "Mayúsculas" },
  lower: { label: "Minúsculas" },
  trim: { label: "Quitar espacios al inicio y final" },
};

export function filenameTransformLabel(t: FileNameTransform): string {
  return FILENAME_TRANSFORM_LABELS[t]?.label ?? t;
}

/* ---------- Fuente de variable derivada ---------- */

export const DERIVED_VAR_FROM_LABELS: Record<DerivedVarFrom, LabelEntry> = {
  fileName: {
    label: "Captura de la regex transformada",
    hint: "Toma el match completo y le aplica una transformación.",
  },
  regexGroup: {
    label: "Grupo nombrado de la regex",
    hint: "Toma el valor capturado por un grupo (ej: 'corte', 'mes').",
  },
};

export function derivedVarFromLabel(from: DerivedVarFrom): string {
  return DERIVED_VAR_FROM_LABELS[from]?.label ?? from;
}

/* ---------- Tipos de paso ---------- */

export const STEP_TYPE_LABELS: Record<PipelineStep["type"], LabelEntry> = {
  load_sheet: { label: "Cargar hoja Excel" },
  filter_rows: { label: "Filtrar filas" },
  derive_column: { label: "Calcular columna" },
  split_by_column: { label: "Segmentar por agencia" },
  join: { label: "Unir datasets" },
  validate: { label: "Validar totales" },
  write_output: { label: "Generar archivo final" },
};

export function stepTypeLabel(type: PipelineStep["type"]): string {
  return STEP_TYPE_LABELS[type]?.label ?? type;
}

/* ---------- Helpers ---------- */

/**
 * Lista de pares `[value, label]` para construir un `<select>`. Útil porque
 * preserva el orden de declaración de la tabla.
 */
export function entries<T extends string>(
  table: Record<T, LabelEntry>
): Array<[T, string]> {
  return (Object.keys(table) as T[]).map((k) => [k, table[k].label]);
}

/**
 * Lista de pares `[value, entry]` (incluye hint). Útil cuando queremos también
 * mostrar el tooltip.
 */
export function entriesWithHint<T extends string>(
  table: Record<T, LabelEntry>
): Array<[T, LabelEntry]> {
  return (Object.keys(table) as T[]).map((k) => [k, table[k]]);
}
