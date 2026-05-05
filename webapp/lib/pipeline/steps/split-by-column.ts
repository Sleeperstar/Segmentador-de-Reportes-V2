import type {
  Alias,
  Dataset,
  Group,
  PipelineContext,
  Row,
  SplitByColumnStep,
} from "@/lib/pipeline/types";
import { normalize } from "@/lib/pipeline/utils/normalize";

/**
 * Segmenta uno o más datasets (reportes) y opcionalmente un dataset base por
 * la columna de agencia. Crea un Group por cada agencia única y lo guarda en
 * `ctx.groups`. El stepId se reserva para un marcador de ejecución.
 *
 * Diseño:
 * - Cada reportSource se particiona usando `agencyColumn.report`.
 * - baseSource se particiona usando `agencyColumn.base` (fallback a report).
 * - La clave del grupo es el nombre normalizado (tras aplicar aliases);
 *   displayName es el nombre canónico del alias o el primer valor observado.
 */
export function executeSplitByColumn(
  step: SplitByColumnStep,
  ctx: PipelineContext
): Map<string, Group> {
  const aliasResolver = buildAliasResolver(step.aliases ?? [], step.normalize);

  const groups = new Map<string, Group>();

  // Procesar cada reportSource
  for (const reportId of step.reportSources) {
    const ds = ctx.datasets.get(reportId);
    if (!ds) {
      throw new Error(
        `Paso "${step.id}": no se encontró el dataset "${reportId}".`
      );
    }
    partitionInto(groups, ds, reportId, step.agencyColumn.report, aliasResolver);
  }

  // Procesar baseSource si existe
  if (step.baseSource) {
    const baseDs = ctx.datasets.get(step.baseSource);
    if (!baseDs) {
      throw new Error(
        `Paso "${step.id}": no se encontró el dataset base "${step.baseSource}".`
      );
    }
    const baseCol = step.agencyColumn.base ?? step.agencyColumn.report;
    partitionInto(groups, baseDs, step.baseSource, baseCol, aliasResolver);
  }

  ctx.groups = groups;
  ctx.logs.push({
    level: "info",
    message: `Segmentación "${step.id}": ${groups.size} grupos generados.`,
    timestamp: new Date(),
    context: { stepId: step.id, groupCount: groups.size },
  });
  return groups;
}

function partitionInto(
  groups: Map<string, Group>,
  ds: Dataset,
  datasetId: string,
  agencyColumn: string,
  aliasResolver: (value: string) => { key: string; displayName: string }
) {
  if (!ds.columns.includes(agencyColumn)) {
    throw new Error(
      `El dataset "${datasetId}" no tiene la columna de agencia "${agencyColumn}".`
    );
  }

  const buckets = new Map<string, { displayName: string; rows: Row[] }>();
  for (const row of ds.rows) {
    const raw = row[agencyColumn];
    if (raw === null || raw === undefined || String(raw).trim() === "") continue;
    const { key, displayName } = aliasResolver(String(raw));
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { displayName, rows: [] };
      buckets.set(key, bucket);
    }
    bucket.rows.push(row);
  }

  for (const [key, bucket] of buckets) {
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        displayName: bucket.displayName,
        datasets: new Map(),
      };
      groups.set(key, group);
    }
    group.datasets.set(datasetId, {
      columns: ds.columns,
      rows: bucket.rows,
      meta: ds.meta,
    });
  }
}

/**
 * Construye un resolver que, dado un valor crudo, retorna la clave canónica
 * y el displayName a usar para nombres de archivo.
 */
export function buildAliasResolver(
  aliases: Alias[],
  normalizeOpts?: SplitByColumnStep["normalize"]
): (value: string) => { key: string; displayName: string } {
  const variantToCanonical = new Map<string, string>();
  for (const alias of aliases) {
    const canonical = normalize(alias.canonical, normalizeOpts);
    variantToCanonical.set(canonical, alias.canonical);
    for (const variant of alias.variants) {
      variantToCanonical.set(normalize(variant, normalizeOpts), alias.canonical);
    }
  }

  return (value: string) => {
    const key = normalize(value, normalizeOpts);
    const canonical = variantToCanonical.get(key);
    if (canonical) {
      return { key: normalize(canonical, normalizeOpts), displayName: canonical };
    }
    return { key, displayName: value.trim() };
  };
}
