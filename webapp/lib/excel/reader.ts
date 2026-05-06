import ExcelJS from "exceljs";
import type {
  CellValue,
  Dataset,
  HeaderDetection,
  Row,
} from "@/lib/pipeline/types";
import { normalize } from "@/lib/pipeline/utils/normalize";

/**
 * Lee un archivo Excel desde un Buffer/Uint8Array y retorna el workbook.
 *
 * NOTA DE PERFORMANCE: actualmente carga el archivo completo en memoria
 * (xlsx.load). Para archivos > 30 MB, considerar migrar a `wb.xlsx.read(stream)`
 * con `stream.xlsx.WorkbookReader` que procesa fila por fila y reduce el
 * footprint de memoria significativamente. Por simplicidad y porque el caso
 * de uso típico es ~15 MB, esta implementación es suficiente para Vercel
 * Hobby (512 MB de memoria por function).
 */
export async function loadWorkbook(
  buffer: Buffer | Uint8Array | ArrayBuffer
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS acepta ArrayBuffer o Buffer de Node.
  const ab =
    buffer instanceof ArrayBuffer
      ? buffer
      : (buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        ) as ArrayBuffer);
  await wb.xlsx.load(ab);
  return wb;
}

/**
 * Lee una hoja del workbook a un Dataset usando la estrategia de cabecera indicada.
 */
export function readSheetToDataset(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  detection: HeaderDetection
): Dataset {
  const ws = findSheet(workbook, sheetName);
  if (!ws) {
    throw new Error(
      `No se encontró la hoja "${sheetName}". Hojas disponibles: ${workbook.worksheets
        .map((w) => `"${w.name}"`)
        .join(", ")}`
    );
  }

  const matrix = worksheetToMatrix(ws);

  switch (detection.strategy) {
    case "fixed_row":
      return buildDatasetFromHeaders(matrix, detection.row, ws.name, detection);
    case "auto": {
      if (
        !detection.expectedColumns ||
        detection.expectedColumns.length === 0
      ) {
        throw new Error(
          `Configuración inválida para "${sheetName}": la estrategia "auto" requiere ` +
            `al menos una columna esperada. Configura "expectedColumns" en la ` +
            `plantilla (tab "Hojas") o usa estrategia "fixed_row" si conoces ` +
            `la fila exacta de la cabecera.`
        );
      }
      const headerRow = findHeaderRow(
        matrix,
        detection.expectedColumns,
        detection.maxScanRows ?? 15
      );
      if (headerRow === null) {
        throw new Error(
          `No se pudo auto-detectar la fila de cabecera en la hoja "${sheetName}". ` +
            `Columnas esperadas: ${detection.expectedColumns.join(", ")}. ` +
            `Verifica que el nombre de las columnas coincida (mayúsculas/minúsculas ` +
            `y tildes son ignorados, pero el texto debe ser igual).`
        );
      }
      return buildDatasetFromHeaders(matrix, headerRow, ws.name, detection);
    }
    case "multi_level":
      return buildMultiLevelDataset(matrix, detection.rows, ws.name, detection);
  }
}

/**
 * Busca una hoja por nombre exacto y, como fallback, por nombre normalizado.
 * Esto permite que una plantilla con "Reporte CORTE 1" matchee
 * "Reporte CORTE 1 Horizontal" si el usuario renombra, siempre que el match
 * sea único. Para matches ambiguos, se devuelve sólo el exacto (o null).
 */
function findSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string
): ExcelJS.Worksheet | undefined {
  const exact = workbook.getWorksheet(sheetName);
  if (exact) return exact;

  const target = normalize(sheetName);
  const candidates = workbook.worksheets.filter(
    (w) => normalize(w.name) === target
  );
  if (candidates.length === 1) return candidates[0];
  return undefined;
}

/**
 * Convierte una worksheet en una matriz 2D (array de rows, cada row es array de celdas).
 * La fila 0 corresponde a la fila 1 de Excel. Celdas vacías → null.
 */
export function worksheetToMatrix(ws: ExcelJS.Worksheet): CellValue[][] {
  const matrix: CellValue[][] = [];
  const rowCount = ws.rowCount;
  const colCount = ws.columnCount;

  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const arr: CellValue[] = [];
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      arr.push(normalizeCellValue(cell));
    }
    matrix.push(arr);
  }
  return matrix;
}

/**
 * Normaliza una celda de ExcelJS a un CellValue interno.
 */
function normalizeCellValue(cell: ExcelJS.Cell): CellValue {
  const v = cell.value;
  if (v === null || v === undefined) return null;

  // ExcelJS devuelve objetos para casos especiales: fórmulas, hipervínculos, rich text.
  if (typeof v === "object") {
    if (v instanceof Date) return v;
    // Formula result
    if ("result" in v && v.result !== undefined && v.result !== null) {
      if (typeof v.result === "object" && "error" in v.result) {
        return null;
      }
      return v.result as CellValue;
    }
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => r.text).join("");
    }
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("hyperlink" in v && "text" in v) return (v as { text: string }).text;
    return null;
  }

  return v as CellValue;
}

/**
 * Busca la primera fila que contenga TODAS (o la mayoría de) las cabeceras esperadas.
 * Retorna el índice base 1 (como Excel) o null si no encuentra.
 *
 * Regla: una fila se considera cabecera si contiene >= 80% de las columnas esperadas
 * (match por normalización). Esto hace el detector tolerante a hojas con 1-2 columnas
 * renombradas.
 */
export function findHeaderRow(
  matrix: CellValue[][],
  expected: string[],
  maxScan: number
): number | null {
  if (expected.length === 0) return null;
  const normalizedExpected = expected.map((e) => normalize(e));
  const limit = Math.min(maxScan, matrix.length);
  const threshold = Math.max(1, Math.ceil(expected.length * 0.8));

  let bestRow: number | null = null;
  let bestScore = 0;

  for (let i = 0; i < limit; i++) {
    const row = matrix[i];
    const rowNorm = row.map((v) => normalize(v));
    let score = 0;
    for (const col of normalizedExpected) {
      if (rowNorm.includes(col)) score++;
    }
    if (score >= threshold && score > bestScore) {
      bestScore = score;
      bestRow = i + 1;
    }
  }

  return bestRow;
}

function buildDatasetFromHeaders(
  matrix: CellValue[][],
  headerRow: number,
  sheetName: string,
  detection: HeaderDetection
): Dataset {
  const headers = matrix[headerRow - 1] ?? [];
  const columns = buildUniqueColumns(
    headers.map((h) => (h === null || h === undefined ? "" : String(h).trim()))
  );

  const rows: Row[] = [];
  for (let r = headerRow; r < matrix.length; r++) {
    const rawRow = matrix[r];
    if (isEmptyRow(rawRow)) continue;
    const obj: Row = {};
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      if (!col) continue;
      obj[col] = rawRow[c] ?? null;
    }
    rows.push(obj);
  }

  return {
    columns: columns.filter((c) => c !== ""),
    rows,
    meta: {
      sourceSheet: sheetName,
      headerRow,
      headerStrategy: detection.strategy,
    },
  };
}

/**
 * Construye un dataset combinando N filas de cabecera. Cada columna final se
 * forma concatenando los valores no vacíos de las filas de cabecera,
 * replicando hacia la derecha los valores de la primera fila (para cabeceras
 * fusionadas al estilo "ALTAS | COMISION | ALTAS | COMISION").
 */
function buildMultiLevelDataset(
  matrix: CellValue[][],
  headerRows: number[],
  sheetName: string,
  detection: HeaderDetection
): Dataset {
  if (headerRows.length === 0) {
    throw new Error("multi_level requiere al menos una fila de cabecera.");
  }
  const sorted = [...headerRows].sort((a, b) => a - b);
  const dataStart = sorted[sorted.length - 1] + 1;
  const maxCols = Math.max(
    ...sorted.map((r) => (matrix[r - 1] ?? []).length),
    0
  );

  // Para la primera fila, "forward fill" de valores nulos con el último valor visto
  // (típico de cabeceras con celdas merged).
  const filledTop = forwardFillRow(
    (matrix[sorted[0] - 1] ?? []).slice(0, maxCols)
  );

  const composedHeaders: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const parts: string[] = [];
    // Primera fila forward-filled
    if (filledTop[c] !== null && filledTop[c] !== undefined) {
      parts.push(String(filledTop[c]).trim());
    }
    // Filas intermedias y última
    for (let i = 1; i < sorted.length; i++) {
      const v = matrix[sorted[i] - 1]?.[c];
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        parts.push(String(v).trim());
      }
    }
    composedHeaders.push(parts.join(" | "));
  }

  const columns = buildUniqueColumns(composedHeaders);

  const rows: Row[] = [];
  for (let r = dataStart - 1; r < matrix.length; r++) {
    const rawRow = matrix[r];
    if (isEmptyRow(rawRow)) continue;
    const obj: Row = {};
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      if (!col) continue;
      obj[col] = rawRow[c] ?? null;
    }
    rows.push(obj);
  }

  return {
    columns: columns.filter((c) => c !== ""),
    rows,
    meta: {
      sourceSheet: sheetName,
      headerRow: dataStart - 1,
      headerStrategy: detection.strategy,
    },
  };
}

/**
 * Completa una fila reemplazando nulls con el último valor no nulo visto.
 * Útil para cabeceras merged en Excel donde sólo la primera celda tiene valor.
 */
function forwardFillRow(row: CellValue[]): CellValue[] {
  const out: CellValue[] = [];
  let last: CellValue = null;
  for (const v of row) {
    if (v !== null && v !== undefined && String(v).trim() !== "") {
      last = v;
      out.push(v);
    } else {
      out.push(last);
    }
  }
  return out;
}

function isEmptyRow(row: CellValue[] | undefined): boolean {
  if (!row) return true;
  return row.every((v) => v === null || v === undefined || String(v).trim() === "");
}

/**
 * Garantiza que los nombres de columnas sean únicos. Si hay duplicados,
 * se les agrega sufijo " (2)", " (3)", etc. Columnas vacías se mantienen como "".
 */
export function buildUniqueColumns(names: string[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw ?? "";
    if (name === "") {
      out.push("");
      continue;
    }
    const count = seen.get(name) ?? 0;
    if (count === 0) {
      out.push(name);
    } else {
      out.push(`${name} (${count + 1})`);
    }
    seen.set(name, count + 1);
  }
  return out;
}
