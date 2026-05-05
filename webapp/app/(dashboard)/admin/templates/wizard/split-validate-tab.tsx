"use client";

import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type {
  AggregateSpec,
  Alias,
  SplitByColumnStep,
  ValidateRule,
  ValidateStep,
} from "@/lib/pipeline/types";

type Aggregate = AggregateSpec["aggregate"];
const AGGREGATES: Aggregate[] = ["sum", "count", "count_distinct", "min", "max", "avg"];

export function SplitValidateTab({
  split,
  validate,
  availableSources,
  onSplitChange,
  onValidateChange,
}: {
  split: SplitByColumnStep | null;
  validate: ValidateStep | null;
  availableSources: string[];
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

        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">ID</Label>
              <Input
                value={split?.id ?? "segmenta"}
                onChange={(e) => setSplit({ id: e.target.value })}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">
                Datasets de reporte a segmentar (separados por coma)
              </Label>
              <Input
                value={(split?.reportSources ?? []).join(", ")}
                onChange={(e) =>
                  setSplit({
                    reportSources: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="horizontal, vertical, marcha_blanca"
              />
              <p className="text-xs text-muted-foreground">
                Disponibles: {availableSources.join(", ") || "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dataset base (opcional)</Label>
              <select
                value={split?.baseSource ?? ""}
                onChange={(e) =>
                  setSplit({ baseSource: e.target.value || undefined })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sin base</option>
                {availableSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Columna de agencia (en reportes)</Label>
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
              <Label className="text-xs">Columna de agencia (en base)</Label>
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
                placeholder="ASESOR (opcional)"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Alias</Label>
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
                <Input
                  value={a.variants.join(", ")}
                  onChange={(e) =>
                    setAliases(
                      aliases.map((x, i) =>
                        i === idx
                          ? {
                              ...x,
                              variants: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            }
                          : x
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
        </div>
      </section>

      {/* Validate */}
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Validaciones</h3>
            <p className="text-xs text-muted-foreground">
              Reglas que comparan agregados entre datasets. Útil para verificar
              que los totales cuadran (ej: sum ALTAS = count COD_PEDIDO).
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
                    <Label className="text-xs">Si no coincide</Label>
                    <select
                      value={r.onMismatch ?? "warn"}
                      onChange={(e) =>
                        updateRule(idx, {
                          onMismatch: e.target.value as "warn" | "error",
                        })
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="warn">warn (advertencia)</option>
                      <option value="error">error (detiene proceso)</option>
                    </select>
                  </div>
                </div>

                <SideEditor
                  label="Lado izquierdo"
                  spec={r.left}
                  availableSources={availableSources}
                  onChange={(left) => updateRule(idx, { left })}
                />
                <SideEditor
                  label="Lado derecho"
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
  availableSources: string[];
  onChange: (spec: AggregateSpec) => void;
}) {
  const fromArr = Array.isArray(spec.from) ? spec.from : [spec.from];
  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <p className="text-xs font-medium">{label}</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Agregado</Label>
          <select
            value={spec.aggregate}
            onChange={(e) =>
              onChange({ ...spec, aggregate: e.target.value as Aggregate })
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {AGGREGATES.map((a) => (
              <option key={a} value={a}>
                {a}
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
          <Label className="text-xs">Datasets (coma)</Label>
          <Input
            value={fromArr.join(", ")}
            onChange={(e) => {
              const arr = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              onChange({ ...spec, from: arr.length === 1 ? arr[0] : arr });
            }}
            placeholder={availableSources.join(", ")}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Alcance</Label>
          <select
            value={spec.scope ?? "global"}
            onChange={(e) =>
              onChange({ ...spec, scope: e.target.value as "global" | "per_agency" })
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="global">global</option>
            <option value="per_agency">per_agency</option>
          </select>
        </div>
      </div>
    </div>
  );
}
