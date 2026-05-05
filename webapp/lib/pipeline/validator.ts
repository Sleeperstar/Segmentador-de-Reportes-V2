import type { Pipeline, PipelineStep } from "@/lib/pipeline/types";

const STEP_TYPES = [
  "load_sheet",
  "filter_rows",
  "derive_column",
  "split_by_column",
  "join",
  "validate",
  "write_output",
] as const;

export type ValidationIssue = { path: string; message: string };

export type ValidationOutcome = {
  valid: boolean;
  pipeline?: Pipeline;
  issues: ValidationIssue[];
};

/**
 * Valida estructura mínima de un Pipeline. No verifica referencias entre steps
 * (eso lo hace el engine en runtime), solo que cada step tenga los campos
 * obligatorios y tipos correctos para evitar guardar configuraciones rotas.
 */
export function validatePipeline(input: unknown): ValidationOutcome {
  const issues: ValidationIssue[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, issues: [{ path: "$", message: "Debe ser un objeto JSON." }] };
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.steps)) {
    issues.push({ path: "$.steps", message: "El campo `steps` debe ser un arreglo." });
    return { valid: false, issues };
  }

  if (obj.steps.length === 0) {
    issues.push({ path: "$.steps", message: "Debe tener al menos un paso." });
  }

  const ids = new Set<string>();
  obj.steps.forEach((rawStep, i) => {
    const path = `$.steps[${i}]`;
    if (typeof rawStep !== "object" || rawStep === null) {
      issues.push({ path, message: "Cada paso debe ser un objeto." });
      return;
    }
    const step = rawStep as Record<string, unknown>;

    if (typeof step.id !== "string" || step.id.trim() === "") {
      issues.push({ path: `${path}.id`, message: "`id` es obligatorio (string no vacío)." });
    } else {
      if (ids.has(step.id)) {
        issues.push({ path: `${path}.id`, message: `id duplicado: "${step.id}".` });
      }
      ids.add(step.id);
    }

    if (typeof step.type !== "string" || !STEP_TYPES.includes(step.type as (typeof STEP_TYPES)[number])) {
      issues.push({
        path: `${path}.type`,
        message: `\`type\` debe ser uno de: ${STEP_TYPES.join(", ")}.`,
      });
      return;
    }

    validateStepShape(step as unknown as PipelineStep, path, issues);
  });

  if (obj.inputs !== undefined) {
    if (typeof obj.inputs !== "object" || obj.inputs === null) {
      issues.push({ path: "$.inputs", message: "`inputs` debe ser un objeto." });
    } else {
      const inputs = obj.inputs as Record<string, unknown>;
      if (
        inputs.fileNamePattern !== undefined &&
        typeof inputs.fileNamePattern !== "string"
      ) {
        issues.push({
          path: "$.inputs.fileNamePattern",
          message: "Debe ser string.",
        });
      } else if (typeof inputs.fileNamePattern === "string") {
        try {
          new RegExp(inputs.fileNamePattern);
        } catch {
          issues.push({
            path: "$.inputs.fileNamePattern",
            message: "La expresión regular no es válida.",
          });
        }
      }
      if (inputs.derivedVariables !== undefined && !Array.isArray(inputs.derivedVariables)) {
        issues.push({
          path: "$.inputs.derivedVariables",
          message: "Debe ser un arreglo.",
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    pipeline: issues.length === 0 ? (obj as unknown as Pipeline) : undefined,
    issues,
  };
}

function validateStepShape(step: PipelineStep, path: string, issues: ValidationIssue[]) {
  switch (step.type) {
    case "load_sheet":
      if (!step.sheet || typeof step.sheet !== "string") {
        issues.push({ path: `${path}.sheet`, message: "Nombre de hoja requerido." });
      }
      if (!step.headerDetection) {
        issues.push({ path: `${path}.headerDetection`, message: "Configuración requerida." });
      }
      break;
    case "filter_rows":
      if (!step.source) {
        issues.push({ path: `${path}.source`, message: "Origen requerido." });
      }
      if (!Array.isArray(step.filters) || step.filters.length === 0) {
        issues.push({ path: `${path}.filters`, message: "Al menos un filtro." });
      }
      break;
    case "derive_column":
      if (!step.source) issues.push({ path: `${path}.source`, message: "Origen requerido." });
      if (!step.newColumn) issues.push({ path: `${path}.newColumn`, message: "Columna destino requerida." });
      if (!step.op) issues.push({ path: `${path}.op`, message: "Operación requerida." });
      break;
    case "split_by_column":
      if (!Array.isArray(step.reportSources) || step.reportSources.length === 0) {
        issues.push({ path: `${path}.reportSources`, message: "Debe listar al menos una fuente." });
      }
      if (!step.agencyColumn?.report) {
        issues.push({ path: `${path}.agencyColumn.report`, message: "Columna requerida." });
      }
      break;
    case "join":
      if (!step.left || !step.right) {
        issues.push({ path: `${path}.left/right`, message: "Ambos lados requeridos." });
      }
      if (!step.on?.left || !step.on?.right) {
        issues.push({ path: `${path}.on`, message: "Configuración de join requerida." });
      }
      break;
    case "validate":
      if (!Array.isArray(step.rules) || step.rules.length === 0) {
        issues.push({ path: `${path}.rules`, message: "Al menos una regla requerida." });
      }
      break;
    case "write_output":
      if (!step.perAgency?.fileNameTemplate) {
        issues.push({
          path: `${path}.perAgency.fileNameTemplate`,
          message: "Plantilla de nombre requerida.",
        });
      }
      if (!step.zipFileNameTemplate) {
        issues.push({
          path: `${path}.zipFileNameTemplate`,
          message: "Plantilla de ZIP requerida.",
        });
      }
      if (!Array.isArray(step.perAgency?.sheets) || step.perAgency.sheets.length === 0) {
        issues.push({
          path: `${path}.perAgency.sheets`,
          message: "Al menos una hoja de salida requerida.",
        });
      }
      break;
  }
}
