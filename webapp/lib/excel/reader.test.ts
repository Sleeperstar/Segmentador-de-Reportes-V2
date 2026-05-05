import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  buildUniqueColumns,
  findHeaderRow,
  loadWorkbook,
  readSheetToDataset,
} from "./reader";

/** Crea un workbook en memoria con las hojas indicadas y devuelve su Buffer. */
async function buildWorkbook(
  sheets: Array<{ name: string; data: unknown[][] }>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    for (const row of s.data) {
      ws.addRow(row);
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

describe("buildUniqueColumns", () => {
  it("no modifica columnas únicas", () => {
    expect(buildUniqueColumns(["A", "B", "C"])).toEqual(["A", "B", "C"]);
  });

  it("agrega sufijos a duplicados", () => {
    expect(buildUniqueColumns(["A", "A", "B", "A"])).toEqual([
      "A",
      "A (2)",
      "B",
      "A (3)",
    ]);
  });

  it("mantiene vacíos como cadena vacía", () => {
    expect(buildUniqueColumns(["A", "", "B", ""])).toEqual(["A", "", "B", ""]);
  });
});

describe("findHeaderRow", () => {
  it("encuentra cabecera en primera fila", () => {
    const matrix = [
      ["COD_PEDIDO", "AGENCIA", "TIPO_ESTADO"],
      [1, "Piura", "Validado"],
    ];
    expect(findHeaderRow(matrix, ["COD_PEDIDO", "AGENCIA", "TIPO_ESTADO"], 10)).toBe(1);
  });

  it("encuentra cabecera en tercera fila con filas vacías arriba", () => {
    const matrix = [
      ["Reporte generado", null, null],
      [null, null, null],
      ["COD_PEDIDO", "AGENCIA", "TIPO_ESTADO"],
      [1, "Piura", "Validado"],
    ];
    expect(findHeaderRow(matrix, ["COD_PEDIDO", "AGENCIA", "TIPO_ESTADO"], 10)).toBe(3);
  });

  it("acepta cabecera con 80% de columnas esperadas", () => {
    const matrix = [
      ["COD_PEDIDO", "AGENCIA", "TIPO_ESTADO", "PERIODO_COMI", "CANAL"],
    ];
    // expected 5, threshold 4 (80%). Matcheamos 4, falta uno → válido.
    expect(
      findHeaderRow(matrix, ["COD_PEDIDO", "AGENCIA", "TIPO_ESTADO", "PERIODO_COMI", "OTRA"], 10)
    ).toBe(1);
  });

  it("retorna null si no encuentra", () => {
    const matrix = [["foo", "bar"]];
    expect(findHeaderRow(matrix, ["COD_PEDIDO", "AGENCIA"], 10)).toBeNull();
  });
});

describe("readSheetToDataset", () => {
  it("lee hoja con cabecera en fila 1 (fixed_row)", async () => {
    const buf = await buildWorkbook([
      {
        name: "Reporte",
        data: [
          ["COD_PEDIDO", "AGENCIA", "TIPO_ESTADO"],
          [1, "Piura", "Validado"],
          [2, "Lima", "Rescate"],
        ],
      },
    ]);
    const wb = await loadWorkbook(buf);
    const ds = readSheetToDataset(wb, "Reporte", { strategy: "fixed_row", row: 1 });

    expect(ds.columns).toEqual(["COD_PEDIDO", "AGENCIA", "TIPO_ESTADO"]);
    expect(ds.rows).toHaveLength(2);
    expect(ds.rows[0]).toEqual({ COD_PEDIDO: 1, AGENCIA: "Piura", TIPO_ESTADO: "Validado" });
  });

  it("auto-detecta cabecera cuando hay filas previas", async () => {
    const buf = await buildWorkbook([
      {
        name: "Reporte",
        data: [
          ["Reporte generado el 2026-04-20", null, null],
          [null, null, null],
          ["COD_PEDIDO", "AGENCIA", "TIPO_ESTADO"],
          [1, "Piura", "Validado"],
        ],
      },
    ]);
    const wb = await loadWorkbook(buf);
    const ds = readSheetToDataset(wb, "Reporte", {
      strategy: "auto",
      expectedColumns: ["COD_PEDIDO", "AGENCIA", "TIPO_ESTADO"],
    });

    expect(ds.meta?.headerRow).toBe(3);
    expect(ds.rows).toHaveLength(1);
    expect(ds.rows[0].AGENCIA).toBe("Piura");
  });

  it("soporta multi_level con cabecera en filas 2 y 3", async () => {
    const buf = await buildWorkbook([
      {
        name: "Reporte",
        data: [
          ["Título"],
          ["AGENCIA", "ALTAS", null, "BAJAS", null],
          [null, "CANTIDAD", "MONTO", "CANTIDAD", "MONTO"],
          ["Piura", 10, 1000, 2, 200],
          ["Lima", 20, 2000, 5, 500],
        ],
      },
    ]);
    const wb = await loadWorkbook(buf);
    const ds = readSheetToDataset(wb, "Reporte", {
      strategy: "multi_level",
      rows: [2, 3],
    });

    expect(ds.columns).toContain("AGENCIA");
    expect(ds.columns).toContain("ALTAS | CANTIDAD");
    expect(ds.columns).toContain("ALTAS | MONTO");
    expect(ds.columns).toContain("BAJAS | CANTIDAD");
    expect(ds.columns).toContain("BAJAS | MONTO");
    expect(ds.rows).toHaveLength(2);
    expect(ds.rows[0]["ALTAS | CANTIDAD"]).toBe(10);
    expect(ds.rows[0]["BAJAS | MONTO"]).toBe(200);
  });

  it("ignora filas completamente vacías", async () => {
    const buf = await buildWorkbook([
      {
        name: "R",
        data: [
          ["A", "B"],
          [1, 2],
          [null, null],
          [3, 4],
        ],
      },
    ]);
    const wb = await loadWorkbook(buf);
    const ds = readSheetToDataset(wb, "R", { strategy: "fixed_row", row: 1 });
    expect(ds.rows).toHaveLength(2);
  });

  it("lanza error si la hoja no existe", async () => {
    const buf = await buildWorkbook([{ name: "Otra", data: [["A"], [1]] }]);
    const wb = await loadWorkbook(buf);
    expect(() =>
      readSheetToDataset(wb, "NoExiste", { strategy: "fixed_row", row: 1 })
    ).toThrow(/No se encontró la hoja/);
  });

  it("lanza error si auto-detección no encuentra cabecera", async () => {
    const buf = await buildWorkbook([
      { name: "R", data: [["foo", "bar"], [1, 2]] },
    ]);
    const wb = await loadWorkbook(buf);
    expect(() =>
      readSheetToDataset(wb, "R", {
        strategy: "auto",
        expectedColumns: ["COD_PEDIDO", "AGENCIA"],
      })
    ).toThrow(/No se pudo auto-detectar/);
  });
});
