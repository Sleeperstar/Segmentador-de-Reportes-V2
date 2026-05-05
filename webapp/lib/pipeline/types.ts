/**
 * Tipos del motor de pipeline del Segmentador de Reportes.
 *
 * El pipeline es una lista declarativa de pasos que el engine interpreta.
 * Cada paso lee uno o más datasets del context y produce uno nuevo.
 */

/* ---------- Datos ---------- */

/** Valor de una celda tras lectura/normalización. */
export type CellValue = string | number | boolean | Date | null;

export type Row = Record<string, CellValue>;

/** Representación en memoria de una tabla (hoja o resultado intermedio). */
export type Dataset = {
  columns: string[];
  rows: Row[];
  meta?: {
    sourceSheet?: string;
    headerRow?: number;
    headerStrategy?: HeaderStrategy;
  };
};

/* ---------- Inputs y variables ---------- */

export type FileNameTransform = "monthYearToYYYYMM" | "upper" | "lower" | "trim";

export type DerivedVariable = {
  name: string;
  from: "fileName" | "regexGroup";
  /** Si `from = 'regexGroup'`, nombre del grupo; si `from = 'fileName'` se transforma la captura. */
  source?: string;
  transform?: FileNameTransform;
};

export type PipelineInputs = {
  /** Regex (con grupos nombrados opcional) para extraer variables del nombre del archivo. */
  fileNamePattern?: string;
  derivedVariables?: DerivedVariable[];
};

/* ---------- Lectura de hojas ---------- */

export type HeaderStrategy = "auto" | "fixed_row" | "multi_level";

export type HeaderDetection =
  | { strategy: "auto"; expectedColumns: string[]; maxScanRows?: number }
  | { strategy: "fixed_row"; row: number }
  | { strategy: "multi_level"; rows: number[] };

/* ---------- Filtros ---------- */

export type FilterOp =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "contains"
  | "not_null"
  | "is_null"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between";

export type FilterValue = string | number | boolean | null | string[] | number[];

export type Filter = {
  column: string;
  op: FilterOp;
  /** Puede ser un literal, un array, o una referencia a variable con prefijo `$` (ej `"$PERIODO_COMI"`). */
  value?: FilterValue | `$${string}`;
  /** Para between: segundo valor. */
  value2?: FilterValue | `$${string}`;
};

/* ---------- Derive column ---------- */

export type DeriveOp =
  | "strip_suffix"
  | "lookup"
  | "normalize_name"
  | "concat"
  | "regex_replace"
  | "constant";

export type DeriveColumnStep = {
  id: string;
  type: "derive_column";
  source: string;
  newColumn: string;
  op: DeriveOp;
  /** Columnas fuente, según la operación (1+ columnas). */
  sourceColumns?: string[];
  /** Para strip_suffix: lista de sufijos candidatos (se elimina el primero que matchea case-insensitive). */
  suffixes?: string[];
  /** Para lookup: mapa valor-origen -> valor-destino (case-insensitive, sin tildes). */
  lookupTable?: Record<string, string>;
  /** Para normalize_name: opciones. */
  normalize?: NormalizeOptions;
  /** Para concat: separador. */
  separator?: string;
  /** Para regex_replace. */
  pattern?: string;
  replacement?: string;
  /** Para constant. */
  constant?: string;
};

/* ---------- Normalización ---------- */

export type NormalizeOptions = {
  upper?: boolean;
  lower?: boolean;
  trim?: boolean;
  removeAccents?: boolean;
  /** Caracteres que se eliminan completamente (ej: "." para "EXPORTEL S.A.C." → "EXPORTEL SAC"). */
  removeChars?: string;
  /** Si true, colapsa múltiples espacios a uno. */
  collapseSpaces?: boolean;
};

/* ---------- Pasos ---------- */

export type LoadSheetStep = {
  id: string;
  type: "load_sheet";
  sheet: string;
  headerDetection: HeaderDetection;
};

export type FilterRowsStep = {
  id: string;
  type: "filter_rows";
  source: string;
  filters: Filter[];
  /** 'and' (default) o 'or'. */
  combine?: "and" | "or";
};

export type Alias = {
  canonical: string;
  variants: string[];
};

export type SplitByColumnStep = {
  id: string;
  type: "split_by_column";
  /** Uno o más datasets de reporte que se segmentan por la columna de agencia. */
  reportSources: string[];
  /** Dataset base/detalle (opcional) que también se segmenta. */
  baseSource?: string;
  /** Nombre de la columna de agencia en cada tipo de dataset. */
  agencyColumn: {
    report: string;
    base?: string;
  };
  normalize?: NormalizeOptions;
  aliases?: Alias[];
};

export type JoinStep = {
  id: string;
  type: "join";
  left: string;
  right: string;
  on: { left: string; right: string };
  kind?: "inner" | "left";
};

export type ValidateRule = {
  name: string;
  left: AggregateSpec;
  right: AggregateSpec;
  onMismatch?: "warn" | "error";
  /** Tolerancia absoluta para comparación numérica (default 0). */
  tolerance?: number;
};

export type AggregateSpec = {
  aggregate: "sum" | "count" | "count_distinct" | "min" | "max" | "avg";
  column: string;
  from: string | string[];
  /** 'global' (default) o 'per_agency'. */
  scope?: "global" | "per_agency";
};

export type ValidateStep = {
  id: string;
  type: "validate";
  rules: ValidateRule[];
};

export type WriteOutputStep = {
  id: string;
  type: "write_output";
  perAgency: {
    sheets: OutputSheet[];
    fileNameTemplate: string;
    formats?: OutputFormat[];
  };
  zipFileNameTemplate: string;
};

export type OutputSheet = {
  name: string;
  from: string;
  /** Si el paso `from` fue segmentado por agencia, se aplica filtro a la sub-hoja correspondiente. */
  filterToAgency?: boolean;
};

export type OutputFormat = {
  columns: string[];
  format: "percent" | "number" | "currency" | "integer";
  /** Estilo de cabecera (opcional). */
  headerStyle?: "default" | "penalty" | "clawback";
};

export type PipelineStep =
  | LoadSheetStep
  | FilterRowsStep
  | DeriveColumnStep
  | SplitByColumnStep
  | JoinStep
  | ValidateStep
  | WriteOutputStep;

export type Pipeline = {
  inputs?: PipelineInputs;
  steps: PipelineStep[];
};

/* ---------- Contexto y logs ---------- */

export type LogLevel = "info" | "warn" | "error" | "success";

export type LogEntry = {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: Date;
};

/**
 * Conjunto de datasets agrupados por valor (ej. una agencia).
 *
 * key = valor normalizado de la agencia
 * displayName = valor original (para mostrar al usuario / nombre de archivo)
 * datasets = Map de stepId → Dataset filtrado a ese grupo
 */
export type Group = {
  key: string;
  displayName: string;
  datasets: Map<string, Dataset>;
};

export type PipelineContext = {
  inputFileName: string;
  variables: Map<string, string>;
  datasets: Map<string, Dataset>;
  groups?: Map<string, Group>;
  logs: LogEntry[];
};

/* ---------- Resultados ---------- */

export type ValidationResult = {
  ruleName: string;
  groupKey?: string;
  left: number;
  right: number;
  matched: boolean;
};

export type PipelineOutput = {
  /** Bytes del ZIP generado. */
  zipBuffer: Buffer;
  /** Nombre sugerido del ZIP. */
  zipFileName: string;
  /** Resumen estadístico. */
  summary: {
    totalGroups: number;
    successful: number;
    mismatches: number;
    filesGenerated: number;
  };
  validations: ValidationResult[];
};

export type PipelineResult = {
  status: "success" | "partial" | "error";
  output?: PipelineOutput;
  error?: { message: string; stepId?: string };
  logs: LogEntry[];
};
