"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type {
  DeriveColumnStep,
  DeriveOp,
  Filter,
  FilterOp,
  FilterRowsStep,
  PipelineStep,
} from "@/lib/pipeline/types";

type TransformStep = FilterRowsStep | DeriveColumnStep;

const FILTER_OPS: FilterOp[] = [
  "equals",
  "not_equals",
  "in",
  "not_in",
  "contains",
  "not_null",
  "is_null",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
];

const DERIVE_OPS: DeriveOp[] = [
  "strip_suffix",
  "lookup",
  "normalize_name",
  "concat",
  "regex_replace",
  "constant",
];

export function TransformsTab({
  steps,
  onChange,
  availableSources,
}: {
  steps: TransformStep[];
  onChange: (steps: TransformStep[]) => void;
  availableSources: string[];
}) {
  function update(idx: number, patch: Partial<TransformStep>) {
    onChange(
      steps.map((s, i) => (i === idx ? ({ ...s, ...patch } as TransformStep) : s))
    );
  }

  function addFilter() {
    onChange([
      ...steps,
      {
        id: `filtro_${steps.length + 1}`,
        type: "filter_rows",
        source: availableSources[0] ?? "",
        filters: [{ column: "", op: "equals", value: "" }],
      } as FilterRowsStep,
    ]);
  }

  function addDerive() {
    onChange([
      ...steps,
      {
        id: `derive_${steps.length + 1}`,
        type: "derive_column",
        source: availableSources[0] ?? "",
        newColumn: "",
        op: "strip_suffix",
        sourceColumns: [],
        suffixes: [],
      } as DeriveColumnStep,
    ]);
  }

  function remove(idx: number) {
    onChange(steps.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    const next = [...steps];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Pasos de transformación que se aplican secuencialmente sobre los
          datasets cargados (filtros y columnas derivadas).
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addFilter}>
            <Plus className="h-4 w-4" />
            Filtro
          </Button>
          <Button size="sm" variant="outline" onClick={addDerive}>
            <Plus className="h-4 w-4" />
            Derivar columna
          </Button>
        </div>
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Sin transformaciones. Esto es opcional.
        </p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, idx) =>
            step.type === "filter_rows" ? (
              <FilterRowsCard
                key={idx}
                step={step}
                idx={idx}
                last={idx === steps.length - 1}
                availableSources={availableSources}
                onUpdate={(p) => update(idx, p)}
                onRemove={() => remove(idx)}
                onMove={(d) => move(idx, d)}
              />
            ) : (
              <DeriveColumnCard
                key={idx}
                step={step}
                idx={idx}
                last={idx === steps.length - 1}
                availableSources={availableSources}
                onUpdate={(p) => update(idx, p)}
                onRemove={() => remove(idx)}
                onMove={(d) => move(idx, d)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function StepHeader({
  badge,
  id,
  onIdChange,
  idx,
  last,
  onRemove,
  onMove,
}: {
  badge: string;
  id: string;
  onIdChange: (v: string) => void;
  idx: number;
  last: boolean;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <span className="rounded bg-brand-primary-100 text-brand-primary-700 text-xs font-medium px-2 py-1 mt-2">
        {badge}
      </span>
      <div className="space-y-1 flex-1">
        <Label className="text-xs">ID del paso</Label>
        <Input value={id} onChange={(e) => onIdChange(e.target.value)} />
      </div>
      <div className="flex items-center gap-1 mt-6">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onMove(-1)}
          disabled={idx === 0}
          title="Subir"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onMove(1)}
          disabled={last}
          title="Bajar"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} title="Eliminar">
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    </div>
  );
}

function FilterRowsCard({
  step,
  idx,
  last,
  availableSources,
  onUpdate,
  onRemove,
  onMove,
}: {
  step: FilterRowsStep;
  idx: number;
  last: boolean;
  availableSources: string[];
  onUpdate: (patch: Partial<FilterRowsStep>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  function setFilter(i: number, patch: Partial<Filter>) {
    onUpdate({
      filters: step.filters.map((f, j) => (j === i ? { ...f, ...patch } : f)),
    });
  }

  function addRow() {
    onUpdate({
      filters: [...step.filters, { column: "", op: "equals", value: "" }],
    });
  }

  function removeRow(i: number) {
    onUpdate({ filters: step.filters.filter((_, j) => j !== i) });
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <StepHeader
        badge="filter_rows"
        id={step.id}
        onIdChange={(v) => onUpdate({ id: v })}
        idx={idx}
        last={last}
        onRemove={onRemove}
        onMove={onMove}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="space-y-1">
          <Label className="text-xs">Dataset origen</Label>
          <select
            value={step.source}
            onChange={(e) => onUpdate({ source: e.target.value })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecciona...</option>
            {availableSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Combinar filtros con</Label>
          <select
            value={step.combine ?? "and"}
            onChange={(e) =>
              onUpdate({ combine: e.target.value as "and" | "or" })
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="and">AND (todos deben cumplirse)</option>
            <option value="or">OR (alguno debe cumplirse)</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Filtros</Label>
          <Button size="sm" variant="ghost" onClick={addRow}>
            <Plus className="h-4 w-4" />
            Filtro
          </Button>
        </div>
        {step.filters.map((f, i) => (
          <div
            key={i}
            className="grid grid-cols-1 md:grid-cols-[1fr_140px_1fr_auto] gap-2"
          >
            <Input
              value={f.column}
              onChange={(e) => setFilter(i, { column: e.target.value })}
              placeholder="Columna"
            />
            <select
              value={f.op}
              onChange={(e) => setFilter(i, { op: e.target.value as FilterOp })}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {FILTER_OPS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <Input
              value={
                Array.isArray(f.value)
                  ? f.value.join(", ")
                  : (f.value ?? "").toString()
              }
              onChange={(e) => {
                const raw = e.target.value;
                const useArr = f.op === "in" || f.op === "not_in";
                setFilter(i, {
                  value: useArr
                    ? raw.split(",").map((s) => s.trim())
                    : raw,
                });
              }}
              placeholder={
                f.op === "in" || f.op === "not_in"
                  ? "Valor1, Valor2"
                  : "Valor (usa $VAR para variables)"
              }
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeRow(i)}
              title="Eliminar"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeriveColumnCard({
  step,
  idx,
  last,
  availableSources,
  onUpdate,
  onRemove,
  onMove,
}: {
  step: DeriveColumnStep;
  idx: number;
  last: boolean;
  availableSources: string[];
  onUpdate: (patch: Partial<DeriveColumnStep>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <StepHeader
        badge="derive_column"
        id={step.id}
        onIdChange={(v) => onUpdate({ id: v })}
        idx={idx}
        last={last}
        onRemove={onRemove}
        onMove={onMove}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className="space-y-1">
          <Label className="text-xs">Dataset origen</Label>
          <select
            value={step.source}
            onChange={(e) => onUpdate({ source: e.target.value })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecciona...</option>
            {availableSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Operación</Label>
          <select
            value={step.op}
            onChange={(e) => onUpdate({ op: e.target.value as DeriveOp })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {DERIVE_OPS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nueva columna</Label>
          <Input
            value={step.newColumn}
            onChange={(e) => onUpdate({ newColumn: e.target.value })}
            placeholder="AGENCIA_NORMALIZADA"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Columnas fuente (separadas por coma)</Label>
        <Input
          value={(step.sourceColumns ?? []).join(", ")}
          onChange={(e) =>
            onUpdate({
              sourceColumns: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="AGENCIA"
        />

        {step.op === "strip_suffix" && (
          <div className="space-y-1">
            <Label className="text-xs">Sufijos a eliminar (separados por coma)</Label>
            <Input
              value={(step.suffixes ?? []).join(", ")}
              onChange={(e) =>
                onUpdate({
                  suffixes: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="PROVINCIA, NORTE, SUR"
            />
          </div>
        )}

        {step.op === "concat" && (
          <div className="space-y-1">
            <Label className="text-xs">Separador</Label>
            <Input
              value={step.separator ?? ""}
              onChange={(e) => onUpdate({ separator: e.target.value })}
              placeholder=" - "
            />
          </div>
        )}

        {step.op === "regex_replace" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Pattern</Label>
              <Input
                value={step.pattern ?? ""}
                onChange={(e) => onUpdate({ pattern: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Replacement</Label>
              <Input
                value={step.replacement ?? ""}
                onChange={(e) => onUpdate({ replacement: e.target.value })}
              />
            </div>
          </div>
        )}

        {step.op === "constant" && (
          <div className="space-y-1">
            <Label className="text-xs">Valor constante</Label>
            <Input
              value={step.constant ?? ""}
              onChange={(e) => onUpdate({ constant: e.target.value })}
            />
          </div>
        )}

        {step.op === "lookup" && (
          <div className="space-y-1">
            <Label className="text-xs">
              Tabla de lookup (JSON: {`{"valorOrig":"valorDest"}`})
            </Label>
            <Input
              value={JSON.stringify(step.lookupTable ?? {})}
              onChange={(e) => {
                try {
                  onUpdate({ lookupTable: JSON.parse(e.target.value) });
                } catch {
                  /* ignore */
                }
              }}
              className="font-mono text-xs"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export type { TransformStep, PipelineStep };
