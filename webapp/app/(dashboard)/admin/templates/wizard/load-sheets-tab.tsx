"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CommaSeparatedInput } from "./comma-input";
import {
  HEADER_STRATEGY_LABELS,
  entries,
  headerStrategyLabel,
} from "@/lib/wizard/labels";
import type {
  HeaderDetection,
  HeaderStrategy,
  LoadSheetStep,
} from "@/lib/pipeline/types";

/**
 * Slugifica el nombre de una hoja para usarlo como ID interno.
 * Ejemplo: "Reporte CORTE 1 Horizontal" → "reporte_corte_1_horizontal".
 */
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_");
}

export function LoadSheetsTab({
  steps,
  onChange,
}: {
  steps: LoadSheetStep[];
  onChange: (steps: LoadSheetStep[]) => void;
}) {
  function add() {
    const idx = steps.length + 1;
    onChange([
      ...steps,
      {
        id: `hoja_${idx}`,
        type: "load_sheet",
        sheet: "",
        headerDetection: { strategy: "auto", expectedColumns: [] },
      },
    ]);
  }

  function update(idx: number, patch: Partial<LoadSheetStep>) {
    onChange(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function updateHeader(idx: number, hd: HeaderDetection) {
    update(idx, { headerDetection: hd });
  }

  function remove(idx: number) {
    onChange(steps.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Define cada hoja del Excel que deseas cargar. Cada hoja se convierte
          en un &quot;dataset&quot; que se podrá usar en pasos posteriores.
        </p>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
          Añadir hoja
        </Button>
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Aún no hay hojas configuradas.
        </p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <SheetCard
              key={idx}
              step={step}
              onUpdate={(patch) => update(idx, patch)}
              onUpdateHeader={(hd) => updateHeader(idx, hd)}
              onRemove={() => remove(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SheetCard({
  step,
  onUpdate,
  onUpdateHeader,
  onRemove,
}: {
  step: LoadSheetStep;
  onUpdate: (patch: Partial<LoadSheetStep>) => void;
  onUpdateHeader: (hd: HeaderDetection) => void;
  onRemove: () => void;
}) {
  // Decisión inicial: ¿el step viene "como creado por nosotros" (auto) o trae
  // un ID custom que debemos respetar? Solo evaluamos esto en el montaje,
  // para no sobreescribir IDs de plantillas existentes en DB.
  const initialModeRef = useRef<"auto" | "custom" | null>(null);
  if (initialModeRef.current === null) {
    const slug = slugify(step.sheet);
    const looksGenerated = /^hoja_\d+$/.test(step.id);
    if (!step.id || step.id === slug || (looksGenerated && !step.sheet)) {
      initialModeRef.current = "auto";
    } else {
      initialModeRef.current = "custom";
    }
  }
  const [showIdEditor, setShowIdEditor] = useState(
    initialModeRef.current === "custom"
  );

  // Sincroniza el ID con el slug del nombre de hoja únicamente cuando el
  // usuario está cambiando el nombre de hoja y sigue en modo automático. No
  // dispara en el primer render ni cuando se personaliza el ID.
  const prevSheetRef = useRef(step.sheet);
  useEffect(() => {
    if (showIdEditor) {
      prevSheetRef.current = step.sheet;
      return;
    }
    if (step.sheet === prevSheetRef.current) return;
    const next = slugify(step.sheet);
    if (next && next !== step.id) {
      onUpdate({ id: next });
    }
    prevSheetRef.current = step.sheet;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.sheet, showIdEditor]);

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Nombre exacto de la hoja en el Excel</Label>
          <Input
            value={step.sheet}
            onChange={(e) => onUpdate({ sheet: e.target.value })}
            placeholder="Reporte CORTE 1 Horizontal"
          />
        </div>
        <div className="space-y-1">
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
              onChange={(e) => onUpdate({ id: e.target.value })}
              placeholder="reporte_corte_1"
              className="font-mono text-xs"
            />
          ) : (
            <div className="h-10 px-3 flex items-center rounded-md border border-dashed border-input bg-background text-xs font-mono text-muted-foreground">
              {step.id || "(se generará al escribir el nombre)"}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            {showIdEditor
              ? "Se generará automáticamente desde el nombre de la hoja si está vacío."
              : "Se genera automáticamente. Click en \"Personalizar\" para cambiarlo."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cómo detectar la fila de cabecera</Label>
          <select
            value={step.headerDetection.strategy}
            onChange={(e) => {
              const strategy = e.target.value as HeaderStrategy;
              const prev = step.headerDetection;
              const prevCols =
                prev.strategy === "auto" ? prev.expectedColumns : [];
              const prevRow = prev.strategy === "fixed_row" ? prev.row : 1;
              const prevRows =
                prev.strategy === "multi_level" ? prev.rows : [1, 2];

              let next: HeaderDetection;
              if (strategy === "auto") {
                next = { strategy: "auto", expectedColumns: prevCols };
              } else if (strategy === "fixed_row") {
                next = { strategy: "fixed_row", row: prevRow };
              } else {
                next = { strategy: "multi_level", rows: prevRows };
              }
              onUpdateHeader(next);
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            title={HEADER_STRATEGY_LABELS[step.headerDetection.strategy]?.hint}
          >
            {entries(HEADER_STRATEGY_LABELS).map(([val]) => (
              <option key={val} value={val}>
                {headerStrategyLabel(val)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">
            {HEADER_STRATEGY_LABELS[step.headerDetection.strategy]?.hint}
          </p>
        </div>

        {step.headerDetection.strategy === "auto" && (
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">
              Columnas esperadas (separadas por coma)
            </Label>
            <CommaSeparatedInput
              value={step.headerDetection.expectedColumns}
              onChange={(cols) =>
                onUpdateHeader({
                  strategy: "auto",
                  expectedColumns: cols,
                })
              }
              placeholder="AGENCIA, ALTAS"
              className={
                step.headerDetection.expectedColumns.length === 0
                  ? "border-amber-400 focus-visible:ring-amber-400"
                  : ""
              }
            />
            {step.headerDetection.expectedColumns.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                Obligatorio. La detección automática necesita al menos una
                columna conocida para localizar la fila de cabecera.
              </p>
            )}
          </div>
        )}

        {step.headerDetection.strategy === "fixed_row" && (
          <div className="space-y-1">
            <Label className="text-xs">Fila de cabecera (1 = primera fila)</Label>
            <Input
              type="number"
              min={1}
              value={step.headerDetection.row}
              onChange={(e) =>
                onUpdateHeader({
                  strategy: "fixed_row",
                  row: parseInt(e.target.value) || 1,
                })
              }
            />
          </div>
        )}

        {step.headerDetection.strategy === "multi_level" && (
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">
              Filas que componen la cabecera (separadas por coma)
            </Label>
            <MultiLevelRowsInput
              value={step.headerDetection.rows}
              onChange={(rows) =>
                onUpdateHeader({
                  strategy: "multi_level",
                  rows,
                })
              }
            />
            <p className="text-[10px] text-muted-foreground">
              Ej: <code>1, 2</code> si la cabecera ocupa las filas 1 y 2.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-red-600" />
          Eliminar hoja
        </Button>
      </div>
    </div>
  );
}

/**
 * Input para multi_level que actualiza el valor en `onChange` (no en `onBlur`)
 * para que el usuario no tenga la sensación de que "no guardó". Mantiene el
 * texto crudo localmente mientras tiene foco para no romper el cursor cuando
 * tipea espacios o comas.
 */
function MultiLevelRowsInput({
  value,
  onChange,
}: {
  value: number[];
  onChange: (rows: number[]) => void;
}) {
  const [raw, setRaw] = useState(() => value.join(", "));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setRaw(value.join(", "));
    }
  }, [value]);

  function parse(text: string): number[] {
    return text
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !Number.isNaN(n) && n >= 1);
  }

  return (
    <Input
      value={raw}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        const parsed = parse(raw);
        setRaw(parsed.join(", "));
        onChange(parsed);
      }}
      onChange={(e) => {
        const text = e.target.value;
        setRaw(text);
        onChange(parse(text));
      }}
      placeholder="1, 2"
    />
  );
}
