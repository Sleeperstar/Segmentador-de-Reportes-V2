import type {
  Dataset,
  Group,
  PipelineContext,
  Row,
  SplitByColumnStep,
  UnifyByLookup,
} from "@/lib/pipeline/types";
import { normalize } from "@/lib/pipeline/utils/normalize";

/**
 * Fusiona los grupos generados por `split_by_column` que comparten el mismo RUC
 * bajo un único nombre canónico. La fuente de verdad del nombre canónico es la
 * hoja base (mapa `rucColumn` → `canonicalNameColumn`).
 *
 * Pensado para reportes donde la columna de agencia trae un valor compuesto
 * (ej: "ALIV TELECOM S.A.C. Áncash", "ALIV TELECOM S.A.C. La Libertad", ...)
 * y se quiere generar UN solo archivo por agencia real.
 *
 * Reglas:
 * - Si el RUC del reporte no aparece en el mapa de la base, el grupo se conserva
 *   tal cual y se emite un log warn.
 * - Si dos grupos preexistentes ya coincidían en su clave canónica, sus filas se
 *   concatenan dataset por dataset.
 * - Modifica `ctx.groups` in-place (lo reemplaza) y emite un log info con el
 *   conteo antes/después de fusionar.
 */
export function unifyGroupsByRuc(
  ctx: PipelineContext,
  splitStep: SplitByColumnStep
): void {
  const unify = splitStep.unifyByLookup;
  if (!unify) return;
  if (!splitStep.baseSource) {
    throw new Error(
      `unifyByLookup en "${splitStep.id}" requiere baseSource definido.`
    );
  }
  if (!ctx.groups || ctx.groups.size === 0) {
    ctx.logs.push({
      level: "info",
      message: `Unificación "${splitStep.id}": sin grupos para fusionar.`,
      timestamp: new Date(),
      context: { stepId: splitStep.id },
    });
    return;
  }

  const baseDs = ctx.datasets.get(splitStep.baseSource);
  if (!baseDs) {
    throw new Error(
      `unifyByLookup en "${splitStep.id}": no se encontró el dataset base "${splitStep.baseSource}".`
    );
  }

  const rucToCanonical = buildRucToCanonicalMap(baseDs, unify, splitStep);

  const beforeCount = ctx.groups.size;
  const merged = new Map<string, Group>();
  let unmappedCount = 0;
  const unmappedRucs: string[] = [];

  for (const [, group] of ctx.groups) {
    const ruc = readRucFromGroup(group, splitStep, unify);
    let canonicalKey: string;
    let canonicalDisplay: string;

    if (ruc === null) {
      canonicalKey = group.key;
      canonicalDisplay = group.displayName;
    } else {
      const normalizedRuc = normalize(ruc, splitStep.normalize);
      const lookup = rucToCanonical.get(normalizedRuc);
      if (lookup) {
        canonicalKey = normalize(lookup, splitStep.normalize);
        canonicalDisplay = lookup;
      } else {
        canonicalKey = group.key;
        canonicalDisplay = group.displayName;
        unmappedCount += 1;
        if (unmappedRucs.length < 10) unmappedRucs.push(String(ruc));
      }
    }

    const existing = merged.get(canonicalKey);
    if (!existing) {
      merged.set(canonicalKey, {
        key: canonicalKey,
        displayName: canonicalDisplay,
        datasets: cloneDatasets(group.datasets),
      });
    } else {
      mergeDatasetsInto(existing.datasets, group.datasets);
    }
  }

  ctx.groups = merged;

  if (unmappedCount > 0) {
    ctx.logs.push({
      level: "warn",
      message:
        `Unificación "${splitStep.id}": ${unmappedCount} grupo(s) sin RUC mapeado en base; ` +
        `se conservaron como están. Ejemplos: ${unmappedRucs.join(", ")}.`,
      timestamp: new Date(),
      context: { stepId: splitStep.id, unmappedCount, examples: unmappedRucs },
    });
  }

  ctx.logs.push({
    level: "info",
    message:
      `Unificación "${splitStep.id}": ${beforeCount} grupos fusionados en ${merged.size} ` +
      `usando ${unify.report.rucColumn} → ${unify.base.canonicalNameColumn}.`,
    timestamp: new Date(),
    context: {
      stepId: splitStep.id,
      groupsBefore: beforeCount,
      groupsAfter: merged.size,
    },
  });
}

/**
 * Construye el mapa `RUC normalizado → nombre canónico` recorriendo el dataset
 * base. Si la base trae varios nombres distintos para el mismo RUC, gana el
 * primero observado (el resto se ignora silenciosamente porque ya tenemos un
 * canónico válido).
 */
function buildRucToCanonicalMap(
  baseDs: Dataset,
  unify: UnifyByLookup,
  splitStep: SplitByColumnStep
): Map<string, string> {
  const rucCol = unify.base.rucColumn;
  const nameCol = unify.base.canonicalNameColumn;

  if (!baseDs.columns.includes(rucCol)) {
    throw new Error(
      `unifyByLookup: la base no tiene la columna RUC "${rucCol}".`
    );
  }
  if (!baseDs.columns.includes(nameCol)) {
    throw new Error(
      `unifyByLookup: la base no tiene la columna de nombre canónico "${nameCol}".`
    );
  }

  const map = new Map<string, string>();
  for (const row of baseDs.rows) {
    const ruc = row[rucCol];
    const name = row[nameCol];
    if (ruc === null || ruc === undefined || String(ruc).trim() === "") continue;
    if (name === null || name === undefined || String(name).trim() === "") continue;
    const key = normalize(ruc, splitStep.normalize);
    if (!map.has(key)) {
      map.set(key, String(name).trim());
    }
  }
  return map;
}

/**
 * Lee el RUC del grupo. Primero intenta los datasets de reporte usando
 * `unify.report.rucColumn`; si no encuentra (porque el grupo solo proviene del
 * base), cae al dataset base usando `unify.base.rucColumn`. Devuelve el primer
 * valor no vacío encontrado, o `null` si ninguno aplica.
 */
function readRucFromGroup(
  group: Group,
  splitStep: SplitByColumnStep,
  unify: UnifyByLookup
): string | null {
  for (const reportId of splitStep.reportSources) {
    const ds = group.datasets.get(reportId);
    if (!ds) continue;
    if (!ds.columns.includes(unify.report.rucColumn)) continue;
    for (const row of ds.rows) {
      const v = row[unify.report.rucColumn];
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        return String(v);
      }
    }
  }
  if (splitStep.baseSource) {
    const ds = group.datasets.get(splitStep.baseSource);
    if (ds && ds.columns.includes(unify.base.rucColumn)) {
      for (const row of ds.rows) {
        const v = row[unify.base.rucColumn];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          return String(v);
        }
      }
    }
  }
  return null;
}

function cloneDatasets(src: Map<string, Dataset>): Map<string, Dataset> {
  const out = new Map<string, Dataset>();
  for (const [id, ds] of src) {
    out.set(id, { columns: ds.columns, rows: [...ds.rows], meta: ds.meta });
  }
  return out;
}

function mergeDatasetsInto(
  target: Map<string, Dataset>,
  src: Map<string, Dataset>
): void {
  for (const [id, ds] of src) {
    const existing = target.get(id);
    if (!existing) {
      target.set(id, { columns: ds.columns, rows: [...ds.rows], meta: ds.meta });
    } else {
      const mergedRows: Row[] = existing.rows.concat(ds.rows);
      target.set(id, {
        columns: existing.columns,
        rows: mergedRows,
        meta: existing.meta,
      });
    }
  }
}
