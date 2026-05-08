import { describe, expect, it } from "vitest";
import { humanizePath } from "./path-translator";
import type { Pipeline } from "@/lib/pipeline/types";

const pipeline: Pipeline = {
  inputs: { fileNamePattern: "" },
  steps: [
    {
      id: "reporte_corte",
      type: "load_sheet",
      sheet: "Reporte CORTE 1",
      headerDetection: { strategy: "auto", expectedColumns: ["AGENCIA"] },
    },
    {
      id: "base",
      type: "load_sheet",
      sheet: "BASE",
      headerDetection: { strategy: "fixed_row", row: 1 },
    },
    {
      id: "filtrar",
      type: "filter_rows",
      source: "base",
      filters: [{ column: "PERIODO", op: "equals", value: "$P" }],
    },
    {
      id: "segmentar",
      type: "split_by_column",
      reportSources: ["reporte_corte"],
      baseSource: "base",
      agencyColumn: { report: "AGENCIA" },
    },
    { id: "validar", type: "validate", rules: [] },
    {
      id: "salida",
      type: "write_output",
      perAgency: {
        sheets: [{ name: "BASE", from: "base" }],
        fileNameTemplate: "x.xlsx",
      },
      zipFileNameTemplate: "x.zip",
    },
  ],
};

describe("humanizePath", () => {
  it("traduce paths de inputs", () => {
    expect(humanizePath("$.inputs.fileNamePattern")).toContain(
      "Expresión regular"
    );
    expect(humanizePath("$.inputs.derivedVariables")).toContain(
      "Variables derivadas"
    );
  });

  it("traduce path raíz", () => {
    expect(humanizePath("$")).toContain("estructura");
    expect(humanizePath("$.steps")).toContain("estructura");
  });

  it("traduce path de load_sheet con id real", () => {
    const out = humanizePath("$.steps[0].sheet", pipeline);
    expect(out).toContain("Paso 1");
    expect(out).toContain("'reporte_corte'");
    expect(out).toContain("nombre exacto de la hoja");
  });

  it("traduce headerDetection.expectedColumns", () => {
    const out = humanizePath(
      "$.steps[0].headerDetection.expectedColumns",
      pipeline
    );
    expect(out).toContain("Detectar automáticamente");
  });

  it("traduce filter_rows.source", () => {
    const out = humanizePath("$.steps[2].source", pipeline);
    expect(out).toContain("Paso 3");
    expect(out).toContain("dataset de origen");
  });

  it("traduce split_by_column.agencyColumn.report", () => {
    const out = humanizePath("$.steps[3].agencyColumn.report", pipeline);
    expect(out).toContain("Paso 4");
    expect(out).toContain("'segmentar'");
    expect(out).toContain("columna de agencia del reporte");
  });

  it("traduce unifyByLookup paths", () => {
    expect(
      humanizePath("$.steps[3].unifyByLookup.report.rucColumn", pipeline)
    ).toContain("RUC en el reporte");
    expect(
      humanizePath(
        "$.steps[3].unifyByLookup.base.canonicalNameColumn",
        pipeline
      )
    ).toContain("nombre unificado en la base");
  });

  it("traduce write_output paths", () => {
    expect(
      humanizePath("$.steps[5].zipFileNameTemplate", pipeline)
    ).toContain("ZIP");
    expect(
      humanizePath("$.steps[5].perAgency.fileNameTemplate", pipeline)
    ).toContain("nombre del archivo por agencia");
    expect(humanizePath("$.steps[5].perAgency.sheets", pipeline)).toContain(
      "hoja de salida"
    );
  });

  it("traduce reglas de headerHighlights con índice 1-based", () => {
    expect(
      humanizePath(
        "$.steps[5].perAgency.headerHighlights[2].fillColor",
        pipeline
      )
    ).toContain("regla de resaltado #3");
  });

  it("usa idx genérico cuando no hay pipeline", () => {
    const out = humanizePath("$.steps[3].agencyColumn.report");
    expect(out).toContain("Paso 4");
    expect(out).toContain("columna de agencia del reporte");
  });

  it("devuelve el path original si no hay mapeo", () => {
    expect(humanizePath("$.algo.no.mapeado")).toBe("$.algo.no.mapeado");
  });

  it("indica id duplicado o vacío", () => {
    const out = humanizePath("$.steps[1].id", pipeline);
    expect(out).toContain("identificador interno");
  });
});
