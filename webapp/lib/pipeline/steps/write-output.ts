import ExcelJS from "exceljs";
import JSZip from "jszip";
import type {
  Dataset,
  HeaderHighlight,
  OutputFormat,
  OutputSheet,
  PipelineContext,
  Row,
  WriteOutputStep,
} from "@/lib/pipeline/types";
import { normalize, sanitizeFileName } from "@/lib/pipeline/utils/normalize";

const BRAND_PRIMARY = "FFFF6B00";
const BRAND_SECONDARY = "FFFFB800";
const WHITE = "FFFFFFFF";

/**
 * Reglas de resaltado de cabecera por defecto. Aplican a TODAS las plantillas
 * salvo que se sobrescriban con `headerHighlights` en `WriteOutputStep`.
 */
export const DEFAULT_HEADER_HIGHLIGHTS: HeaderHighlight[] = [
  { terms: ["penalidad"], fillColor: "#0070C0", fontColor: "#FFFFFF" },
  { terms: ["clawback"], fillColor: "#002060", fontColor: "#FFFFFF" },
];

export type WriteOutputResult = {
  zipBuffer: Buffer;
  zipFileName: string;
  filesGenerated: number;
};

export async function executeWriteOutput(
  step: WriteOutputStep,
  ctx: PipelineContext
): Promise<WriteOutputResult> {
  if (!ctx.groups || ctx.groups.size === 0) {
    throw new Error(
      `Paso "${step.id}": no hay grupos. Debe ejecutarse split_by_column antes.`
    );
  }

  // Pre-flight: detectar placeholders sin resolver en las plantillas de nombre.
  // Si el nombre del archivo no matchea el regex (o faltan variables derivadas),
  // los placeholders quedarían literales y Storage los rechazaría con un error
  // críptico. Mejor fallar acá con un mensaje accionable.
  const fileNameVars = {
    ...Object.fromEntries(ctx.variables),
    AGENCIA: "__sample__",
    agency: "__sample__",
  };
  const sampleAgencyName = renderTemplate(
    step.perAgency.fileNameTemplate,
    fileNameVars
  );
  const sampleZipName = renderTemplate(
    step.zipFileNameTemplate,
    Object.fromEntries(ctx.variables)
  );
  const missing = new Set<string>([
    ...findUnresolvedPlaceholders(sampleAgencyName),
    ...findUnresolvedPlaceholders(sampleZipName),
  ]);
  missing.delete("AGENCIA");
  missing.delete("agency");
  if (missing.size > 0) {
    const list = Array.from(missing).join(", ");
    throw new Error(
      `Variables sin resolver en plantilla de nombre: ${list}. ` +
        `Verifica que el nombre del archivo subido coincida con la expresión ` +
        `regular configurada en "Inputs" de la plantilla, o que las variables ` +
        `derivadas estén bien configuradas. Archivo recibido: "${ctx.inputFileName}".`
    );
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  let filesGenerated = 0;

  for (const [, group] of ctx.groups) {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Segmentador de Reportes";
    wb.created = new Date();

    const omittedSheets: string[] = [];
    for (const sheetSpec of step.perAgency.sheets) {
      const ds = resolveSheetDataset(sheetSpec, group, ctx);
      if (!ds) {
        omittedSheets.push(sheetSpec.name);
        continue;
      }
      const ws = wb.addWorksheet(sheetSpec.name.slice(0, 31));
      writeDatasetToWorksheet(
        ws,
        ds,
        step.perAgency.formats,
        step.perAgency.headerHighlights
      );
    }

    if (omittedSheets.length > 0) {
      ctx.logs.push({
        level: "info",
        message: `Agencia "${group.displayName}": se omiten las hojas ${omittedSheets
          .map((s) => `"${s}"`)
          .join(", ")} (sin filas para esta agencia).`,
        timestamp: new Date(),
        context: {
          stepId: step.id,
          agency: group.displayName,
          omittedSheets,
        },
      });
    }

    if (wb.worksheets.length === 0) continue;

    const fileName = renderTemplate(step.perAgency.fileNameTemplate, {
      ...Object.fromEntries(ctx.variables),
      AGENCIA: group.displayName,
      agency: group.displayName,
    });
    const finalName = dedupe(sanitizeFileName(fileName), usedNames);
    usedNames.add(finalName);

    const xlsxBuffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    zip.file(finalName, Buffer.from(xlsxBuffer));
    filesGenerated++;
  }

  const zipFileName = sanitizeFileName(
    renderTemplate(step.zipFileNameTemplate, Object.fromEntries(ctx.variables))
  );

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  ctx.logs.push({
    level: "success",
    message: `Archivos generados: ${filesGenerated}. ZIP: ${zipFileName}`,
    timestamp: new Date(),
    context: { stepId: step.id, filesGenerated, zipFileName },
  });

  return { zipBuffer, zipFileName, filesGenerated };
}

function resolveSheetDataset(
  spec: OutputSheet,
  group: { datasets: Map<string, Dataset> },
  ctx: PipelineContext
): Dataset | null {
  if (spec.filterToAgency === false) {
    return ctx.datasets.get(spec.from) ?? null;
  }
  return group.datasets.get(spec.from) ?? null;
}

function writeDatasetToWorksheet(
  ws: ExcelJS.Worksheet,
  ds: Dataset,
  formats: OutputFormat[] = [],
  highlights: HeaderHighlight[] = []
) {
  const headerRow = ws.addRow(ds.columns);
  applyHeaderStyle(headerRow, ds.columns, highlights);

  for (const row of ds.rows) {
    const values = ds.columns.map((c) => normalizeForWrite(row[c]));
    ws.addRow(values);
  }

  applyColumnFormats(ws, ds.columns, formats);
  autoFitColumns(ws, ds);
}

function applyHeaderStyle(
  row: ExcelJS.Row,
  columns: string[],
  highlights: HeaderHighlight[]
) {
  // Las custom de la plantilla tienen prioridad sobre las globales.
  const allRules: HeaderHighlight[] = [...highlights, ...DEFAULT_HEADER_HIGHLIGHTS];

  row.eachCell((cell, colNum) => {
    const colName = columns[colNum - 1] ?? "";
    const style = resolveHeaderStyle(colName, allRules);
    cell.font = { bold: true, color: { argb: style.fontArgb } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: style.fillArgb },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: BRAND_SECONDARY } },
      left: { style: "thin", color: { argb: BRAND_SECONDARY } },
      bottom: { style: "thin", color: { argb: BRAND_SECONDARY } },
      right: { style: "thin", color: { argb: BRAND_SECONDARY } },
    };
  });
  row.height = 22;
}

/**
 * Resuelve el estilo a aplicar a la celda de cabecera dado su nombre de columna
 * y el conjunto combinado de reglas (custom primero, defaults después).
 *
 * Reglas:
 * - Match case-insensitive y sin tildes (vía `normalize`).
 * - Substring: el término debe aparecer dentro del nombre normalizado.
 * - Primera regla con un término que matchea gana.
 * - Sin match → naranja institucional + letra blanca.
 */
export function resolveHeaderStyle(
  columnName: string,
  rules: HeaderHighlight[]
): { fillArgb: string; fontArgb: string } {
  const haystack = normalize(columnName);
  for (const rule of rules) {
    for (const term of rule.terms) {
      const needle = normalize(term);
      if (needle && haystack.includes(needle)) {
        return {
          fillArgb: hexToArgb(rule.fillColor),
          fontArgb: hexToArgb(rule.fontColor),
        };
      }
    }
  }
  return { fillArgb: BRAND_PRIMARY, fontArgb: WHITE };
}

/**
 * Convierte un color hex `#RRGGBB` o `#RGB` al formato ARGB que usa ExcelJS
 * (`FFRRGGBB`). Si la entrada no es un hex válido, retorna `FFFFFFFF` (blanco).
 */
export function hexToArgb(hex: string): string {
  if (typeof hex !== "string") return "FFFFFFFF";
  let h = hex.trim().replace(/^#/, "").toUpperCase();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9A-F]{6}$/.test(h)) return "FFFFFFFF";
  return `FF${h}`;
}

function applyColumnFormats(
  ws: ExcelJS.Worksheet,
  columns: string[],
  formats: OutputFormat[]
) {
  for (const fmt of formats) {
    const numFmt = numFmtFor(fmt.format);
    for (const colName of fmt.columns) {
      const idx = columns.indexOf(colName);
      if (idx === -1) continue;
      const col = ws.getColumn(idx + 1);
      col.numFmt = numFmt;
    }
  }
}

function numFmtFor(format: OutputFormat["format"]): string {
  switch (format) {
    case "percent":
      return "0.00%";
    case "number":
      return "#,##0.00";
    case "integer":
      return "#,##0";
    case "currency":
      return '"S/" #,##0.00';
  }
}

function autoFitColumns(ws: ExcelJS.Worksheet, ds: Dataset) {
  ds.columns.forEach((col, i) => {
    let max = col.length;
    for (const r of ds.rows.slice(0, 200)) {
      const v = r[col];
      if (v === null || v === undefined) continue;
      const len = String(v).length;
      if (len > max) max = len;
    }
    ws.getColumn(i + 1).width = Math.min(60, Math.max(10, max + 2));
  });
}

function normalizeForWrite(v: Row[string]): Row[string] {
  if (v === undefined) return null;
  return v;
}

/**
 * Reemplaza placeholders `{NOMBRE}` en el template por el valor del mapa.
 * Los placeholders sin valor se mantienen (detectables con `findUnresolvedPlaceholders`).
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([^{}]+)\}/g, (_, key) => {
    const k = key.trim();
    return vars[k] ?? `{${k}}`;
  });
}

/**
 * Retorna los nombres de placeholders `{NOMBRE}` sin resolver dentro de un string.
 */
export function findUnresolvedPlaceholders(rendered: string): string[] {
  const matches = rendered.matchAll(/\{([^{}]+)\}/g);
  return Array.from(matches, (m) => m[1].trim());
}

function dedupe(name: string, used: Set<string>): string {
  if (!used.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot);
  let i = 2;
  while (used.has(`${stem} (${i})${ext}`)) i++;
  return `${stem} (${i})${ext}`;
}
