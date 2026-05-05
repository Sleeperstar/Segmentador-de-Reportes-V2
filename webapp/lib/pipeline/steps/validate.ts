import type {
  AggregateSpec,
  CellValue,
  Dataset,
  Group,
  PipelineContext,
  Row,
  ValidateRule,
  ValidateStep,
  ValidationResult,
} from "@/lib/pipeline/types";

export function executeValidate(
  step: ValidateStep,
  ctx: PipelineContext,
  results: ValidationResult[]
): ValidationResult[] {
  for (const rule of step.rules) {
    const ruleResults = evaluateRule(rule, ctx);
    for (const res of ruleResults) {
      results.push(res);
      if (!res.matched) {
        const level = rule.onMismatch === "error" ? "error" : "warn";
        ctx.logs.push({
          level,
          message:
            `Validación "${rule.name}"` +
            (res.groupKey ? ` (grupo ${res.groupKey})` : "") +
            ` no coincide: ${res.left} vs ${res.right}.`,
          timestamp: new Date(),
          context: { rule: rule.name, groupKey: res.groupKey, left: res.left, right: res.right },
        });
      } else {
        ctx.logs.push({
          level: "success",
          message:
            `Validación "${rule.name}"` +
            (res.groupKey ? ` (grupo ${res.groupKey})` : "") +
            ` OK (${res.left}).`,
          timestamp: new Date(),
          context: { rule: rule.name, groupKey: res.groupKey, value: res.left },
        });
      }
    }
  }
  return results;
}

export function evaluateRule(
  rule: ValidateRule,
  ctx: PipelineContext
): ValidationResult[] {
  const scope = rule.left.scope ?? rule.right.scope ?? "global";
  const tol = rule.tolerance ?? 0;

  if (scope === "global") {
    const l = aggregate(rule.left, collectRowsGlobal(ctx, rule.left.from));
    const r = aggregate(rule.right, collectRowsGlobal(ctx, rule.right.from));
    return [{ ruleName: rule.name, left: l, right: r, matched: numericMatch(l, r, tol) }];
  }

  // per_agency: iteramos grupos
  if (!ctx.groups) {
    throw new Error(
      `Regla "${rule.name}" requiere scope per_agency pero no hay grupos (ejecuta split_by_column antes).`
    );
  }
  const out: ValidationResult[] = [];
  for (const [groupKey, group] of ctx.groups) {
    const l = aggregate(rule.left, collectRowsFromGroup(group, rule.left.from));
    const r = aggregate(rule.right, collectRowsFromGroup(group, rule.right.from));
    out.push({ ruleName: rule.name, groupKey, left: l, right: r, matched: numericMatch(l, r, tol) });
  }
  return out;
}

function collectRowsGlobal(ctx: PipelineContext, from: string | string[]): Row[] {
  const ids = Array.isArray(from) ? from : [from];
  const rows: Row[] = [];
  for (const id of ids) {
    const ds = ctx.datasets.get(id);
    if (!ds) throw new Error(`Dataset "${id}" no existe (usado en validate).`);
    rows.push(...ds.rows);
  }
  return rows;
}

function collectRowsFromGroup(group: Group, from: string | string[]): Row[] {
  const ids = Array.isArray(from) ? from : [from];
  const rows: Row[] = [];
  for (const id of ids) {
    const ds = group.datasets.get(id);
    if (!ds) continue;
    rows.push(...ds.rows);
  }
  return rows;
}

export function aggregate(spec: AggregateSpec, rows: Row[]): number {
  const values: CellValue[] = rows.map((r) => r[spec.column]);

  switch (spec.aggregate) {
    case "count":
      return values.filter(
        (v) => v !== null && v !== undefined && String(v).trim() !== ""
      ).length;
    case "count_distinct": {
      const set = new Set<string>();
      for (const v of values) {
        if (v === null || v === undefined) continue;
        set.add(String(v));
      }
      return set.size;
    }
    case "sum":
      return toNumbers(values).reduce((a, b) => a + b, 0);
    case "min": {
      const nums = toNumbers(values);
      return nums.length > 0 ? Math.min(...nums) : 0;
    }
    case "max": {
      const nums = toNumbers(values);
      return nums.length > 0 ? Math.max(...nums) : 0;
    }
    case "avg": {
      const nums = toNumbers(values);
      if (nums.length === 0) return 0;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
  }
}

function toNumbers(values: CellValue[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (typeof v === "number") out.push(v);
    else if (typeof v === "boolean") out.push(v ? 1 : 0);
    else {
      const n = Number(String(v).replace(/,/g, ""));
      if (!Number.isNaN(n)) out.push(n);
    }
  }
  return out;
}

function numericMatch(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

// Re-export used for tests in other step files if needed
export type { Dataset };
