/**
 * Construye etiquetas amigables para los datasets que pueden usarse como
 * "origen" en pasos posteriores (load_sheet, filter_rows, derive_column,
 * split_by_column, join). El usuario verá algo como
 * "Reporte CORTE 1 (hoja Excel)" en lugar del ID interno `reporte_corte_1`.
 *
 * El valor del select sigue siendo el ID interno; solo cambia la presentación.
 */

import type { PipelineStep } from "@/lib/pipeline/types";

export type DatasetOption = {
  id: string;
  label: string;
  hint?: string;
};

/**
 * Lista de tipos de paso que producen un dataset reusable como origen para
 * pasos posteriores. Se excluyen:
 * - `validate` y `write_output`: no producen datasets, son terminales.
 * - `split_by_column`: produce grupos por agencia que el motor consume
 *   automáticamente; ningún paso lo referencia como `from` o `source`.
 *   Mostrarlo en el select crearía confusión y la opción circular de
 *   "segmentar la segmentación".
 */
const SOURCE_PRODUCING_TYPES: ReadonlyArray<PipelineStep["type"]> = [
  "load_sheet",
  "filter_rows",
  "derive_column",
  "join",
];

/**
 * Devuelve una descripción humana del step para usar en `<option>` o
 * checkboxes. Los labels usan sustantivos (qué ES el dataset), no verbos
 * (qué se HACE), para que la lectura sea natural:
 *   "Hoja: Reporte CORTE 1"  (no "Reporte CORTE 1 (Cargar hoja Excel)")
 *   "Filtro: base"           (no "Filtrar filas: base")
 *   "Columna: AGENCIA_NORM"  (no "Calcular columna: AGENCIA_NORM")
 */
export function describeStep(step: PipelineStep): string {
  switch (step.type) {
    case "load_sheet":
      return step.sheet ? `Hoja: ${step.sheet}` : `Hoja: ${step.id}`;
    case "filter_rows":
      return `Filtro: ${step.id}`;
    case "derive_column":
      return step.newColumn
        ? `Columna: ${step.newColumn}`
        : `Columna: ${step.id}`;
    case "join":
      return `Unión: ${step.id}`;
    default:
      return step.id;
  }
}

/**
 * Construye las opciones para un select de datasets a partir del pipeline.
 *
 * @param steps Pasos del pipeline.
 * @param excludeIds IDs a excluir (ej: el paso actual para evitar self-ref).
 */
export function buildDatasetOptions(
  steps: PipelineStep[],
  excludeIds: string[] = []
): DatasetOption[] {
  const exclude = new Set(excludeIds);
  return steps
    .filter((s) => SOURCE_PRODUCING_TYPES.includes(s.type) && !exclude.has(s.id))
    .map((s) => ({
      id: s.id,
      label: describeStep(s),
    }));
}
