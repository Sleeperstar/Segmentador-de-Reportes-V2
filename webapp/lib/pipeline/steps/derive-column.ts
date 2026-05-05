import type {
  CellValue,
  Dataset,
  DeriveColumnStep,
  PipelineContext,
  Row,
} from "@/lib/pipeline/types";
import { normalize } from "@/lib/pipeline/utils/normalize";

export function executeDeriveColumn(
  step: DeriveColumnStep,
  ctx: PipelineContext
): Dataset {
  const source = ctx.datasets.get(step.source);
  if (!source) {
    throw new Error(
      `Paso "${step.id}": no se encontró el dataset fuente "${step.source}".`
    );
  }

  const newRows: Row[] = source.rows.map((row) => ({
    ...row,
    [step.newColumn]: computeDerivedValue(step, row),
  }));

  const columns = source.columns.includes(step.newColumn)
    ? source.columns
    : [...source.columns, step.newColumn];

  const ds: Dataset = {
    columns,
    rows: newRows,
    meta: source.meta,
  };
  ctx.datasets.set(step.id, ds);
  ctx.logs.push({
    level: "info",
    message: `Columna "${step.newColumn}" derivada en "${step.id}" (op=${step.op}).`,
    timestamp: new Date(),
    context: { stepId: step.id, op: step.op, column: step.newColumn },
  });
  return ds;
}

export function computeDerivedValue(
  step: DeriveColumnStep,
  row: Row
): CellValue {
  switch (step.op) {
    case "constant":
      return step.constant ?? null;

    case "strip_suffix": {
      const col = firstSourceColumn(step);
      const raw = row[col];
      if (raw === null || raw === undefined) return raw ?? null;
      const s = String(raw);
      const sUpper = normalize(s);
      for (const suffix of step.suffixes ?? []) {
        const sufUpper = normalize(suffix);
        if (sUpper.endsWith(sufUpper)) {
          // Recortar del original preservando case, usando longitud del sufijo normalizado
          return s.slice(0, s.length - suffix.length).trim();
        }
      }
      return s;
    }

    case "lookup": {
      const col = firstSourceColumn(step);
      const key = normalize(row[col]);
      const table = step.lookupTable ?? {};
      const normalizedTable = buildNormalizedLookup(table);
      return normalizedTable.get(key) ?? row[col] ?? null;
    }

    case "normalize_name": {
      const col = firstSourceColumn(step);
      return normalize(row[col], step.normalize);
    }

    case "concat": {
      const cols = step.sourceColumns ?? [step.source];
      const sep = step.separator ?? " ";
      const parts = cols
        .map((c) => row[c])
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
        .map((v) => String(v));
      return parts.join(sep);
    }

    case "regex_replace": {
      const col = firstSourceColumn(step);
      const raw = row[col];
      if (raw === null || raw === undefined) return null;
      const re = new RegExp(step.pattern ?? "", "g");
      return String(raw).replace(re, step.replacement ?? "");
    }
  }
}

function firstSourceColumn(step: DeriveColumnStep): string {
  if (step.sourceColumns && step.sourceColumns.length > 0) {
    return step.sourceColumns[0];
  }
  throw new Error(
    `Paso "${step.id}" (op=${step.op}) requiere al menos una columna en sourceColumns.`
  );
}

function buildNormalizedLookup(table: Record<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(table)) {
    out.set(normalize(k), v);
  }
  return out;
}
