"use client";

import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CommaSeparatedInput } from "./comma-input";
import { DatasetSelect } from "./components/dataset-select";
import { DatasetMultiSelect } from "./components/dataset-multi-select";
import {
  AGGREGATE_LABELS,
  ON_MISMATCH_LABELS,
  SCOPE_LABELS,
  aggregateLabel,
  entries,
  onMismatchLabel,
  scopeLabel,
} from "@/lib/wizard/labels";
import type { DatasetOption } from "@/lib/wizard/describe-dataset";
import type {
  AggregateSpec,
  Alias,
  SplitByColumnStep,
  ValidateRule,
  ValidateStep,
} from "@/lib/pipeline/types";

type Aggregate = AggregateSpec["aggregate"];

export function SplitValidateTab({
  split,
  validate,
  availableSources,
  onSplitChange,
  onValidateChange,
}: {
  split: SplitByColumnStep | null;
  validate: ValidateStep | null;
  availableSources: DatasetOption[];
  onSplitChange: (s: SplitByColumnStep | null) => void;
  onValidateChange: (s: ValidateStep | null) => void;
}) {
  function ensureSplit(): SplitByColumnStep {
    if (split) return split;
    const next: SplitByColumnStep = {
      id: "segmenta",
      type: "split_by_column",
      reportSources: [],
      agencyColumn: { report: "" },
    };
    onSplitChange(next);
    return next;
  }

  function setSplit(patch: Partial<SplitByColumnStep>) {
    const cur = ensureSplit();
    onSplitChange({ ...cur, ...patch });
  }

  const aliases = split?.aliases ?? [];

  function setAliases(next: Alias[]) {
    setSplit({ aliases: next });
  }

  /* ---------- Unify by lookup ---------- */

  const unify = split?.unifyByLookup;

  function setUnifyField(
    side: "report" | "base",
    field: "rucColumn" | "canonicalNameColumn",
    value: string
  ) {
    const cur: NonNullable<SplitByColumnStep["unifyByLookup"]> = unify ?? {
      report: { rucColumn: "" },
      base: { rucColumn: "", canonicalNameColumn: "" },
    };
    const nextReport = { ...cur.report };
    const nextBase = { ...cur.base };
    if (side === "report" && field === "rucColumn") nextReport.rucColumn = value;
    if (side === "base" && field === "rucColumn") nextBase.rucColumn = value;
    if (side === "base" && field === "canonicalNameColumn")
      nextBase.canonicalNameColumn = value;

    const allEmpty =
      nextReport.rucColumn.trim() === "" &&
      nextBase.rucColumn.trim() === "" &&
      nextBase.canonicalNameColumn.trim() === "";

    setSplit({
      unifyByLookup: allEmpty
        ? undefined
        : { report: nextReport, base: nextBase },
    });
  }

  /* ---------- Validations ---------- */

  function ensureValidate(): ValidateStep {
    if (validate) return validate;
    const next: ValidateStep = { id: "valida", type: "validate", rules: [] };
    onValidateChange(next);
    return next;
  }

  function addRule() {
    const cur = ensureValidate();
    const next: ValidateRule = {
      name: `regla_${cur.rules.length + 1}`,
      left: { aggregate: "sum", column: "", from: "" },
      right: { aggregate: "count", column: "", from: "" },
      onMismatch: "warn",
    };
    onValidateChange({ ...cur, rules: [...cur.rules, next] });
  }

  function updateRule(idx: number, patch: Partial<ValidateRule>) {
    if (!validate) return;
    onValidateChange({
      ...validate,
      rules: validate.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    });
  }

  function removeRule(idx: number) {
    if (!validate) return;
    const next = validate.rules.filter((_, i) => i !== idx);
    onValidateChange({ ...validate, rules: next });
  }

  return (
    <div className="space-y-8">
      {/* Split */}
      <section className="space-y-4">
        <header>
          <h3 className="text-base font-semibold">Segmentación por agencia</h3>
          <p className="text-xs text-muted-foreground">
            Divide los datasets por una columna de agencia. Cada agencia será un
            archivo en el ZIP final.
          </p>
        </header>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">
              Datasets de reporte a segmentar
            </Label>
            <DatasetMultiSelect
              value={split?.reportSources ?? []}
              onChange={(srcs) => setSplit({ reportSources: srcs })}
              options={availableSources}
              emptyMessage="Aún no hay datasets disponibles. Agrega hojas o filtros antes."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dataset base (opcional)</Label>
              <DatasetSelect
                value={split?.baseSource ?? ""}
                onChange={(v) => setSplit({ baseSource: v || undefined })}
                options={availableSources}
                placeholder="Sin base"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Columna de agencia en los reportes
              </Label>
              <Input
                value={split?.agencyColumn.report ?? ""}
                onChange={(e) =>
                  setSplit({
                    agencyColumn: {
                      ...(split?.agencyColumn ?? { report: "" }),
                      report: e.target.value,
                    },
                  })
                }
                placeholder="AGENCIA"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Columna de agencia en la base (opcional)
              </Label>
              <Input
                value={split?.agencyColumn.base ?? ""}
                onChange={(e) =>
                  setSplit({
                    agencyColumn: {
                      ...(split?.agencyColumn ?? { report: "" }),
                      base: e.target.value || undefined,
                    },
                  })
                }
                placeholder="ASESOR"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Alias de agencias</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setAliases([...aliases, { canonical: "", variants: [] }])
                }
              >
                <Plus className="h-4 w-4" />
                Alias
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Si una agencia se escribe distinto entre el reporte y la base
              (ej: “EXPORTEL S.A.C.” y “EXPORTEL PROVINCIA”), agrúpalas aquí.
            </p>
            {aliases.map((a, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2"
              >
                <Input
                  value={a.canonical}
                  onChange={(e) =>
                    setAliases(
                      aliases.map((x, i) =>
                        i === idx ? { ...x, canonical: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Nombre canónico"
                />
                <CommaSeparatedInput
                  value={a.variants}
                  onChange={(vars) =>
                    setAliases(
                      aliases.map((x, i) =>
                        i === idx ? { ...x, variants: vars } : x
                      )
                    )
                  }
                  placeholder="Variante1, Variante2"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAliases(aliases.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>

          <details className="rounded-md border bg-background p-3 group">
            <summary className="cursor-pointer text-sm font-medium select-none">
              Unificar agencias por RUC (opcional)
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Si está configurado, los grupos del split que comparten el mismo
                RUC se fusionarán en un solo archivo usando el nombre canónico
                que viene en la base. Útil cuando la columna AGENCIA del
                reporte trae valores compuestos (ej: nombre + departamento) y
                quieres generar un único Excel por agencia real.
              </p>
              <p className="text-xs text-muted-foreground">
                La validación sigue operando sobre los grupos pre-fusión, así
                que verás el detalle por sub-agencia aunque el ZIP entregue un
                solo archivo por agencia canónica.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Columna RUC en reportes</Label>
                  <Input
                    value={unify?.report.rucColumn ?? ""}
                    onChange={(e) =>
                      setUnifyField("report", "rucColumn", e.target.value)
                    }
                    placeholder="RUC"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Columna RUC en base</Label>
                  <Input
                    value={unify?.base.rucColumn ?? ""}
                    onChange={(e) =>
                      setUnifyField("base", "rucColumn", e.target.value)
                    }
                    placeholder="DNI_ASESOR"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    Columna nombre unificado en base
                  </Label>
                  <Input
                    value={unify?.base.canonicalNameColumn ?? ""}
                    onChange={(e) =>
                      setUnifyField(
                        "base",
                        "canonicalNameColumn",
                        e.target.value
                      )
                    }
                    placeholder="ASESOR"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Para desactivar la unificación, deja los tres campos vacíos.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* Validate */}
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Validaciones</h3>
            <p className="text-xs text-muted-foreground">
              Reglas que comparan totales entre datasets para verificar que
              cuadran (ej: suma de ALTAS en el reporte = cantidad de
              COD_PEDIDO en la base).
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={addRule}>
            <Plus className="h-4 w-4" />
            Regla
          </Button>
        </header>

        {(validate?.rules ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Sin reglas de validación.
          </p>
        ) : (
          <div className="space-y-3">
            {validate!.rules.map((r, idx) => (
              <div
                key={idx}
                className="rounded-lg border bg-muted/30 p-4 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Nombre de la regla</Label>
                    <Input
                      value={r.name}
                      onChange={(e) =>
                        updateRule(idx, { name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Si los totales no cuadran</Label>
                    <select
                      value={r.onMismatch ?? "warn"}
                      onChange={(e) =>
                        updateRule(idx, {
                          onMismatch: e.target.value as "warn" | "error",
                        })
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {entries(ON_MISMATCH_LABELS).map(([val]) => (
                        <option key={val} value={val}>
                          {onMismatchLabel(val)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <SideEditor
                  label="Hoja Reporte"
                  spec={r.left}
                  availableSources={availableSources}
                  onChange={(left) => updateRule(idx, { left })}
                />
                <SideEditor
                  label="Hoja Base"
                  spec={r.right}
                  availableSources={availableSources}
                  onChange={(right) => updateRule(idx, { right })}
                />

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeRule(idx)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                    Eliminar regla
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SideEditor({
  label,
  spec,
  availableSources,
  onChange,
}: {
  label: string;
  spec: AggregateSpec;
  availableSources: DatasetOption[];
  onChange: (spec: AggregateSpec) => void;
}) {
  const fromArr = Array.isArray(spec.from)
    ? spec.from
    : spec.from
      ? [spec.from]
      : [];
  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <p className="text-xs font-medium">{label}</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Cómo agregar</Label>
          <select
            value={spec.aggregate}
            onChange={(e) =>
              onChange({ ...spec, aggregate: e.target.value as Aggregate })
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            title={AGGREGATE_LABELS[spec.aggregate]?.hint}
          >
            {entries(AGGREGATE_LABELS).map(([val]) => (
              <option key={val} value={val}>
                {aggregateLabel(val)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Columna</Label>
          <Input
            value={spec.column}
            onChange={(e) => onChange({ ...spec, column: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Datasets a usar</Label>
          <DatasetMultiSelect
            value={fromArr}
            onChange={(arr) =>
              onChange({ ...spec, from: arr.length === 1 ? arr[0] : arr })
            }
            options={availableSources}
            emptyMessage="No hay datasets disponibles."
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Alcance</Label>
          <select
            value={spec.scope ?? "global"}
            onChange={(e) =>
              onChange({
                ...spec,
                scope: e.target.value as "global" | "per_agency",
              })
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            title={SCOPE_LABELS[spec.scope ?? "global"]?.hint}
          >
            {entries(SCOPE_LABELS).map(([val]) => (
              <option key={val} value={val}>
                {scopeLabel(val)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">
            {SCOPE_LABELS[spec.scope ?? "global"]?.hint}
          </p>
        </div>
      </div>
    </div>
  );
}
