import { describe, it, expect } from "vitest";
import { executeDeriveColumn } from "./derive-column";
import type { Dataset, PipelineContext } from "@/lib/pipeline/types";

function makeCtx(ds: Dataset): PipelineContext {
  return {
    inputFileName: "test.xlsx",
    variables: new Map(),
    datasets: new Map([["src", ds]]),
    logs: [],
  };
}

describe("derive_column", () => {
  it("strip_suffix quita sufijo del departamento", () => {
    const ctx = makeCtx({
      columns: ["AGENCIA"],
      rows: [
        { AGENCIA: "PIURA PIURA" },
        { AGENCIA: "CHICLAYO LAMBAYEQUE" },
        { AGENCIA: "LIMA" },
      ],
    });
    const ds = executeDeriveColumn(
      {
        id: "d",
        type: "derive_column",
        source: "src",
        newColumn: "AGENCIA_CLEAN",
        op: "strip_suffix",
        sourceColumns: ["AGENCIA"],
        suffixes: ["PIURA", "LAMBAYEQUE"],
      },
      ctx
    );
    expect(ds.rows.map((r) => r.AGENCIA_CLEAN)).toEqual(["PIURA", "CHICLAYO", "LIMA"]);
    expect(ds.columns).toContain("AGENCIA_CLEAN");
  });

  it("lookup homologa valores con tabla case-insensitive sin tildes", () => {
    const ctx = makeCtx({
      columns: ["ZONA"],
      rows: [{ ZONA: "Piúra" }, { ZONA: "lambayeque" }, { ZONA: "desconocida" }],
    });
    const ds = executeDeriveColumn(
      {
        id: "d",
        type: "derive_column",
        source: "src",
        newColumn: "ZONA_CANONICA",
        op: "lookup",
        sourceColumns: ["ZONA"],
        lookupTable: {
          PIURA: "NORTE",
          LAMBAYEQUE: "NORTE",
          AREQUIPA: "SUR",
        },
      },
      ctx
    );
    expect(ds.rows[0].ZONA_CANONICA).toBe("NORTE");
    expect(ds.rows[1].ZONA_CANONICA).toBe("NORTE");
    expect(ds.rows[2].ZONA_CANONICA).toBe("desconocida");
  });

  it("normalize_name con removeChars y upper", () => {
    const ctx = makeCtx({
      columns: ["AGENCIA"],
      rows: [{ AGENCIA: "Exportel, S.A.C." }],
    });
    const ds = executeDeriveColumn(
      {
        id: "d",
        type: "derive_column",
        source: "src",
        newColumn: "AGENCIA_NORM",
        op: "normalize_name",
        sourceColumns: ["AGENCIA"],
        normalize: { removeChars: ".,", upper: true },
      },
      ctx
    );
    expect(ds.rows[0].AGENCIA_NORM).toBe("EXPORTEL SAC");
  });

  it("concat junta columnas con separador", () => {
    const ctx = makeCtx({
      columns: ["PROV", "DPTO"],
      rows: [{ PROV: "Piura", DPTO: "Piura" }, { PROV: "Chiclayo", DPTO: "Lambayeque" }],
    });
    const ds = executeDeriveColumn(
      {
        id: "d",
        type: "derive_column",
        source: "src",
        newColumn: "FULL",
        op: "concat",
        sourceColumns: ["PROV", "DPTO"],
        separator: " - ",
      },
      ctx
    );
    expect(ds.rows[0].FULL).toBe("Piura - Piura");
    expect(ds.rows[1].FULL).toBe("Chiclayo - Lambayeque");
  });

  it("constant asigna un valor fijo a todas las filas", () => {
    const ctx = makeCtx({
      columns: ["X"],
      rows: [{ X: 1 }, { X: 2 }],
    });
    const ds = executeDeriveColumn(
      {
        id: "d",
        type: "derive_column",
        source: "src",
        newColumn: "TAG",
        op: "constant",
        constant: "LIMA",
      },
      ctx
    );
    expect(ds.rows.every((r) => r.TAG === "LIMA")).toBe(true);
  });

  it("regex_replace aplica reemplazo", () => {
    const ctx = makeCtx({
      columns: ["T"],
      rows: [{ T: "2026-03-15" }],
    });
    const ds = executeDeriveColumn(
      {
        id: "d",
        type: "derive_column",
        source: "src",
        newColumn: "T_CLEAN",
        op: "regex_replace",
        sourceColumns: ["T"],
        pattern: "-",
        replacement: "/",
      },
      ctx
    );
    expect(ds.rows[0].T_CLEAN).toBe("2026/03/15");
  });
});
