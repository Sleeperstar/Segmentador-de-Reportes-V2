import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { runPipeline } from "@/lib/pipeline";
import type { Pipeline } from "@/lib/pipeline/types";

/**
 * Caso real (Lima Corte 1) actualizado post-refactor del cliente:
 *
 * El archivo llega con 3 hojas:
 *   - "Reporte CORTE 1 Horizontal"  → formato por agencia, columnas (AGENCIA, ALTAS, COMISION)
 *   - "Reporte CORTE 1 Vertical"    → formato por agencia, columnas (AGENCIA, ALTAS, MONTO)
 *   - "Reporte CORTE 1 Marcha Blanca" → formato por agencia (AGENCIA, ALTAS, MONTO)
 *   - "Detalle"                      → base maestra con COD_PEDIDO, AGENCIA, CANAL, TIPO_ESTADO, PERIODO_COMI
 *
 * El pipeline:
 *   1. Carga las 4 hojas.
 *   2. Filtra el detalle por CANAL=Agencias, TIPO_ESTADO IN {Validado, Rescate},
 *      PERIODO_COMI=$PERIODO_COMI (extraído del nombre del archivo "MARZO 2026").
 *   3. Segmenta detalle + 3 reportes por AGENCIA.
 *   4. Valida que count(COD_PEDIDO) en el detalle filtrado == sum(ALTAS) de las 3 hojas por agencia.
 *   5. Genera un ZIP con un xlsx por agencia, incluyendo las 4 hojas.
 */
async function buildFixtureWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // Horizontal: (AGENCIA, ALTAS, COMISION) con fila de título arriba (para probar auto-detect)
  const h = wb.addWorksheet("Reporte CORTE 1 Horizontal");
  h.addRow(["Reporte generado automáticamente"]);
  h.addRow([]);
  h.addRow(["AGENCIA", "ALTAS", "COMISION"]);
  h.addRow(["Piura", 3, 150]);
  h.addRow(["Lima", 5, 250]);
  h.addRow(["Chiclayo", 2, 100]);

  // Vertical: (AGENCIA, ALTAS, MONTO)
  const v = wb.addWorksheet("Reporte CORTE 1 Vertical");
  v.addRow(["AGENCIA", "ALTAS", "MONTO"]);
  v.addRow(["Piura", 2, 400]);
  v.addRow(["Lima", 1, 200]);

  // Marcha Blanca: (AGENCIA, ALTAS, MONTO)
  const mb = wb.addWorksheet("Reporte CORTE 1 Marcha Blanca");
  mb.addRow(["AGENCIA", "ALTAS", "MONTO"]);
  mb.addRow(["Piura", 1, 50]);
  mb.addRow(["Chiclayo", 1, 50]);

  // Detalle: base maestra. Totalizando altas válidas por agencia:
  //   Piura:   6 (3+2+1)  → 6 filas con COD_PEDIDO en el detalle válido.
  //   Lima:    6 (5+1)   → 6 filas válidas.
  //   Chiclayo: 3 (2+1)  → 3 filas válidas.
  // Añadimos también filas que deben ser filtradas (canal WEB, estado rechazado, periodo distinto).
  const d = wb.addWorksheet("Detalle");
  d.addRow(["COD_PEDIDO", "AGENCIA", "CANAL", "TIPO_ESTADO", "PERIODO_COMI"]);
  let cod = 1;
  const addValid = (agencia: string, n: number) => {
    for (let i = 0; i < n; i++) {
      d.addRow([cod++, agencia, "Agencias", i % 2 === 0 ? "Validado" : "Rescate", 202603]);
    }
  };
  addValid("Piura", 6);
  addValid("Lima", 6);
  addValid("Chiclayo", 3);
  // Ruido que debe ser excluido:
  d.addRow([cod++, "Piura", "WEB", "Validado", 202603]); // canal incorrecto
  d.addRow([cod++, "Lima", "Agencias", "Rechazado", 202603]); // estado incorrecto
  d.addRow([cod++, "Piura", "Agencias", "Validado", 202602]); // periodo incorrecto

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const pipeline: Pipeline = {
  inputs: {
    fileNamePattern:
      "Reportes AGENCIA LIMA Corte (?<corte>\\d+) (?<mes>\\w+) (?<anio>\\d{4})",
    derivedVariables: [
      { name: "PERIODO_COMI", from: "fileName", transform: "monthYearToYYYYMM" },
    ],
  },
  steps: [
    {
      id: "horizontal",
      type: "load_sheet",
      sheet: "Reporte CORTE 1 Horizontal",
      headerDetection: {
        strategy: "auto",
        expectedColumns: ["AGENCIA", "ALTAS", "COMISION"],
      },
    },
    {
      id: "vertical",
      type: "load_sheet",
      sheet: "Reporte CORTE 1 Vertical",
      headerDetection: { strategy: "fixed_row", row: 1 },
    },
    {
      id: "marcha_blanca",
      type: "load_sheet",
      sheet: "Reporte CORTE 1 Marcha Blanca",
      headerDetection: { strategy: "fixed_row", row: 1 },
    },
    {
      id: "detalle_raw",
      type: "load_sheet",
      sheet: "Detalle",
      headerDetection: { strategy: "fixed_row", row: 1 },
    },
    {
      id: "detalle",
      type: "filter_rows",
      source: "detalle_raw",
      filters: [
        { column: "CANAL", op: "equals", value: "Agencias" },
        { column: "TIPO_ESTADO", op: "in", value: ["Validado", "Rescate"] },
        { column: "PERIODO_COMI", op: "equals", value: "$PERIODO_COMI" },
      ],
    },
    {
      id: "segmenta",
      type: "split_by_column",
      reportSources: ["horizontal", "vertical", "marcha_blanca"],
      baseSource: "detalle",
      agencyColumn: { report: "AGENCIA" },
    },
    {
      id: "valida",
      type: "validate",
      rules: [
        {
          name: "altas_3_hojas_vs_detalle_por_agencia",
          left: {
            aggregate: "sum",
            column: "ALTAS",
            from: ["horizontal", "vertical", "marcha_blanca"],
            scope: "per_agency",
          },
          right: {
            aggregate: "count",
            column: "COD_PEDIDO",
            from: "detalle",
            scope: "per_agency",
          },
          onMismatch: "warn",
        },
        {
          name: "altas_totales_global",
          left: {
            aggregate: "sum",
            column: "ALTAS",
            from: ["horizontal", "vertical", "marcha_blanca"],
          },
          right: {
            aggregate: "count",
            column: "COD_PEDIDO",
            from: "detalle",
          },
        },
      ],
    },
    {
      id: "salida",
      type: "write_output",
      perAgency: {
        sheets: [
          { name: "Detalle", from: "detalle" },
          { name: "Horizontal", from: "horizontal" },
          { name: "Vertical", from: "vertical" },
          { name: "Marcha Blanca", from: "marcha_blanca" },
        ],
        fileNameTemplate: "Reporte {AGENCIA} Corte 1 {PERIODO_COMI}.xlsx",
        formats: [
          { columns: ["COMISION", "MONTO"], format: "currency" },
          { columns: ["ALTAS"], format: "integer" },
        ],
      },
      zipFileNameTemplate: "Reportes AGENCIA LIMA Corte 1 {PERIODO_COMI}.zip",
    },
  ],
};

describe("Integración: Lima Corte 1 (multi-hoja + validación + segmentación)", () => {
  it("ejecuta el pipeline completo y produce ZIP correcto", async () => {
    const fileBuffer = await buildFixtureWorkbook();
    const fileName = "Reportes AGENCIA LIMA Corte 1 MARZO 2026.xlsx";

    const result = await runPipeline({ pipeline, fileBuffer, fileName });

    // Debe ser éxito (no mismatches)
    expect(result.status).toBe("success");
    expect(result.output).toBeDefined();

    // Resolución de variables
    const output = result.output!;
    expect(output.zipFileName).toBe("Reportes AGENCIA LIMA Corte 1 202603.zip");

    // Validaciones per agency
    const perAgencyResults = output.validations.filter(
      (v) => v.ruleName === "altas_3_hojas_vs_detalle_por_agencia"
    );
    expect(perAgencyResults).toHaveLength(3);
    for (const r of perAgencyResults) {
      expect(r.matched).toBe(true);
    }
    const piura = perAgencyResults.find((r) => r.groupKey === "PIURA")!;
    expect(piura.left).toBe(6);
    expect(piura.right).toBe(6);
    const lima = perAgencyResults.find((r) => r.groupKey === "LIMA")!;
    expect(lima.left).toBe(6);
    const chiclayo = perAgencyResults.find((r) => r.groupKey === "CHICLAYO")!;
    expect(chiclayo.left).toBe(3);

    // Validación global
    const global = output.validations.find((v) => v.ruleName === "altas_totales_global")!;
    expect(global.matched).toBe(true);
    expect(global.left).toBe(15);
    expect(global.right).toBe(15);

    // ZIP con 3 archivos (Piura, Lima, Chiclayo)
    expect(output.summary.filesGenerated).toBe(3);
    const zip = await JSZip.loadAsync(output.zipBuffer);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual([
      "Reporte Chiclayo Corte 1 202603.xlsx",
      "Reporte Lima Corte 1 202603.xlsx",
      "Reporte Piura Corte 1 202603.xlsx",
    ]);

    // El archivo de Piura debe contener las 4 hojas con datos sólo de Piura
    const piuraBuf = await zip.file("Reporte Piura Corte 1 202603.xlsx")!.async("uint8array");
    const pWb = new ExcelJS.Workbook();
    await pWb.xlsx.load(piuraBuf.buffer as ArrayBuffer);
    expect(pWb.worksheets.map((w) => w.name)).toEqual([
      "Detalle",
      "Horizontal",
      "Vertical",
      "Marcha Blanca",
    ]);

    const pDetalle = pWb.getWorksheet("Detalle")!;
    // 1 cabecera + 6 filas de Piura
    expect(pDetalle.rowCount).toBe(7);

    const pHorizontal = pWb.getWorksheet("Horizontal")!;
    // 1 cabecera + 1 fila (Piura) → 2
    expect(pHorizontal.rowCount).toBe(2);
    expect(pHorizontal.getRow(2).getCell(1).value).toBe("Piura");
    expect(pHorizontal.getRow(2).getCell(2).value).toBe(3);
  });

  it("reporta mismatch cuando las cifras no cuadran", async () => {
    // Fabricamos un workbook con una agencia extra en los reportes que no está en el detalle
    const wb = new ExcelJS.Workbook();
    const h = wb.addWorksheet("Reporte CORTE 1 Horizontal");
    h.addRow(["AGENCIA", "ALTAS"]);
    h.addRow(["Piura", 10]);
    const v = wb.addWorksheet("Reporte CORTE 1 Vertical");
    v.addRow(["AGENCIA", "ALTAS"]);
    const mb = wb.addWorksheet("Reporte CORTE 1 Marcha Blanca");
    mb.addRow(["AGENCIA", "ALTAS"]);
    const d = wb.addWorksheet("Detalle");
    d.addRow(["COD_PEDIDO", "AGENCIA", "CANAL", "TIPO_ESTADO", "PERIODO_COMI"]);
    d.addRow([1, "Piura", "Agencias", "Validado", 202603]);
    d.addRow([2, "Piura", "Agencias", "Validado", 202603]);

    const simplePipeline: Pipeline = {
      inputs: pipeline.inputs,
      steps: [
        {
          id: "horizontal",
          type: "load_sheet",
          sheet: "Reporte CORTE 1 Horizontal",
          headerDetection: { strategy: "fixed_row", row: 1 },
        },
        {
          id: "vertical",
          type: "load_sheet",
          sheet: "Reporte CORTE 1 Vertical",
          headerDetection: { strategy: "fixed_row", row: 1 },
        },
        {
          id: "marcha_blanca",
          type: "load_sheet",
          sheet: "Reporte CORTE 1 Marcha Blanca",
          headerDetection: { strategy: "fixed_row", row: 1 },
        },
        {
          id: "detalle_raw",
          type: "load_sheet",
          sheet: "Detalle",
          headerDetection: { strategy: "fixed_row", row: 1 },
        },
        {
          id: "detalle",
          type: "filter_rows",
          source: "detalle_raw",
          filters: [
            { column: "CANAL", op: "equals", value: "Agencias" },
            { column: "PERIODO_COMI", op: "equals", value: "$PERIODO_COMI" },
          ],
        },
        {
          id: "segmenta",
          type: "split_by_column",
          reportSources: ["horizontal", "vertical", "marcha_blanca"],
          baseSource: "detalle",
          agencyColumn: { report: "AGENCIA" },
        },
        {
          id: "valida",
          type: "validate",
          rules: [
            {
              name: "altas_vs_detalle",
              left: { aggregate: "sum", column: "ALTAS", from: ["horizontal", "vertical", "marcha_blanca"], scope: "per_agency" },
              right: { aggregate: "count", column: "COD_PEDIDO", from: "detalle", scope: "per_agency" },
            },
          ],
        },
        {
          id: "salida",
          type: "write_output",
          perAgency: {
            sheets: [{ name: "Detalle", from: "detalle" }],
            fileNameTemplate: "R_{AGENCIA}.xlsx",
          },
          zipFileNameTemplate: "R.zip",
        },
      ],
    };

    const buf = await wb.xlsx.writeBuffer();
    const result = await runPipeline({
      pipeline: simplePipeline,
      fileBuffer: Buffer.from(buf),
      fileName: "Reportes AGENCIA LIMA Corte 1 MARZO 2026.xlsx",
    });

    // Altas=10 vs COD_PEDIDO count=2 → mismatch en Piura
    expect(result.status).toBe("partial");
    const mismatch = result.output?.validations.find(
      (v) => v.groupKey === "PIURA" && !v.matched
    );
    expect(mismatch).toBeDefined();
    expect(mismatch?.left).toBe(10);
    expect(mismatch?.right).toBe(2);
  });
});
