import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { executeWriteOutput, renderTemplate } from "./write-output";
import type { PipelineContext, Group } from "@/lib/pipeline/types";

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
