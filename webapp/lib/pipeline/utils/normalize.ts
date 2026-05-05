import type { NormalizeOptions, CellValue } from "@/lib/pipeline/types";

const DEFAULT_NORMALIZE: Required<NormalizeOptions> = {
  upper: true,
  lower: false,
  trim: true,
  removeAccents: true,
  removeChars: "",
  collapseSpaces: true,
};

/**
 * Normaliza un string para comparaciones consistentes.
 *
 * Pasos por defecto:
 * 1. Convierte a string
 * 2. trim
 * 3. Quita tildes/diacríticos
 * 4. Elimina caracteres específicos (`removeChars`)
 * 5. Colapsa espacios múltiples
 * 6. Pasa a mayúsculas
 */
export function normalize(
  value: CellValue | undefined,
  options: NormalizeOptions = {}
): string {
  if (value === null || value === undefined) return "";
  const opts = { ...DEFAULT_NORMALIZE, ...options };

  let s = String(value);

  if (opts.trim) s = s.trim();

  if (opts.removeAccents) {
    s = s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  }

  if (opts.removeChars) {
    const chars = [...opts.removeChars];
    for (const c of chars) {
      s = s.split(c).join("");
    }
  }

  if (opts.collapseSpaces) {
    s = s.replace(/\s+/g, " ");
  }

  if (opts.upper && !opts.lower) s = s.toUpperCase();
  if (opts.lower && !opts.upper) s = s.toLowerCase();

  return s;
}

/**
 * Compara dos strings normalizados.
 */
export function normalizedEquals(
  a: CellValue | undefined,
  b: CellValue | undefined,
  options?: NormalizeOptions
): boolean {
  return normalize(a, options) === normalize(b, options);
}

/**
 * Sanitiza un nombre para que sea válido como nombre de archivo en Windows/Unix
 * y como key en Supabase Storage. Conserva letras, números, espacios, guiones
 * bajos, medios y paréntesis. Elimina llaves `{` y `}` (típicos de placeholders
 * sin resolver) y otros caracteres ilegales.
 */
export function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[<>:"/\\|?*\x00-\x1f{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
