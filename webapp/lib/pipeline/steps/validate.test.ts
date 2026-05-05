import { describe, it, expect } from "vitest";
import { aggregate, evaluateRule, executeValidate } from "./validate";
import type {
  Dataset,
  Group,
  PipelineContext,
  ValidationResult,
} from "@/lib/pipeline/types";

describe("aggregate", () => {
  const rows = [
    { X: 10, A: "Piura" },
    { X: 20, A: "Piura" },
    { X: 5, A: "Lima" },
    { X: null, A: "Lima" },
    { X: "30", A: null },
  ];

  it("sum ignora valores no numéricos y convierte strings numéricos", () => {
    expect(aggregate({ aggregate: "sum", column: "X", from: "x" }, rows)).toBe(65);
  });

  it("count cuenta no nulos", () => {
    expect(aggregate({ aggregate: "count", column: "X", from: "x" }, rows)).toBe(4);
  });

  it("count_distinct cuenta únicos no nulos", () => {
    expect(aggregate({ aggregate: "count_distinct", column: "A", from: "x" }, rows)).toBe(2);
  });

  it("min y max", () => {
    expect(aggregate({ aggregate: "min", column: "X", from: "x" }, rows)).toBe(5);
    expect(aggregate({ aggregate: "max", column: "X", from: "x" }, rows)).toBe(30);
  });
});

describe("evaluateRule global", () => {
  it("compara sum de una hoja con count de otra (altas vs base)", () => {
    const horizontal: Dataset = {
      columns: ["ALTAS"],
      rows: [{ ALTAS: 3 }, { ALTAS: 5 }],
    };
    const base: Dataset = {
      columns: ["COD_PEDIDO"],
      rows: [{ COD_PEDIDO: 1 }, { COD_PEDIDO: 2 }, { COD_PEDIDO: 3 }, { COD_PEDIDO: 4 }, { COD_PEDIDO: 5 }, { COD_PEDIDO: 6 }, { COD_PEDIDO: 7 }, { COD_PEDIDO: 8 }],
    };
    const ctx: PipelineContext = {
      inputFileName: "t.xlsx",
      variables: new Map(),
      datasets: new Map([
        ["horizontal", horizontal],
        ["base", base],
      ]),
      logs: [],
    };
    const res = evaluateRule(
      {
        name: "altas==base",
        left: { aggregate: "sum", column: "ALTAS", from: "horizontal" },
        right: { aggregate: "count", column: "COD_PEDIDO", from: "base" },
      },
      ctx
    );
    expect(res).toHaveLength(1);
    expect(res[0].left).toBe(8);
    expect(res[0].right).toBe(8);
    expect(res[0].matched).toBe(true);
  });

  it("marca mismatch cuando los valores difieren", () => {
    const a: Dataset = { columns: ["X"], rows: [{ X: 10 }] };
    const b: Dataset = { columns: ["Y"], rows: [{ Y: 5 }] };
    const ctx: PipelineContext = {
      inputFileName: "t.xlsx",
      variables: new Map(),
      datasets: new Map([["a", a], ["b", b]]),
      logs: [],
    };
    const res = evaluateRule(
      {
        name: "compare",
        left: { aggregate: "sum", column: "X", from: "a" },
        right: { aggregate: "sum", column: "Y", from: "b" },
      },
      ctx
    );
    expect(res[0].matched).toBe(false);
  });
});

describe("evaluateRule per_agency", () => {
  it("compara sum altas de reporte vs count pedidos de base por agencia", () => {
    const piura: Group = {
      key: "PIURA",
      displayName: "Piura",
      datasets: new Map([
        ["horizontal", { columns: ["ALTAS"], rows: [{ ALTAS: 5 }] }],
        ["base", { columns: ["COD_PEDIDO"], rows: [{ COD_PEDIDO: 1 }, { COD_PEDIDO: 2 }, { COD_PEDIDO: 3 }, { COD_PEDIDO: 4 }, { COD_PEDIDO: 5 }] }],
      ]),
    };
    const lima: Group = {
      key: "LIMA",
      displayName: "Lima",
      datasets: new Map([
        ["horizontal", { columns: ["ALTAS"], rows: [{ ALTAS: 3 }] }],
        ["base", { columns: ["COD_PEDIDO"], rows: [{ COD_PEDIDO: 10 }, { COD_PEDIDO: 11 }] }],
      ]),
    };
    const ctx: PipelineContext = {
      inputFileName: "t.xlsx",
      variables: new Map(),
      datasets: new Map(),
      groups: new Map([["PIURA", piura], ["LIMA", lima]]),
      logs: [],
    };
    const res = evaluateRule(
      {
        name: "altas==pedidos",
        left: { aggregate: "sum", column: "ALTAS", from: "horizontal", scope: "per_agency" },
        right: { aggregate: "count", column: "COD_PEDIDO", from: "base", scope: "per_agency" },
      },
      ctx
    );
    expect(res).toHaveLength(2);
    const piuraRes = res.find((r) => r.groupKey === "PIURA")!;
    expect(piuraRes.matched).toBe(true);
    const limaRes = res.find((r) => r.groupKey === "LIMA")!;
    expect(limaRes.left).toBe(3);
    expect(limaRes.right).toBe(2);
    expect(limaRes.matched).toBe(false);
  });
});

describe("executeValidate", () => {
  it("acumula resultados y escribe logs apropiados", () => {
    const ctx: PipelineContext = {
      inputFileName: "t.xlsx",
      variables: new Map(),
      datasets: new Map([
        ["a", { columns: ["X"], rows: [{ X: 5 }] }],
        ["b", { columns: ["Y"], rows: [{ Y: 5 }] }],
      ]),
      logs: [],
    };
    const acc: ValidationResult[] = [];
    executeValidate(
      {
        id: "v",
        type: "validate",
        rules: [
          {
            name: "r1",
            left: { aggregate: "sum", column: "X", from: "a" },
            right: { aggregate: "sum", column: "Y", from: "b" },
          },
        ],
      },
      ctx,
      acc
    );
    expect(acc).toHaveLength(1);
    expect(acc[0].matched).toBe(true);
    expect(ctx.logs.some((l) => l.level === "success")).toBe(true);
  });
});
