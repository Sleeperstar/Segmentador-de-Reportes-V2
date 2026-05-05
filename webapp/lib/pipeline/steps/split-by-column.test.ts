import { describe, it, expect } from "vitest";
import { executeSplitByColumn, buildAliasResolver } from "./split-by-column";
import type { Dataset, PipelineContext } from "@/lib/pipeline/types";

describe("buildAliasResolver", () => {
  it("resuelve variantes a canonical", () => {
    const resolve = buildAliasResolver([
      { canonical: "EXPORTEL SAC", variants: ["Exportel", "EXPORTEL S.A.C."] },
    ]);
    expect(resolve("Exportel").displayName).toBe("EXPORTEL SAC");
    expect(resolve("EXPORTEL S.A.C.").displayName).toBe("EXPORTEL SAC");
  });

  it("agencias sin alias usan su propio valor como displayName", () => {
    const resolve = buildAliasResolver([]);
    const r = resolve("Piura Centro");
    expect(r.displayName).toBe("Piura Centro");
    expect(r.key).toBe("PIURA CENTRO");
  });
});

describe("split_by_column", () => {
  const detalle: Dataset = {
    columns: ["AGENCIA", "COD_PEDIDO"],
    rows: [
      { AGENCIA: "Piura", COD_PEDIDO: 1 },
      { AGENCIA: "Piura", COD_PEDIDO: 2 },
      { AGENCIA: "Chiclayo", COD_PEDIDO: 3 },
    ],
  };
  const horizontal: Dataset = {
    columns: ["AGENCIA", "ALTAS"],
    rows: [
      { AGENCIA: "PIURA", ALTAS: 10 },
      { AGENCIA: "CHICLAYO", ALTAS: 20 },
    ],
  };
  const vertical: Dataset = {
    columns: ["AGENCIA", "ALTAS"],
    rows: [{ AGENCIA: "Piura", ALTAS: 5 }],
  };

  function ctx(): PipelineContext {
    return {
      inputFileName: "test.xlsx",
      variables: new Map(),
      datasets: new Map<string, Dataset>([
        ["detalle", detalle],
        ["horizontal", horizontal],
        ["vertical", vertical],
      ]),
      logs: [],
    };
  }

  it("segmenta múltiples reportes y un dataset base en grupos por agencia", () => {
    const c = ctx();
    const groups = executeSplitByColumn(
      {
        id: "s",
        type: "split_by_column",
        reportSources: ["horizontal", "vertical"],
        baseSource: "detalle",
        agencyColumn: { report: "AGENCIA" },
      },
      c
    );

    expect(groups.size).toBe(2);
    const piura = groups.get("PIURA");
    expect(piura).toBeDefined();
    expect(piura?.datasets.get("detalle")?.rows).toHaveLength(2);
    expect(piura?.datasets.get("horizontal")?.rows).toHaveLength(1);
    expect(piura?.datasets.get("vertical")?.rows).toHaveLength(1);

    const chiclayo = groups.get("CHICLAYO");
    expect(chiclayo?.datasets.get("vertical")).toBeUndefined();
  });

  it("aplica aliases para consolidar variantes bajo mismo grupo", () => {
    const c = ctx();
    c.datasets.set("detalle", {
      columns: ["AGENCIA", "COD_PEDIDO"],
      rows: [
        { AGENCIA: "Exportel", COD_PEDIDO: 1 },
        { AGENCIA: "EXPORTEL S.A.C.", COD_PEDIDO: 2 },
      ],
    });
    c.datasets.set("horizontal", {
      columns: ["AGENCIA", "ALTAS"],
      rows: [{ AGENCIA: "exportel sac", ALTAS: 99 }],
    });
    const groups = executeSplitByColumn(
      {
        id: "s",
        type: "split_by_column",
        reportSources: ["horizontal"],
        baseSource: "detalle",
        agencyColumn: { report: "AGENCIA" },
        aliases: [
          { canonical: "EXPORTEL SAC", variants: ["Exportel", "EXPORTEL S.A.C."] },
        ],
      },
      c
    );

    expect(groups.size).toBe(1);
    const g = [...groups.values()][0];
    expect(g.displayName).toBe("EXPORTEL SAC");
    expect(g.datasets.get("detalle")?.rows).toHaveLength(2);
    expect(g.datasets.get("horizontal")?.rows).toHaveLength(1);
  });

  it("ignora filas con agencia vacía", () => {
    const c = ctx();
    c.datasets.set("detalle", {
      columns: ["AGENCIA", "X"],
      rows: [
        { AGENCIA: "Piura", X: 1 },
        { AGENCIA: null, X: 2 },
        { AGENCIA: "", X: 3 },
      ],
    });
    const groups = executeSplitByColumn(
      {
        id: "s",
        type: "split_by_column",
        reportSources: [],
        baseSource: "detalle",
        agencyColumn: { report: "AGENCIA" },
      },
      c
    );
    expect(groups.size).toBe(1);
  });

  it("lanza error si la columna de agencia no existe", () => {
    const c = ctx();
    expect(() =>
      executeSplitByColumn(
        {
          id: "s",
          type: "split_by_column",
          reportSources: ["horizontal"],
          agencyColumn: { report: "NO_EXISTE" },
        },
        c
      )
    ).toThrow(/no tiene la columna de agencia/);
  });
});
