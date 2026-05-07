import { describe, it, expect } from "vitest";
import { unifyGroupsByRuc } from "./unify-groups";
import { executeSplitByColumn } from "./split-by-column";
import type {
  Dataset,
  PipelineContext,
  SplitByColumnStep,
} from "@/lib/pipeline/types";

function makeCtx(datasets: Record<string, Dataset>): PipelineContext {
  return {
    inputFileName: "test.xlsx",
    variables: new Map(),
    datasets: new Map(Object.entries(datasets)),
    logs: [],
  };
}

describe("unifyGroupsByRuc", () => {
  const reporte: Dataset = {
    columns: ["RUC", "AGENCIA", "ALTAS"],
    rows: [
      { RUC: "20512345678", AGENCIA: "ALIV TELECOM S.A.C. Áncash", ALTAS: 5 },
      { RUC: "20512345678", AGENCIA: "ALIV TELECOM S.A.C. La Libertad", ALTAS: 3 },
      { RUC: "20512345678", AGENCIA: "ALIV TELECOM S.A.C. Lambayeque", ALTAS: 4 },
      { RUC: "20512345678", AGENCIA: "ALIV TELECOM S.A.C. Piura", ALTAS: 2 },
      { RUC: "20509876543", AGENCIA: "BELFECOM E.I.R.L. Tumbes", ALTAS: 7 },
      { RUC: "20509876543", AGENCIA: "BELFECOM E.I.R.L. Cajamarca", ALTAS: 6 },
    ],
  };
  const base: Dataset = {
    columns: ["DNI_ASESOR", "ASESOR", "AGENCIA DEPARTAMENTO", "COD_PEDIDO"],
    rows: [
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Áncash", COD_PEDIDO: 1 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Áncash", COD_PEDIDO: 2 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. La Libertad", COD_PEDIDO: 3 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. La Libertad", COD_PEDIDO: 4 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. La Libertad", COD_PEDIDO: 5 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Lambayeque", COD_PEDIDO: 6 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Lambayeque", COD_PEDIDO: 7 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Lambayeque", COD_PEDIDO: 8 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Lambayeque", COD_PEDIDO: 9 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Piura", COD_PEDIDO: 10 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Piura", COD_PEDIDO: 11 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Piura", COD_PEDIDO: 12 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Piura", COD_PEDIDO: 13 },
      { DNI_ASESOR: "20512345678", ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Piura", COD_PEDIDO: 14 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Tumbes", COD_PEDIDO: 15 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Tumbes", COD_PEDIDO: 16 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Tumbes", COD_PEDIDO: 17 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Tumbes", COD_PEDIDO: 18 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Tumbes", COD_PEDIDO: 19 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Tumbes", COD_PEDIDO: 20 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Tumbes", COD_PEDIDO: 21 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Cajamarca", COD_PEDIDO: 22 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Cajamarca", COD_PEDIDO: 23 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Cajamarca", COD_PEDIDO: 24 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Cajamarca", COD_PEDIDO: 25 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Cajamarca", COD_PEDIDO: 26 },
      { DNI_ASESOR: "20509876543", ASESOR: "BELFECOM E.I.R.L.", "AGENCIA DEPARTAMENTO": "BELFECOM E.I.R.L. Cajamarca", COD_PEDIDO: 27 },
    ],
  };

  const splitWithUnify: SplitByColumnStep = {
    id: "segmenta",
    type: "split_by_column",
    reportSources: ["reporte"],
    baseSource: "base",
    agencyColumn: { report: "AGENCIA", base: "AGENCIA DEPARTAMENTO" },
    unifyByLookup: {
      report: { rucColumn: "RUC" },
      base: { rucColumn: "DNI_ASESOR", canonicalNameColumn: "ASESOR" },
    },
  };

  it("fusiona N sub-agencias del mismo RUC en 1 grupo canónico", () => {
    const ctx = makeCtx({ reporte, base });
    executeSplitByColumn(splitWithUnify, ctx);
    expect(ctx.groups?.size).toBe(6);

    unifyGroupsByRuc(ctx, splitWithUnify);

    expect(ctx.groups?.size).toBe(2);
    const aliv = ctx.groups?.get("ALIV TELECOM S.A.C.");
    expect(aliv).toBeDefined();
    expect(aliv?.displayName).toBe("ALIV TELECOM S.A.C.");
    expect(aliv?.datasets.get("reporte")?.rows).toHaveLength(4);
    expect(aliv?.datasets.get("base")?.rows).toHaveLength(14);

    const belfecom = ctx.groups?.get("BELFECOM E.I.R.L.");
    expect(belfecom).toBeDefined();
    expect(belfecom?.datasets.get("reporte")?.rows).toHaveLength(2);
    expect(belfecom?.datasets.get("base")?.rows).toHaveLength(13);
  });

  it("la suma de ALTAS y el conteo de COD_PEDIDO se preservan tras la fusión", () => {
    const ctx = makeCtx({ reporte, base });
    executeSplitByColumn(splitWithUnify, ctx);
    unifyGroupsByRuc(ctx, splitWithUnify);

    const aliv = ctx.groups?.get("ALIV TELECOM S.A.C.");
    const totalAltas = (aliv?.datasets.get("reporte")?.rows ?? []).reduce(
      (acc, r) => acc + Number(r.ALTAS),
      0
    );
    const totalPedidos = (aliv?.datasets.get("base")?.rows ?? []).length;
    expect(totalAltas).toBe(14);
    expect(totalPedidos).toBe(14);
  });

  it("emite warn y conserva el grupo cuando el RUC del reporte no existe en base", () => {
    const reporteConHuerfano: Dataset = {
      columns: ["RUC", "AGENCIA", "ALTAS"],
      rows: [
        { RUC: "20999999999", AGENCIA: "AGENCIA HUERFANA", ALTAS: 1 },
        { RUC: "20512345678", AGENCIA: "ALIV TELECOM S.A.C. Áncash", ALTAS: 5 },
      ],
    };
    const ctx = makeCtx({ reporte: reporteConHuerfano, base });
    executeSplitByColumn(splitWithUnify, ctx);
    // 1 huérfano del reporte + 4 sub-agencias ALIV + 2 sub-agencias BELFECOM (del base) = 7
    expect(ctx.groups?.size).toBe(7);

    unifyGroupsByRuc(ctx, splitWithUnify);

    // Después de unify: HUERFANA (sin mapeo) + ALIV TELECOM S.A.C. + BELFECOM E.I.R.L.
    expect(ctx.groups?.size).toBe(3);
    expect(ctx.groups?.get("AGENCIA HUERFANA")).toBeDefined();
    expect(ctx.groups?.get("ALIV TELECOM S.A.C.")).toBeDefined();
    expect(ctx.groups?.get("BELFECOM E.I.R.L.")).toBeDefined();

    const warnLog = ctx.logs.find((l) => l.level === "warn" && l.message.includes("sin RUC mapeado"));
    expect(warnLog).toBeDefined();
  });

  it("sin unifyByLookup no modifica los grupos", () => {
    const splitNoUnify: SplitByColumnStep = {
      id: "segmenta",
      type: "split_by_column",
      reportSources: ["reporte"],
      baseSource: "base",
      agencyColumn: { report: "AGENCIA", base: "AGENCIA DEPARTAMENTO" },
    };
    const ctx = makeCtx({ reporte, base });
    executeSplitByColumn(splitNoUnify, ctx);
    const before = ctx.groups?.size;

    unifyGroupsByRuc(ctx, splitNoUnify);

    expect(ctx.groups?.size).toBe(before);
  });

  it("lanza error si la base no tiene la columna RUC declarada", () => {
    const baseSinRuc: Dataset = {
      columns: ["ASESOR", "AGENCIA DEPARTAMENTO", "COD_PEDIDO"],
      rows: [
        { ASESOR: "ALIV TELECOM S.A.C.", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Áncash", COD_PEDIDO: 1 },
      ],
    };
    const ctx = makeCtx({ reporte, base: baseSinRuc });
    executeSplitByColumn(splitWithUnify, ctx);
    expect(() => unifyGroupsByRuc(ctx, splitWithUnify)).toThrow(/columna RUC/);
  });

  it("lanza error si la base no tiene la columna de nombre canónico", () => {
    const baseSinAsesor: Dataset = {
      columns: ["DNI_ASESOR", "AGENCIA DEPARTAMENTO", "COD_PEDIDO"],
      rows: [
        { DNI_ASESOR: "20512345678", "AGENCIA DEPARTAMENTO": "ALIV TELECOM S.A.C. Áncash", COD_PEDIDO: 1 },
      ],
    };
    const ctx = makeCtx({ reporte, base: baseSinAsesor });
    executeSplitByColumn(splitWithUnify, ctx);
    expect(() => unifyGroupsByRuc(ctx, splitWithUnify)).toThrow(/nombre canónico/);
  });

  it("respeta grupos que ya tienen el mismo RUC y nombre canónico (caso degenerado: agencyColumn.base = ASESOR)", () => {
    const splitBaseAsesor: SplitByColumnStep = {
      id: "segmenta",
      type: "split_by_column",
      reportSources: ["reporte"],
      baseSource: "base",
      agencyColumn: { report: "AGENCIA", base: "ASESOR" },
      unifyByLookup: {
        report: { rucColumn: "RUC" },
        base: { rucColumn: "DNI_ASESOR", canonicalNameColumn: "ASESOR" },
      },
    };
    const ctx = makeCtx({ reporte, base });
    executeSplitByColumn(splitBaseAsesor, ctx);
    unifyGroupsByRuc(ctx, splitBaseAsesor);

    expect(ctx.groups?.size).toBe(2);
    const aliv = ctx.groups?.get("ALIV TELECOM S.A.C.");
    expect(aliv?.datasets.get("base")?.rows).toHaveLength(14);
    expect(aliv?.datasets.get("reporte")?.rows).toHaveLength(4);
  });
});
