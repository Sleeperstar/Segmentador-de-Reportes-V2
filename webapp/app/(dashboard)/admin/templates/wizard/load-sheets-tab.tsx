"use client";

import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CommaSeparatedInput } from "./comma-input";
import type {
  HeaderDetection,
  HeaderStrategy,
  LoadSheetStep,
} from "@/lib/pipeline/types";

const STRATEGIES: HeaderStrategy[] = ["auto", "fixed_row", "multi_level"];

export function LoadSheetsTab({
  steps,
  onChange,
}: {
  steps: LoadSheetStep[];
  onChange: (steps: LoadSheetStep[]) => void;
}) {
  function add() {
    onChange([
      ...steps,
      {
        id: `hoja_${steps.length + 1}`,
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
          Define cada hoja del Excel que deseas cargar como dataset. El{" "}
          <strong>id</strong> identifica el dataset para pasos posteriores.
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
            <div
              key={idx}
              className="rounded-lg border bg-muted/30 p-4 space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">ID del dataset</Label>
                  <Input
                    value={step.id}
                    onChange={(e) => update(idx, { id: e.target.value })}
                    placeholder="horizontal"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Nombre exacto de la hoja</Label>
                  <Input
                    value={step.sheet}
                    onChange={(e) => update(idx, { sheet: e.target.value })}
                    placeholder="Reporte CORTE 1 Horizontal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Detección de cabecera</Label>
                  <select
                    value={step.headerDetection.strategy}
                    onChange={(e) => {
                      const strategy = e.target.value as HeaderStrategy;
                      const prev = step.headerDetection;
                      // Preservar valores previos para no perder lo que el
                      // usuario ya tipeó si solo está explorando opciones.
                      const prevCols =
                        prev.strategy === "auto" ? prev.expectedColumns : [];
                      const prevRow =
                        prev.strategy === "fixed_row" ? prev.row : 1;
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
                      updateHeader(idx, next);
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {STRATEGIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {step.headerDetection.strategy === "auto" && (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">
                      Columnas esperadas (separadas por coma)
                    </Label>
                    <CommaSeparatedInput
                      value={step.headerDetection.expectedColumns}
                      onChange={(cols) =>
                        updateHeader(idx, {
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
                        Obligatorio. La estrategia &quot;auto&quot; necesita al
                        menos una columna para detectar la fila de cabecera.
                      </p>
                    )}
                  </div>
                )}

                {step.headerDetection.strategy === "fixed_row" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Fila de cabecera (1-based)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={step.headerDetection.row}
                      onChange={(e) =>
                        updateHeader(idx, {
                          strategy: "fixed_row",
                          row: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                )}

                {step.headerDetection.strategy === "multi_level" && (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Filas (separadas por coma)</Label>
                    <Input
                      defaultValue={step.headerDetection.rows.join(", ")}
                      key={step.headerDetection.rows.join(",")}
                      onBlur={(e) =>
                        updateHeader(idx, {
                          strategy: "multi_level",
                          rows: e.target.value
                            .split(",")
                            .map((s) => parseInt(s.trim()))
                            .filter((n) => !Number.isNaN(n)),
                        })
                      }
                      placeholder="1, 2"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(idx)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                  Eliminar hoja
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
