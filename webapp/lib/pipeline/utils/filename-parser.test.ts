import { describe, it, expect } from "vitest";
import {
  monthYearToYYYYMM,
  parseFileName,
  resolveValue,
} from "./filename-parser";

describe("monthYearToYYYYMM", () => {
  it("convierte formato 'MARZO 2026' → '202603'", () => {
    expect(monthYearToYYYYMM("MARZO 2026")).toBe("202603");
  });

  it("acepta minúsculas", () => {
    expect(monthYearToYYYYMM("marzo 2026")).toBe("202603");
  });

  it("acepta orden invertido", () => {
    expect(monthYearToYYYYMM("2026 Marzo")).toBe("202603");
  });

  it("acepta setiembre y septiembre como mes 09", () => {
    expect(monthYearToYYYYMM("SETIEMBRE 2026")).toBe("202609");
    expect(monthYearToYYYYMM("SEPTIEMBRE 2026")).toBe("202609");
  });

  it("retorna null si no hay mes válido", () => {
    expect(monthYearToYYYYMM("INVIERNO 2026")).toBeNull();
  });

  it("retorna null si falta año", () => {
    expect(monthYearToYYYYMM("MARZO")).toBeNull();
  });
});

describe("parseFileName", () => {
  it("extrae grupos nombrados del regex", () => {
    const { variables, warnings } = parseFileName(
      "Reportes AGENCIA LIMA Corte 1 MARZO 2026",
      {
        fileNamePattern:
          "Reportes AGENCIA LIMA Corte (?<corte>\\d+) (?<mes>\\w+) (?<anio>\\d{4})",
      }
    );

    expect(warnings).toEqual([]);
    expect(variables.get("corte")).toBe("1");
    expect(variables.get("mes")).toBe("MARZO");
    expect(variables.get("anio")).toBe("2026");
  });

  it("deriva PERIODO_COMI usando monthYearToYYYYMM a partir de mes+anio", () => {
    const { variables } = parseFileName(
      "Reportes AGENCIA LIMA Corte 1 MARZO 2026",
      {
        fileNamePattern:
          "Reportes AGENCIA LIMA Corte (?<corte>\\d+) (?<mes>\\w+) (?<anio>\\d{4})",
        derivedVariables: [
          { name: "PERIODO_COMI", from: "fileName", transform: "monthYearToYYYYMM" },
        ],
      }
    );

    expect(variables.get("PERIODO_COMI")).toBe("202603");
  });

  it("agrega warning si el regex no matchea", () => {
    const { warnings } = parseFileName("archivo_raro.xlsx", {
      fileNamePattern: "Reportes LIMA Corte (?<c>\\d+)",
    });
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("sin inputs retorna variables vacío sin warnings", () => {
    const { variables, warnings } = parseFileName("cualquier.xlsx");
    expect(variables.size).toBe(0);
    expect(warnings).toEqual([]);
  });
});

describe("resolveValue", () => {
  it("devuelve literal tal cual", () => {
    const vars = new Map<string, string>();
    expect(resolveValue("Agencias", vars)).toBe("Agencias");
    expect(resolveValue(42, vars)).toBe(42);
  });

  it("resuelve referencia $VARIABLE desde el map", () => {
    const vars = new Map([["PERIODO_COMI", "202603"]]);
    expect(resolveValue("$PERIODO_COMI", vars)).toBe("202603");
  });

  it("retorna null si la variable no existe", () => {
    const vars = new Map<string, string>();
    expect(resolveValue("$NO_EXISTE", vars)).toBeNull();
  });
});
