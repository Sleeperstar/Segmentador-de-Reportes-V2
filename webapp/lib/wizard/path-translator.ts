/**
 * Traduce paths técnicos de issues del validador (ej: `$.steps[3].agencyColumn.report`)
 * a frases humanas en español que un usuario no técnico pueda entender.
 *
 * Si recibe el `pipeline`, usa los IDs reales de los pasos para mensajes
 * más específicos (ej: "Paso 'cargar_base' (Cargar hoja Excel)" en lugar de
 * solo "Paso 4").
 *
 * Si el path no está mapeado, devuelve el path original sin alterar; la UI
 * puede mostrarlo como detalle técnico.
 */

import type { Pipeline, PipelineStep } from "@/lib/pipeline/types";
import { stepTypeLabel } from "./labels";

/**
 * Convierte el path técnico en una descripción humana.
 *
 * @param path Path original del issue, ej: "$.steps[3].agencyColumn.report".
 * @param pipeline Pipeline opcional para usar IDs reales y tipos de paso.
 * @returns Frase humana o el mismo path si no hay mapeo.
 */
export function humanizePath(path: string, pipeline?: Pipeline): string {
  if (typeof path !== "string" || path.trim() === "") return path;

  // Caso: $.inputs.* (configuración de entrada)
  if (path.startsWith("$.inputs")) {
    return humanizeInputsPath(path);
  }

  // Caso raíz: $.steps o $
  if (path === "$" || path === "$.steps") {
    return "El pipeline tiene un problema general de estructura";
  }

  // Caso: $.steps[i].xxxx
  const stepMatch = path.match(/^\$\.steps\[(\d+)\](?:\.(.+))?$/);
  if (stepMatch) {
    const idx = Number(stepMatch[1]);
    const subPath = stepMatch[2] ?? "";
    return humanizeStepPath(idx, subPath, pipeline);
  }

  return path;
}

function humanizeInputsPath(path: string): string {
  if (path === "$.inputs") {
    return "La sección 'Inputs' (regex y variables) tiene un problema";
  }
  if (path === "$.inputs.fileNamePattern") {
    return "Pestaña 'Inputs' → Expresión regular del nombre de archivo";
  }
  if (path === "$.inputs.derivedVariables") {
    return "Pestaña 'Inputs' → Variables derivadas";
  }
  return path;
}

function humanizeStepPath(idx: number, subPath: string, pipeline?: Pipeline): string {
  const step = pipeline?.steps?.[idx];
  const stepRef = describeStep(idx, step);

  if (subPath === "" || subPath === "type") {
    return `${stepRef}: el tipo de paso es desconocido o falta`;
  }
  if (subPath === "id") {
    return `${stepRef}: el identificador interno está vacío o duplicado`;
  }

  const tabHint = step ? tabHintForStep(step) : "";
  const prefix = tabHint ? `${stepRef} (${tabHint})` : stepRef;

  // Mapeos por subpath
  const map: Array<[RegExp | string, string]> = [
    // load_sheet
    ["sheet", "falta el nombre exacto de la hoja Excel"],
    ["headerDetection", "falta la configuración de detección de cabecera"],
    [
      "headerDetection.expectedColumns",
      "la estrategia 'Detectar automáticamente' necesita al menos una columna esperada",
    ],
    [
      "headerDetection.row",
      "la estrategia 'Fila fija' necesita un número de fila válido (>= 1)",
    ],
    [
      "headerDetection.rows",
      "la estrategia 'Cabecera en varias filas' necesita al menos un número de fila válido",
    ],

    // filter_rows / derive_column
    ["source", "falta el dataset de origen"],
    ["filters", "necesita al menos un filtro"],
    ["newColumn", "falta el nombre de la columna nueva"],
    ["op", "falta la operación a aplicar"],

    // split_by_column
    ["reportSources", "debe seleccionar al menos un dataset de reporte para segmentar"],
    ["agencyColumn.report", "falta la columna de agencia del reporte"],
    ["agencyColumn.base", "falta la columna de agencia del dataset base"],
    ["baseSource", "el dataset base es obligatorio cuando se unifica por RUC"],
    [
      "unifyByLookup",
      "la configuración de unificación por RUC tiene un problema de estructura",
    ],
    [
      "unifyByLookup.report.rucColumn",
      "falta la columna RUC en el reporte (sección 'Unificar agencias por RUC')",
    ],
    [
      "unifyByLookup.base.rucColumn",
      "falta la columna RUC en la base (sección 'Unificar agencias por RUC')",
    ],
    [
      "unifyByLookup.base.canonicalNameColumn",
      "falta la columna del nombre unificado en la base (sección 'Unificar agencias por RUC')",
    ],

    // join
    ["left/right", "faltan los datasets izquierdo o derecho del join"],
    ["on", "falta la configuración de las columnas en común para el join"],

    // validate
    ["rules", "necesita al menos una regla de validación"],

    // write_output
    [
      "perAgency.fileNameTemplate",
      "falta la plantilla del nombre del archivo por agencia (pestaña 'Salida')",
    ],
    [
      "zipFileNameTemplate",
      "falta el nombre del archivo ZIP (pestaña 'Salida')",
    ],
    [
      "perAgency.sheets",
      "necesita al menos una hoja de salida (pestaña 'Salida')",
    ],
    [
      "perAgency.headerHighlights",
      "las reglas de resaltado de cabeceras tienen un problema",
    ],
  ];

  // Intentar match exacto primero
  for (const [pattern, msg] of map) {
    if (typeof pattern === "string" && pattern === subPath) {
      return `${prefix} → ${msg}`;
    }
  }

  // Caso: perAgency.headerHighlights[i].xxx
  const highlightMatch = subPath.match(
    /^perAgency\.headerHighlights\[(\d+)\](?:\.(\w+))?$/
  );
  if (highlightMatch) {
    const ruleIdx = Number(highlightMatch[1]) + 1;
    const field = highlightMatch[2];
    if (field === "terms") {
      return `${prefix} → la regla de resaltado #${ruleIdx} necesita al menos un término`;
    }
    if (field === "fillColor") {
      return `${prefix} → la regla de resaltado #${ruleIdx} tiene un color de relleno inválido`;
    }
    if (field === "fontColor") {
      return `${prefix} → la regla de resaltado #${ruleIdx} tiene un color de fuente inválido`;
    }
    return `${prefix} → la regla de resaltado #${ruleIdx} tiene un problema`;
  }

  return `${prefix} → ${subPath}`;
}

function describeStep(idx: number, step: PipelineStep | undefined): string {
  const human = idx + 1;
  if (!step) return `Paso ${human}`;
  const id = step.id ? `'${step.id}'` : "(sin id)";
  return `Paso ${human} ${id}`;
}

function tabHintForStep(step: PipelineStep): string {
  const tab = stepTypeLabel(step.type);
  return tab;
}
