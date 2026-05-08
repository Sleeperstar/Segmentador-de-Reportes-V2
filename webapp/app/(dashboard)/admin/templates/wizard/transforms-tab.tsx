"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CommaSeparatedInput } from "./comma-input";
import { DatasetSelect } from "./components/dataset-select";
import { LookupTableEditor } from "./components/lookup-table-editor";
import {
  DERIVE_OP_LABELS,
  FILTER_OP_LABELS,
  deriveOpLabel,
  entries,
  filterOpLabel,
} from "@/lib/wizard/labels";
import type { DatasetOption } from "@/lib/wizard/describe-dataset";
import type {
  DeriveColumnStep,
  DeriveOp,
  Filter,
  FilterOp,
  FilterRowsStep,
  PipelineStep,
} from "@/lib/pipeline/types";

type TransformStep = FilterRowsStep | DeriveColumnStep;

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_");
}

export function TransformsTab({
  steps,
  onChange,
  availableSources,
}: {
  steps: TransformStep[];
  onChange: (steps: TransformStep[]) => void;
  availableSources: DatasetOption[];
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
        source: availableSources[0]?.id ?? "",
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
        source: availableSources[0]?.id ?? "",
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
          Pasos opcionales para limpiar o enriquecer los datasets antes de
          segmentar (filtrar filas y calcular columnas nuevas).
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addFilter}>
            <Plus className="h-4 w-4" />
            Filtrar filas
          </Button>
          <Button size="sm" variant="outline" onClick={addDerive}>
            <Plus className="h-4 w-4" />
            Calcular columna
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

/**
 * Cabecera común para los cards de transformación. Maneja auto-ID con botón
 * "Personalizar", botones de mover y eliminar.
 */
function StepHeader({
  badge,
  step,
  onUpdateId,
  derivedAutoId,
  idx,
  last,
  onRemove,
  onMove,
}: {
  badge: string;
  step: TransformStep;
  onUpdateId: (id: string) => void;
  derivedAutoId: string;
  idx: number;
  last: boolean;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const initialModeRef = useRef<"auto" | "custom" | null>(null);
  if (initialModeRef.current === null) {
    const looksGenerated =
      step.type === "filter_rows"
        ? /^filtro_\d+$/.test(step.id)
        : /^derive_\d+$/.test(step.id);
    if (
      !step.id ||
      step.id === derivedAutoId ||
      (looksGenerated && !derivedAutoId)
    ) {
      initialModeRef.current = "auto";
    } else {
      initialModeRef.current = "custom";
    }
  }
  const [showIdEditor, setShowIdEditor] = useState(
    initialModeRef.current === "custom"
  );

  const prevAutoRef = useRef(derivedAutoId);
  useEffect(() => {
    if (showIdEditor) {
      prevAutoRef.current = derivedAutoId;
      return;
    }
    if (derivedAutoId === prevAutoRef.current) return;
    if (derivedAutoId && derivedAutoId !== step.id) {
      onUpdateId(derivedAutoId);
    }
    prevAutoRef.current = derivedAutoId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedAutoId, showIdEditor]);

  return (
    <div className="flex items-start gap-3 mb-3">
      <span className="rounded bg-brand-primary-100 text-brand-primary-700 text-xs font-medium px-2 py-1 mt-2">
        {badge}
      </span>
      <div className="space-y-1 flex-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Identificador interno</Label>
          {!showIdEditor && (
            <button
              type="button"
              onClick={() => setShowIdEditor(true)}
              className="text-[11px] text-brand-primary-700 hover:underline inline-flex items-center gap-1"
            >
              <Pencil className="h-3 w-3" />
              Personalizar
            </button>
          )}
        </div>
        {showIdEditor ? (
          <Input
            value={step.id}
            onChange={(e) => onUpdateId(e.target.value)}
            className="font-mono text-xs"
          />
        ) : (
          <div className="h-10 px-3 flex items-center rounded-md border border-dashed border-input bg-background text-xs font-mono text-muted-foreground">
            {step.id || "(se generará automáticamente)"}
          </div>
        )}
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
  availableSources: DatasetOption[];
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

  // Sugerencia de auto-ID para filter_rows: "filtro_" + slug del primer filter
  const firstFilter = step.filters[0];
  const filterDesc = firstFilter?.column
    ? slugify(`${firstFilter.column}_${firstFilter.op}`)
    : "";
  const autoId = filterDesc ? `filtro_${filterDesc}` : "";

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <StepHeader
        badge="Filtrar filas"
        step={step}
        derivedAutoId={autoId}
        onUpdateId={(v) => onUpdate({ id: v })}
        idx={idx}
        last={last}
        onRemove={onRemove}
        onMove={onMove}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="space-y-1">
          <Label className="text-xs">Dataset de origen</Label>
          <DatasetSelect
            value={step.source}
            onChange={(v) => onUpdate({ source: v })}
            options={availableSources}
          />
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
            <option value="and">Y (todos deben cumplirse)</option>
            <option value="or">O (al menos uno debe cumplirse)</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Condiciones</Label>
          <Button size="sm" variant="ghost" onClick={addRow}>
            <Plus className="h-4 w-4" />
            Condición
          </Button>
        </div>
        {step.filters.map((f, i) => {
          const usesArrayValue = f.op === "in" || f.op === "not_in";
          const noValueOp = f.op === "is_null" || f.op === "not_null";
          return (
            <div
              key={i}
              className="grid grid-cols-1 md:grid-cols-[1fr_180px_1fr_auto] gap-2 items-start"
            >
              <Input
                value={f.column}
                onChange={(e) => setFilter(i, { column: e.target.value })}
                placeholder="Nombre de la columna"
              />
              <select
                value={f.op}
                onChange={(e) => setFilter(i, { op: e.target.value as FilterOp })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                title={FILTER_OP_LABELS[f.op]?.hint}
              >
                {entries(FILTER_OP_LABELS).map(([val]) => (
                  <option key={val} value={val}>
                    {filterOpLabel(val)}
                  </option>
                ))}
              </select>
              {noValueOp ? (
                <div className="h-10 px-3 flex items-center text-xs text-muted-foreground italic">
                  (sin valor)
                </div>
              ) : (
                <Input
                  value={
                    Array.isArray(f.value)
                      ? f.value.join(", ")
                      : (f.value ?? "").toString()
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    setFilter(i, {
                      value: usesArrayValue
                        ? raw.split(",").map((s) => s.trim())
                        : raw,
                    });
                  }}
                  placeholder={
                    usesArrayValue
                      ? "Valor1, Valor2"
                      : "Valor o $VAR para usar variable"
                  }
                />
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeRow(i)}
                title="Eliminar condición"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          );
        })}
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
  availableSources: DatasetOption[];
  onUpdate: (patch: Partial<DeriveColumnStep>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  // Auto-ID a partir de la columna nueva
  const autoId = step.newColumn ? `derive_${slugify(step.newColumn)}` : "";

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <StepHeader
        badge="Calcular columna"
        step={step}
        derivedAutoId={autoId}
        onUpdateId={(v) => onUpdate({ id: v })}
        idx={idx}
        last={last}
        onRemove={onRemove}
        onMove={onMove}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className="space-y-1">
          <Label className="text-xs">Dataset de origen</Label>
          <DatasetSelect
            value={step.source}
            onChange={(v) => onUpdate({ source: v })}
            options={availableSources}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Operación</Label>
          <select
            value={step.op}
            onChange={(e) => onUpdate({ op: e.target.value as DeriveOp })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            title={DERIVE_OP_LABELS[step.op]?.hint}
          >
            {entries(DERIVE_OP_LABELS).map(([val]) => (
              <option key={val} value={val}>
                {deriveOpLabel(val)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">
            {DERIVE_OP_LABELS[step.op]?.hint}
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nombre de la columna nueva</Label>
          <Input
            value={step.newColumn}
            onChange={(e) => onUpdate({ newColumn: e.target.value })}
            placeholder="AGENCIA_NORMALIZADA"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Columnas de origen (separadas por coma)</Label>
        <CommaSeparatedInput
          value={step.sourceColumns ?? []}
          onChange={(cols) => onUpdate({ sourceColumns: cols })}
          placeholder="AGENCIA"
        />

        {step.op === "strip_suffix" && (
          <div className="space-y-1">
            <Label className="text-xs">
              Sufijos a eliminar (separados por coma)
            </Label>
            <CommaSeparatedInput
              value={step.suffixes ?? []}
              onChange={(suffs) => onUpdate({ suffixes: suffs })}
              placeholder="PROVINCIA, NORTE, SUR"
            />
          </div>
        )}

        {step.op === "concat" && (
          <div className="space-y-1">
            <Label className="text-xs">Separador entre columnas</Label>
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
              <Label className="text-xs">Patrón (regex)</Label>
              <Input
                value={step.pattern ?? ""}
                onChange={(e) => onUpdate({ pattern: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Texto de reemplazo</Label>
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
          <LookupTableEditor
            value={step.lookupTable ?? {}}
            onChange={(next) => onUpdate({ lookupTable: next })}
          />
        )}
      </div>
    </div>
  );
}

export type { TransformStep, PipelineStep };
