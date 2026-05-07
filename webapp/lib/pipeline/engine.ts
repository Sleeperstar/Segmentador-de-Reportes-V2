import ExcelJS from "exceljs";
import { loadWorkbook } from "@/lib/excel/reader";
import type {
  Pipeline,
  PipelineContext,
  PipelineOutput,
  PipelineResult,
  SplitByColumnStep,
  ValidationResult,
} from "@/lib/pipeline/types";
import { executeLoadSheet } from "./steps/load-sheet";
import { executeFilterRows } from "./steps/filter-rows";
import { executeDeriveColumn } from "./steps/derive-column";
import { executeSplitByColumn } from "./steps/split-by-column";
import { executeJoin } from "./steps/join";
import { executeValidate } from "./steps/validate";
import { executeWriteOutput } from "./steps/write-output";
import { unifyGroupsByRuc } from "./steps/unify-groups";
import { parseFileName } from "./utils/filename-parser";

export type RunPipelineInput = {
  pipeline: Pipeline;
  fileBuffer: Buffer | Uint8Array | ArrayBuffer;
  fileName: string;
};

/**
 * Ejecuta un pipeline contra un archivo Excel.
 *
 * Flujo:
 * 1. Parsea el nombre del archivo y extrae variables (PERIODO_COMI, etc.).
 * 2. Carga el workbook.
 * 3. Itera los pasos en orden, despachando cada uno a su handler.
 * 4. Si hay `write_output`, genera ZIP y lo retorna en `output`.
 */
export async function runPipeline(
  input: RunPipelineInput
): Promise<PipelineResult> {
  const { pipeline, fileBuffer, fileName } = input;
  const ctx: PipelineContext = {
    inputFileName: fileName,
    variables: new Map(),
    datasets: new Map(),
    logs: [],
  };

  const { variables, warnings } = parseFileName(fileName, pipeline.inputs);
  for (const [k, v] of variables) ctx.variables.set(k, v);
  for (const w of warnings) {
    ctx.logs.push({ level: "warn", message: w, timestamp: new Date() });
  }

  let workbook: ExcelJS.Workbook;
  try {
    workbook = await loadWorkbook(fileBuffer);
  } catch (err) {
    const message = (err as Error).message;
    ctx.logs.push({ level: "error", message: `Error al leer Excel: ${message}`, timestamp: new Date() });
    return { status: "error", error: { message }, logs: ctx.logs };
  }

  const validations: ValidationResult[] = [];
  let output: PipelineOutput | undefined;
  let unifyApplied = false;

  for (const step of pipeline.steps) {
    try {
      switch (step.type) {
        case "load_sheet":
          executeLoadSheet(step, workbook, ctx);
          break;
        case "filter_rows":
          executeFilterRows(step, ctx);
          break;
        case "derive_column":
          executeDeriveColumn(step, ctx);
          break;
        case "split_by_column":
          executeSplitByColumn(step, ctx);
          break;
        case "join":
          executeJoin(step, ctx);
          break;
        case "validate":
          executeValidate(step, ctx, validations);
          break;
        case "write_output": {
          if (!unifyApplied) {
            const splitWithUnify = findSplitWithUnify(pipeline);
            if (splitWithUnify) {
              unifyGroupsByRuc(ctx, splitWithUnify);
            }
            unifyApplied = true;
          }
          const r = await executeWriteOutput(step, ctx);
          const mismatches = validations.filter((v) => !v.matched).length;
          output = {
            zipBuffer: r.zipBuffer,
            zipFileName: r.zipFileName,
            summary: {
              totalGroups: ctx.groups?.size ?? 0,
              successful: r.filesGenerated,
              mismatches,
              filesGenerated: r.filesGenerated,
            },
            validations,
          };
          break;
        }
      }
    } catch (err) {
      const message = (err as Error).message;
      ctx.logs.push({
        level: "error",
        message: `Error en paso "${step.id}" (${step.type}): ${message}`,
        timestamp: new Date(),
        context: { stepId: step.id, stepType: step.type },
      });
      return {
        status: "error",
        error: { message, stepId: step.id },
        logs: ctx.logs,
        output,
      };
    }
  }

  const hasMismatches = validations.some((v) => !v.matched);
  return {
    status: hasMismatches ? "partial" : "success",
    output,
    logs: ctx.logs,
  };
}

/**
 * Busca el primer `split_by_column` del pipeline que tenga `unifyByLookup`
 * configurado. La unificación se aplica una sola vez antes del primer
 * `write_output`, justo después de que `validate` haya operado sobre los grupos
 * granulares (preserva la trazabilidad del descuadre por sub-agencia).
 */
function findSplitWithUnify(pipeline: Pipeline): SplitByColumnStep | null {
  for (const step of pipeline.steps) {
    if (step.type === "split_by_column" && step.unifyByLookup) {
      return step;
    }
  }
  return null;
}
