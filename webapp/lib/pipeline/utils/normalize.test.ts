import { describe, it, expect } from "vitest";
import { normalize, normalizedEquals, sanitizeFileName } from "./normalize";

describe("normalize", () => {
  it("valor vacío o nulo retorna cadena vacía", () => {
    expect(normalize(null)).toBe("");
    expect(normalize(undefined)).toBe("");
    expect(normalize("")).toBe("");
  });

  it("convierte a mayúsculas por defecto", () => {
    expect(normalize("exportel sac")).toBe("EXPORTEL SAC");
  });

  it("elimina tildes", () => {
    expect(normalize("Agencía Piúra")).toBe("AGENCIA PIURA");
  });

  it("elimina caracteres especificados", () => {
    expect(normalize("EXPORTEL S.A.C.", { removeChars: "." })).toBe(
      "EXPORTEL SAC"
    );
  });

  it("colapsa espacios múltiples", () => {
    expect(normalize("MI    AGENCIA   PIURA")).toBe("MI AGENCIA PIURA");
  });

  it("respeta opciones compuestas", () => {
    expect(
      normalize("  Exportel, S.A.C.  ", {
        removeChars: ",.",
        trim: true,
      })
    ).toBe("EXPORTEL SAC");
  });

  it("soporta modo lower", () => {
    expect(normalize("EXPORTEL SAC", { upper: false, lower: true })).toBe(
      "exportel sac"
    );
  });

  it("acepta número como valor", () => {
    expect(normalize(123)).toBe("123");
  });
});

describe("normalizedEquals", () => {
  it("compara ignorando tildes y mayúsculas", () => {
    expect(normalizedEquals("Exportel S.A.C.", "EXPORTEL SAC", { removeChars: "." })).toBe(true);
    expect(normalizedEquals("AGENCIA PIURA", "AGENCIA PÍURA")).toBe(true);
  });

  it("retorna false cuando no coinciden", () => {
    expect(normalizedEquals("AGENCIA A", "AGENCIA B")).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("elimina caracteres inválidos para filesystem", () => {
    expect(sanitizeFileName('Agen<>cia:"/\\|?*')).toBe("Agencia");
  });

  it("quita tildes", () => {
    expect(sanitizeFileName("Agencía Piúra")).toBe("Agencia Piura");
  });

  it("colapsa espacios", () => {
    expect(sanitizeFileName("Mi   Agencia")).toBe("Mi Agencia");
  });
});
