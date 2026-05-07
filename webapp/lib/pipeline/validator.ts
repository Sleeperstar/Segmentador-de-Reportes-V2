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
      } else {
        const hd = step.headerDetection as {
          strategy?: string;
          expectedColumns?: unknown;
          row?: unknown;
          rows?: unknown;
        };
        if (hd.strategy === "auto") {
          if (!Array.isArray(hd.expectedColumns) || hd.expectedColumns.length === 0) {
            issues.push({
              path: `${path}.headerDetection.expectedColumns`,
              message:
                'La estrategia "auto" requiere al menos una columna esperada. ' +
                'Agrega columnas que sepas que existen en la cabecera (ej: "AGENCIA, ALTAS").',
            });
          }
        } else if (hd.strategy === "fixed_row") {
          if (typeof hd.row !== "number" || hd.row < 1) {
            issues.push({
              path: `${path}.headerDetection.row`,
              message: 'La estrategia "fixed_row" requiere un número de fila >= 1.',
            });
          }
        } else if (hd.strategy === "multi_level") {
          if (
            !Array.isArray(hd.rows) ||
            hd.rows.length === 0 ||
            !hd.rows.every((r) => typeof r === "number" && r >= 1)
          ) {
            issues.push({
              path: `${path}.headerDetection.rows`,
              message:
                'La estrategia "multi_level" requiere un arreglo con al menos un número de fila >= 1.',
            });
          }
        }
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
      if (step.unifyByLookup !== undefined) {
        const u = step.unifyByLookup as {
          report?: { rucColumn?: unknown };
          base?: { rucColumn?: unknown; canonicalNameColumn?: unknown };
        };
        if (typeof u !== "object" || u === null) {
          issues.push({
            path: `${path}.unifyByLookup`,
            message: "Debe ser un objeto con `report` y `base`.",
          });
        } else {
          if (typeof u.report?.rucColumn !== "string" || u.report.rucColumn.trim() === "") {
            issues.push({
              path: `${path}.unifyByLookup.report.rucColumn`,
              message: "Columna RUC del reporte requerida (string no vacío).",
            });
          }
          if (typeof u.base?.rucColumn !== "string" || u.base.rucColumn.trim() === "") {
            issues.push({
              path: `${path}.unifyByLookup.base.rucColumn`,
              message: "Columna RUC en base requerida (string no vacío).",
            });
          }
          if (
            typeof u.base?.canonicalNameColumn !== "string" ||
            u.base.canonicalNameColumn.trim() === ""
          ) {
            issues.push({
              path: `${path}.unifyByLookup.base.canonicalNameColumn`,
              message: "Columna de nombre canónico en base requerida (string no vacío).",
            });
          }
          if (!step.baseSource) {
            issues.push({
              path: `${path}.baseSource`,
              message: "Cuando se usa `unifyByLookup`, `baseSource` es obligatorio.",
            });
          }
        }
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
      if (step.perAgency?.headerHighlights !== undefined) {
        const highlights = step.perAgency.headerHighlights as unknown;
        if (!Array.isArray(highlights)) {
          issues.push({
            path: `${path}.perAgency.headerHighlights`,
            message: "Debe ser un arreglo.",
          });
        } else {
          highlights.forEach((rule, i) => {
            const rulePath = `${path}.perAgency.headerHighlights[${i}]`;
            if (typeof rule !== "object" || rule === null) {
              issues.push({ path: rulePath, message: "Cada regla debe ser un objeto." });
              return;
            }
            const r = rule as {
              terms?: unknown;
              fillColor?: unknown;
              fontColor?: unknown;
            };
            if (
              !Array.isArray(r.terms) ||
              r.terms.length === 0 ||
              !r.terms.every((t) => typeof t === "string" && t.trim() !== "")
            ) {
              issues.push({
                path: `${rulePath}.terms`,
                message: "Debe ser un arreglo no vacío de strings.",
              });
            }
            if (typeof r.fillColor !== "string" || !isValidHexColor(r.fillColor)) {
              issues.push({
                path: `${rulePath}.fillColor`,
                message: 'Color de relleno inválido. Usa formato "#RRGGBB" o "#RGB".',
              });
            }
            if (typeof r.fontColor !== "string" || !isValidHexColor(r.fontColor)) {
              issues.push({
                path: `${rulePath}.fontColor`,
                message: 'Color de fuente inválido. Usa formato "#RRGGBB" o "#RGB".',
              });
            }
          });
        }
      }
      break;
  }
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());
}
