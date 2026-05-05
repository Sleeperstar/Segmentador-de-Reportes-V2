import type {
  CellValue,
  Dataset,
  Filter,
  FilterRowsStep,
  PipelineContext,
  Row,
} from "@/lib/pipeline/types";
import { normalize } from "@/lib/pipeline/utils/normalize";
import { resolveValue } from "@/lib/pipeline/utils/filename-parser";

export function executeFilterRows(
  step: FilterRowsStep,
  ctx: PipelineContext
): Dataset {
  const source = ctx.datasets.get(step.source);
  if (!source) {
    throw new Error(
      `Paso "${step.id}": no se encontró el dataset fuente "${step.source}".`
    );
  }

  const combine = step.combine ?? "and";
  const filtered = source.rows.filter((row) => {
    const results = step.filters.map((f) => evaluateFilter(row, f, ctx));
    return combine === "and" ? results.every(Boolean) : results.some(Boolean);
  });

  const ds: Dataset = {
    columns: source.columns,
    rows: filtered,
    meta: source.meta,
  };
  ctx.datasets.set(step.id, ds);
  ctx.logs.push({
    level: "info",
    message: `Filtro "${step.id}" aplicado: ${source.rows.length} → ${filtered.length} filas.`,
    timestamp: new Date(),
    context: { stepId: step.id, before: source.rows.length, after: filtered.length },
  });
  return ds;
}

export function evaluateFilter(
  row: Row,
  filter: Filter,
  ctx: PipelineContext
): boolean {
  const cell = row[filter.column];
  const value = resolveValueList(filter.value, ctx);
  const value2 = resolveValueList(filter.value2, ctx);

  switch (filter.op) {
    case "equals":
      return compareEquals(cell, value as CellValue);
    case "not_equals":
      return !compareEquals(cell, value as CellValue);
    case "in":
      return toArray(value).some((v) => compareEquals(cell, v));
    case "not_in":
      return !toArray(value).some((v) => compareEquals(cell, v));
    case "contains":
      if (cell === null || cell === undefined) return false;
      return normalize(cell).includes(normalize(value as CellValue));
    case "not_null":
      return cell !== null && cell !== undefined && String(cell).trim() !== "";
    case "is_null":
      return cell === null || cell === undefined || String(cell).trim() === "";
    case "gt":
      return toNumber(cell) > toNumber(value as CellValue);
    case "gte":
      return toNumber(cell) >= toNumber(value as CellValue);
    case "lt":
      return toNumber(cell) < toNumber(value as CellValue);
    case "lte":
      return toNumber(cell) <= toNumber(value as CellValue);
    case "between": {
      const n = toNumber(cell);
      return (
        n >= toNumber(value as CellValue) && n <= toNumber(value2 as CellValue)
      );
    }
  }
}

function resolveValueList(
  value: Filter["value"] | Filter["value2"],
  ctx: PipelineContext
): CellValue | CellValue[] | null {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value as CellValue[];
  return resolveValue(value, ctx.variables) as CellValue;
}

function toArray(v: CellValue | CellValue[] | null): CellValue[] {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** Compara por igualdad usando normalización para strings, y loose equality para números. */
export function compareEquals(a: CellValue, b: CellValue): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;

  // Si ambos son numéricos (o uno es number y el otro string numérico), comparar como números.
  const na = toNumber(a);
  const nb = toNumber(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && (typeof a === "number" || typeof b === "number")) {
    return na === nb;
  }

  return normalize(a) === normalize(b);
}

function toNumber(v: CellValue): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const s = String(v).trim().replace(/,/g, "");
  if (s === "") return NaN;
  return Number(s);
}
