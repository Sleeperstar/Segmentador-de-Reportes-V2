import { describe, it, expect } from "vitest";
import { executeJoin } from "./join";
import type { Dataset, PipelineContext } from "@/lib/pipeline/types";

function ctxWith(datasets: Record<string, Dataset>): PipelineContext {
  return {
    inputFileName: "test.xlsx",
    variables: new Map(),
    datasets: new Map(Object.entries(datasets)),
    logs: [],
  };
}

describe("join", () => {
  const left: Dataset = {
    columns: ["ID", "NOMBRE"],
    rows: [
      { ID: 1, NOMBRE: "A" },
      { ID: 2, NOMBRE: "B" },
      { ID: 3, NOMBRE: "C" },
    ],
  };
  const right: Dataset = {
    columns: ["REF", "MONTO"],
    rows: [
      { REF: 1, MONTO: 100 },
      { REF: 2, MONTO: 200 },
    ],
  };

  it("inner join incluye sólo filas con match", () => {
    const ctx = ctxWith({ l: left, r: right });
    const ds = executeJoin(
      { id: "j", type: "join", left: "l", right: "r", on: { left: "ID", right: "REF" } },
      ctx
    );
    expect(ds.rows).toHaveLength(2);
    expect(ds.columns).toEqual(["ID", "NOMBRE", "MONTO"]);
    expect(ds.rows[0]).toEqual({ ID: 1, NOMBRE: "A", MONTO: 100 });
  });

  it("left join incluye todas las filas de la izquierda", () => {
    const ctx = ctxWith({ l: left, r: right });
    const ds = executeJoin(
      {
        id: "j",
        type: "join",
        left: "l",
        right: "r",
        on: { left: "ID", right: "REF" },
        kind: "left",
      },
      ctx
    );
    expect(ds.rows).toHaveLength(3);
    expect(ds.rows[2]).toEqual({ ID: 3, NOMBRE: "C" });
  });

  it("renombra columnas con colisión", () => {
    const r2: Dataset = {
      columns: ["REF", "NOMBRE"],
      rows: [{ REF: 1, NOMBRE: "RIGHT-A" }],
    };
    const ctx = ctxWith({ l: left, r: r2 });
    const ds = executeJoin(
      { id: "j", type: "join", left: "l", right: "r", on: { left: "ID", right: "REF" } },
      ctx
    );
    expect(ds.columns).toEqual(["ID", "NOMBRE", "NOMBRE (right)"]);
    expect(ds.rows[0]).toEqual({ ID: 1, NOMBRE: "A", "NOMBRE (right)": "RIGHT-A" });
  });
});
