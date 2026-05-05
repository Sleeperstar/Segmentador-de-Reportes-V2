import type {
  DerivedVariable,
  FileNameTransform,
  PipelineInputs,
} from "@/lib/pipeline/types";

const MONTHS_ES: Record<string, string> = {
  ENERO: "01",
  FEBRERO: "02",
  MARZO: "03",
  ABRIL: "04",
  MAYO: "05",
  JUNIO: "06",
  JULIO: "07",
  AGOSTO: "08",
  SETIEMBRE: "09",
  SEPTIEMBRE: "09",
  OCTUBRE: "10",
  NOVIEMBRE: "11",
  DICIEMBRE: "12",
};

/**
 * Convierte una cadena "MARZO 2026" (o "Marzo 2026") a YYYYMM → "202603".
 * También acepta "2026 MARZO" por robustez. Retorna null si no puede parsear.
 */
export function monthYearToYYYYMM(input: string): string | null {
  const norm = input.trim().toUpperCase();
  const parts = norm.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  let month: string | undefined;
  let year: string | undefined;

  for (const p of parts) {
    if (MONTHS_ES[p]) month = MONTHS_ES[p];
    else if (/^\d{4}$/.test(p)) year = p;
  }

  if (!month || !year) return null;
  return `${year}${month}`;
}

/**
 * Aplica una transformación a un string.
 */
export function applyFileNameTransform(
  value: string,
  transform: FileNameTransform | undefined
): string | null {
  if (!transform) return value;
  switch (transform) {
    case "monthYearToYYYYMM":
      return monthYearToYYYYMM(value);
    case "upper":
      return value.toUpperCase();
    case "lower":
      return value.toLowerCase();
    case "trim":
      return value.trim();
    default:
      return value;
  }
}

/**
 * Parsea el nombre del archivo aplicando el regex y variables derivadas
 * definidas en `inputs`. Retorna un Map con todas las variables resueltas.
 *
 * - Variables directas: grupos nombrados del regex (ej `(?<mes>\w+)`) se
 *   agregan como `mes = MARZO`.
 * - Variables derivadas: se procesan según `from` y `transform`.
 *
 * Las keys del Map son los nombres tal cual (case-sensitive). Para usarlas
 * en filtros con sintaxis `$NOMBRE`, se buscan también con `$` prefix.
 */
export function parseFileName(
  fileName: string,
  inputs?: PipelineInputs
): { variables: Map<string, string>; warnings: string[] } {
  const variables = new Map<string, string>();
  const warnings: string[] = [];

  if (!inputs?.fileNamePattern) {
    return { variables, warnings };
  }

  let match: RegExpMatchArray | null = null;
  try {
    const regex = new RegExp(inputs.fileNamePattern);
    match = fileName.match(regex);
  } catch (err) {
    warnings.push(
      `Regex inválido en fileNamePattern: ${(err as Error).message}`
    );
    return { variables, warnings };
  }

  if (!match) {
    warnings.push(
      `El nombre de archivo "${fileName}" no coincide con el patrón esperado.`
    );
    return { variables, warnings };
  }

  // Grupos nombrados → variables
  if (match.groups) {
    for (const [key, value] of Object.entries(match.groups)) {
      if (value !== undefined) variables.set(key, value);
    }
  }

  // Variables derivadas
  for (const dv of inputs.derivedVariables ?? []) {
    const resolved = resolveDerivedVariable(dv, fileName, match, variables);
    if (resolved === null) {
      warnings.push(`No se pudo derivar la variable "${dv.name}".`);
    } else {
      variables.set(dv.name, resolved);
    }
  }

  return { variables, warnings };
}

function resolveDerivedVariable(
  dv: DerivedVariable,
  fileName: string,
  match: RegExpMatchArray,
  currentVars: Map<string, string>
): string | null {
  let raw: string | undefined;

  if (dv.from === "fileName") {
    if (dv.source) {
      // source es el nombre de un grupo del regex
      raw = match.groups?.[dv.source] ?? currentVars.get(dv.source);
    } else {
      // Caso típico: transformar la parte relevante del nombre.
      // Tomamos mes y año de currentVars (si existen) o fallback a fileName.
      const mes = currentVars.get("mes");
      const anio = currentVars.get("anio") ?? currentVars.get("año");
      if (mes && anio) {
        raw = `${mes} ${anio}`;
      } else {
        raw = fileName;
      }
    }
  } else if (dv.from === "regexGroup") {
    if (!dv.source) return null;
    raw = match.groups?.[dv.source];
  }

  if (raw === undefined || raw === null) return null;

  return applyFileNameTransform(raw, dv.transform);
}

/**
 * Resuelve un valor que puede ser una referencia a variable con prefijo `$`.
 */
export function resolveValue<T>(
  value: T | `$${string}`,
  variables: Map<string, string>
): T | string | null {
  if (typeof value === "string" && value.startsWith("$")) {
    const varName = value.slice(1);
    const resolved = variables.get(varName);
    return resolved ?? null;
  }
  return value as T;
}
