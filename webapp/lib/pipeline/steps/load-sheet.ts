import ExcelJS from "exceljs";
import { readSheetToDataset } from "@/lib/excel/reader";
import type {
  Dataset,
  LoadSheetStep,
  PipelineContext,
} from "@/lib/pipeline/types";

export function executeLoadSheet(
  step: LoadSheetStep,
  workbook: ExcelJS.Workbook,
  ctx: PipelineContext
): Dataset {
  const ds = readSheetToDataset(workbook, step.sheet, step.headerDetection);
  ctx.datasets.set(step.id, ds);
  ctx.logs.push({
    level: "info",
    message: `Hoja "${step.sheet}" cargada en "${step.id}" (${ds.rows.length} filas, ${ds.columns.length} columnas).`,
    timestamp: new Date(),
    context: { stepId: step.id, sheet: step.sheet, headerRow: ds.meta?.headerRow },
  });
  return ds;
}
