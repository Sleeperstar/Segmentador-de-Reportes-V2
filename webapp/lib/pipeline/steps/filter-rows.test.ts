import { describe, it, expect } from "vitest";
import { executeFilterRows } from "./filter-rows";
import type { Dataset, PipelineContext } from "@/lib/pipeline/types";

function makeCtx(ds: Dataset, vars: Record<string, string> = {}): PipelineContext {
  return {
    inputFileName: "test.xlsx",
    variables: new Map(Object.entries(vars)),
    datasets: new Map([["source", ds]]),
    logs: [],
  };
}

const sampleDs: Dataset = {
  columns: ["COD_PEDIDO", "CANAL", "TIPO_ESTADO", "PERIODO_COMI", "MONTO"],
  rows: [
    { COD_PEDIDO: 1, CANAL: "Agencias", TIPO_ESTADO: "Validado", PERIODO_COMI: "202603", MONTO: 100 },
    { COD_PEDIDO: 2, CANAL: "Agencias", TIPO_ESTADO: "Rescate", PERIODO_COMI: "202603", MONTO: 200 },
    { COD_PEDIDO: 3, CANAL: "WEB", TIPO_ESTADO: "Validado", PERIODO_COMI: "202603", MONTO: 300 },
    { COD_PEDIDO: 4, CANAL: "Agencias", TIPO_ESTADO: "Validado", PERIODO_COMI: "202602", MONTO: 400 },
    { COD_PEDIDO: 5, CANAL: "Agencias", TIPO_ESTADO: null, PERIODO_COMI: "202603", MONTO: null },
  ],
};

describe("filter_rows", () => {
  it("equals con literal", () => {
    const ctx = makeCtx(sampleDs);
    const ds = executeFilterRows(
      {
        id: "f",
        type: "filter_rows",
        source: "source",
        filters: [{ column: "CANAL", op: "equals", value: "Agencias" }],
      },
      ctx
    );
    expect(ds.rows).toHaveLength(4);
  });

  it("in con lista", () => {
    const ctx = makeCtx(sampleDs);
    const ds = executeFilterRows(
      {
        id: "f",
        type: "filter_rows",
        source: "source",
        filters: [{ column: "TIPO_ESTADO", op: "in", value: ["Validado", "Rescate"] }],
      },
      ctx
    );
    expect(ds.rows).toHaveLength(4);
  });

  it("combina múltiples filtros con AND (default)", () => {
    const ctx = makeCtx(sampleDs);
    const ds = executeFilterRows(
      {
        id: "f",
        type: "filter_rows",
        source: "source",
        filters: [
          { column: "CANAL", op: "equals", value: "Agencias" },
          { column: "TIPO_ESTADO", op: "in", value: ["Validado", "Rescate"] },
        ],
      },
      ctx
    );
    expect(ds.rows).toHaveLength(3);
    expect(ds.rows.map((r) => r.COD_PEDIDO)).toEqual([1, 2, 4]);
  });

  it("resuelve variable $PERIODO_COMI desde el contexto", () => {
    const ctx = makeCtx(sampleDs, { PERIODO_COMI: "202603" });
    const ds = executeFilterRows(
      {
        id: "f",
        type: "filter_rows",
        source: "source",
        filters: [{ column: "PERIODO_COMI", op: "equals", value: "$PERIODO_COMI" }],
      },
      ctx
    );
    expect(ds.rows).toHaveLength(4);
  });

  it("not_null excluye nulls y strings vacíos", () => {
    const ctx = makeCtx(sampleDs);
    const ds = executeFilterRows(
      {
        id: "f",
        type: "filter_rows",
        source: "source",
        filters: [{ column: "TIPO_ESTADO", op: "not_null" }],
      },
      ctx
    );
    expect(ds.rows).toHaveLength(4);
  });

  it("gte con número", () => {
    const ctx = makeCtx(sampleDs);
    const ds = executeFilterRows(
      {
        id: "f",
        type: "filter_rows",
        source: "source",
        filters: [{ column: "MONTO", op: "gte", value: 200 }],
      },
      ctx
    );
    expect(ds.rows.map((r) => r.COD_PEDIDO)).toEqual([2, 3, 4]);
  });

  it("modo OR", () => {
    const ctx = makeCtx(sampleDs);
    const ds = executeFilterRows(
      {
        id: "f",
        type: "filter_rows",
        source: "source",
        combine: "or",
        filters: [
          { column: "CANAL", op: "equals", value: "WEB" },
          { column: "MONTO", op: "gte", value: 400 },
        ],
      },
      ctx
    );
    expect(ds.rows.map((r) => r.COD_PEDIDO)).toEqual([3, 4]);
  });

  it("lanza error si la fuente no existe", () => {
    const ctx = makeCtx(sampleDs);
    expect(() =>
      executeFilterRows(
        { id: "f", type: "filter_rows", source: "missing", filters: [] },
        ctx
      )
    ).toThrow(/no se encontró el dataset fuente/);
  });
});
