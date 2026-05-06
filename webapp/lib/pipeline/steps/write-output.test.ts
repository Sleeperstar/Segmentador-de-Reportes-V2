import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  executeWriteOutput,
  hexToArgb,
  renderTemplate,
  resolveHeaderStyle,
} from "./write-output";
import type {
  HeaderHighlight,
  PipelineContext,
  Group,
} from "@/lib/pipeline/types";

describe("renderTemplate", () => {
  it("reemplaza placeholders simples", () => {
    expect(
      renderTemplate("Reporte {AGENCIA} {PERIODO_COMI}.xlsx", {
        AGENCIA: "Piura",
        PERIODO_COMI: "202603",
      })
    ).toBe("Reporte Piura 202603.xlsx");
  });

  it("deja placeholders sin resolver literal", () => {
    expect(renderTemplate("hola {X}", {})).toBe("hola {X}");
  });
});

describe("write_output", () => {
  function ctxWithGroups(): PipelineContext {
    const piura: Group = {
      key: "PIURA",
      displayName: "Piura",
      datasets: new Map([
        [
          "detalle",
          {
            columns: ["COD_PEDIDO", "AGENCIA", "MONTO"],
            rows: [
              { COD_PEDIDO: 1, AGENCIA: "Piura", MONTO: 100 },
              { COD_PEDIDO: 2, AGENCIA: "Piura", MONTO: 200 },
            ],
          },
        ],
        [
          "horizontal",
          {
            columns: ["AGENCIA", "ALTAS"],
            rows: [{ AGENCIA: "Piura", ALTAS: 2 }],
          },
        ],
      ]),
    };
    const lima: Group = {
      key: "LIMA",
      displayName: "Lima",
      datasets: new Map([
        [
          "detalle",
          {
            columns: ["COD_PEDIDO", "AGENCIA", "MONTO"],
            rows: [{ COD_PEDIDO: 3, AGENCIA: "Lima", MONTO: 500 }],
          },
        ],
      ]),
    };
    return {
      inputFileName: "in.xlsx",
      variables: new Map([["PERIODO_COMI", "202603"]]),
      datasets: new Map(),
      groups: new Map([
        ["PIURA", piura],
        ["LIMA", lima],
      ]),
      logs: [],
    };
  }

  it("genera un ZIP con un xlsx por agencia", async () => {
    const ctx = ctxWithGroups();
    const result = await executeWriteOutput(
      {
        id: "w",
        type: "write_output",
        perAgency: {
          sheets: [
            { name: "Detalle", from: "detalle" },
            { name: "Resumen", from: "horizontal" },
          ],
          fileNameTemplate: "Reporte {AGENCIA} {PERIODO_COMI}.xlsx",
          formats: [
            { columns: ["MONTO"], format: "currency" },
            { columns: ["ALTAS"], format: "integer" },
          ],
        },
        zipFileNameTemplate: "Reportes Agencias {PERIODO_COMI}.zip",
      },
      ctx
    );

    expect(result.filesGenerated).toBe(2);
    expect(result.zipFileName).toBe("Reportes Agencias 202603.zip");

    const zip = await JSZip.loadAsync(result.zipBuffer);
    const names = Object.keys(zip.files);
    expect(names).toContain("Reporte Piura 202603.xlsx");
    expect(names).toContain("Reporte Lima 202603.xlsx");

    const piuraBuf = await zip.file("Reporte Piura 202603.xlsx")!.async("uint8array");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(piuraBuf.buffer as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Detalle", "Resumen"]);
    const detalle = wb.getWorksheet("Detalle")!;
    expect(detalle.rowCount).toBe(3);
    expect(detalle.getCell("A1").value).toBe("COD_PEDIDO");
  });

  it("omite hojas de agencias que no tienen ese dataset", async () => {
    const ctx = ctxWithGroups();
    const result = await executeWriteOutput(
      {
        id: "w",
        type: "write_output",
        perAgency: {
          sheets: [
            { name: "Detalle", from: "detalle" },
            { name: "Resumen", from: "horizontal" },
          ],
          fileNameTemplate: "R_{AGENCIA}.xlsx",
        },
        zipFileNameTemplate: "all.zip",
      },
      ctx
    );

    const zip = await JSZip.loadAsync(result.zipBuffer);
    const limaBuf = await zip.file("R_Lima.xlsx")!.async("uint8array");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(limaBuf.buffer as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Detalle"]);
  });

  it("lanza error si no hay grupos", async () => {
    const ctx: PipelineContext = {
      inputFileName: "in.xlsx",
      variables: new Map(),
      datasets: new Map(),
      logs: [],
    };
    await expect(
      executeWriteOutput(
        {
          id: "w",
          type: "write_output",
          perAgency: { sheets: [], fileNameTemplate: "x.xlsx" },
          zipFileNameTemplate: "x.zip",
        },
        ctx
      )
    ).rejects.toThrow(/no hay grupos/);
  });

  it("lanza error claro cuando faltan variables en plantillas de nombre", async () => {
    const ctx = ctxWithGroups();
    // El template referencia {PERIODO_COMI} pero la variable no está definida
    await expect(
      executeWriteOutput(
        {
          id: "w",
          type: "write_output",
          perAgency: {
            sheets: [{ name: "Detalle", from: "detalle" }],
            fileNameTemplate: "Reporte {AGENCIA} {MES_FALTANTE}.xlsx",
          },
          zipFileNameTemplate: "Reportes {PERIODO_COMI}.zip",
        },
        { ...ctx, variables: new Map() }
      )
    ).rejects.toThrow(/Variables sin resolver.*PERIODO_COMI|MES_FALTANTE/);
  });
});

describe("hexToArgb", () => {
  it("convierte hex de 6 dígitos a ARGB", () => {
    expect(hexToArgb("#0070C0")).toBe("FF0070C0");
    expect(hexToArgb("0070c0")).toBe("FF0070C0");
  });
  it("expande hex de 3 dígitos", () => {
    expect(hexToArgb("#fff")).toBe("FFFFFFFF");
    expect(hexToArgb("#abc")).toBe("FFAABBCC");
  });
  it("retorna FFFFFFFF para entradas inválidas", () => {
    expect(hexToArgb("not-a-color")).toBe("FFFFFFFF");
    expect(hexToArgb("")).toBe("FFFFFFFF");
  });
});

describe("resolveHeaderStyle", () => {
  it("aplica el default de Penalidad cuando la columna lo contiene", () => {
    const style = resolveHeaderStyle("Penalidad Mensual", [
      { terms: ["penalidad"], fillColor: "#0070C0", fontColor: "#FFFFFF" },
    ]);
    expect(style).toEqual({ fillArgb: "FF0070C0", fontArgb: "FFFFFFFF" });
  });

  it("aplica el default de Clawback cuando la columna lo contiene", () => {
    const style = resolveHeaderStyle("Total Clawback", [
      { terms: ["clawback"], fillColor: "#002060", fontColor: "#FFFFFF" },
    ]);
    expect(style).toEqual({ fillArgb: "FF002060", fontArgb: "FFFFFFFF" });
  });

  it("regla custom tiene prioridad sobre default global (custom va primero)", () => {
    const customRules: HeaderHighlight[] = [
      // Custom: clawback debe ser rojo
      { terms: ["clawback"], fillColor: "#FF0000", fontColor: "#000000" },
      // Default que sería sobrescrito si no estuviera primero el custom
      { terms: ["clawback"], fillColor: "#002060", fontColor: "#FFFFFF" },
    ];
    const style = resolveHeaderStyle("Total Clawback Anual", customRules);
    expect(style).toEqual({ fillArgb: "FFFF0000", fontArgb: "FF000000" });
  });

  it("match es case-insensitive y sin tildes", () => {
    const rules: HeaderHighlight[] = [
      { terms: ["penalizacion"], fillColor: "#0070C0", fontColor: "#FFFFFF" },
    ];
    expect(resolveHeaderStyle("PENALIZACIÓN", rules)).toEqual({
      fillArgb: "FF0070C0",
      fontArgb: "FFFFFFFF",
    });
    expect(resolveHeaderStyle("penalización", rules)).toEqual({
      fillArgb: "FF0070C0",
      fontArgb: "FFFFFFFF",
    });
  });

  it("usa el naranja institucional cuando ninguna regla matchea", () => {
    const style = resolveHeaderStyle("Agencia", []);
    expect(style).toEqual({ fillArgb: "FFFF6B00", fontArgb: "FFFFFFFF" });
  });
});

describe("write_output con headerHighlights aplicados al XLSX", () => {
  function singleGroupCtx(): PipelineContext {
    const g: Group = {
      key: "X",
      displayName: "X",
      datasets: new Map([
        [
          "rep",
          {
            columns: ["AGENCIA", "ALTAS", "Penalidad", "Clawback Total"],
            rows: [{ AGENCIA: "X", ALTAS: 1, Penalidad: 0, "Clawback Total": 0 }],
          },
        ],
      ]),
    };
    return {
      inputFileName: "in.xlsx",
      variables: new Map(),
      datasets: new Map(),
      groups: new Map([["X", g]]),
      logs: [],
    };
  }

  it("aplica los defaults globales de Penalidad y Clawback en el archivo generado", async () => {
    const ctx = singleGroupCtx();
    const result = await executeWriteOutput(
      {
        id: "w",
        type: "write_output",
        perAgency: {
          sheets: [{ name: "Hoja", from: "rep" }],
          fileNameTemplate: "R_{AGENCIA}.xlsx",
        },
        zipFileNameTemplate: "all.zip",
      },
      ctx
    );

    const zip = await JSZip.loadAsync(result.zipBuffer);
    const buf = await zip.file("R_X.xlsx")!.async("uint8array");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const ws = wb.getWorksheet("Hoja")!;

    const cellPenalidad = ws.getCell("C1");
    const cellClawback = ws.getCell("D1");
    const cellAgencia = ws.getCell("A1");

    expect((cellPenalidad.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF0070C0");
    expect((cellClawback.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF002060");
    // Sin match → naranja institucional
    expect((cellAgencia.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFFF6B00");
  });
});
