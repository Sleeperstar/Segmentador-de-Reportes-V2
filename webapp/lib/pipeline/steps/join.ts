import type {
  CellValue,
  Dataset,
  JoinStep,
  PipelineContext,
  Row,
} from "@/lib/pipeline/types";
import { normalize } from "@/lib/pipeline/utils/normalize";

export function executeJoin(step: JoinStep, ctx: PipelineContext): Dataset {
  const left = ctx.datasets.get(step.left);
  const right = ctx.datasets.get(step.right);
  if (!left) {
    throw new Error(`Paso "${step.id}": no se encontró el dataset "${step.left}".`);
  }
  if (!right) {
    throw new Error(`Paso "${step.id}": no se encontró el dataset "${step.right}".`);
  }

  const kind = step.kind ?? "inner";

  const rightIndex = new Map<string, Row[]>();
  for (const r of right.rows) {
    const k = keyOf(r[step.on.right]);
    if (k === null) continue;
    const bucket = rightIndex.get(k);
    if (bucket) bucket.push(r);
    else rightIndex.set(k, [r]);
  }

  const conflictingCols = right.columns.filter(
    (c) => left.columns.includes(c) && c !== step.on.right
  );

  const columns = [
    ...left.columns,
    ...right.columns
      .filter((c) => c !== step.on.right)
      .map((c) => (conflictingCols.includes(c) ? `${c} (right)` : c)),
  ];

  const rows: Row[] = [];
  for (const l of left.rows) {
    const k = keyOf(l[step.on.left]);
    const matches = k !== null ? rightIndex.get(k) : undefined;
    if (!matches || matches.length === 0) {
      if (kind === "left") {
        rows.push({ ...l });
      }
      continue;
    }
    for (const r of matches) {
      const merged: Row = { ...l };
      for (const col of right.columns) {
        if (col === step.on.right) continue;
        const outCol = conflictingCols.includes(col) ? `${col} (right)` : col;
        merged[outCol] = r[col] ?? null;
      }
      rows.push(merged);
    }
  }

  const ds: Dataset = { columns, rows };
  ctx.datasets.set(step.id, ds);
  ctx.logs.push({
    level: "info",
    message: `Join "${step.id}" (${kind}): ${left.rows.length} × ${right.rows.length} → ${rows.length} filas.`,
    timestamp: new Date(),
    context: { stepId: step.id, kind, out: rows.length },
  });
  return ds;
}

function keyOf(v: CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return String(v);
  return normalize(v);
}
