"use client";

import { useRef, useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CommaSeparatedInput } from "./comma-input";
import { DatasetSelect } from "./components/dataset-select";
import { VariablesPanel } from "./components/variables-panel";
import {
  OUTPUT_FORMAT_LABELS,
  entries,
  outputFormatLabel,
} from "@/lib/wizard/labels";
import type { DatasetOption } from "@/lib/wizard/describe-dataset";
import type {
  HeaderHighlight,
  OutputFormat,
  OutputSheet,
  WriteOutputStep,
} from "@/lib/pipeline/types";

export function WriteOutputTab({
  step,
  availableSources,
  availableVariables,
  onChange,
}: {
  step: WriteOutputStep | null;
  availableSources: DatasetOption[];
  availableVariables: string[];
  onChange: (step: WriteOutputStep | null) => void;
}) {
  function ensure(): WriteOutputStep {
    if (step) return step;
    const next: WriteOutputStep = {
      id: "salida",
      type: "write_output",
      perAgency: { sheets: [], fileNameTemplate: "" },
      zipFileNameTemplate: "",
    };
    onChange(next);
    return next;
  }

  function set(patch: Partial<WriteOutputStep>) {
    onChange({ ...ensure(), ...patch });
  }

  function setPerAgency(patch: Partial<WriteOutputStep["perAgency"]>) {
    const cur = ensure();
    onChange({ ...cur, perAgency: { ...cur.perAgency, ...patch } });
  }

  const sheets = step?.perAgency.sheets ?? [];
  const formats = step?.perAgency.formats ?? [];
  const highlights = step?.perAgency.headerHighlights ?? [];

  /* Refs para insertar variables en el último input enfocado */
  const zipRef = useRef<HTMLInputElement>(null);
  const perAgencyRef = useRef<HTMLInputElement>(null);
  const [lastFocused, setLastFocused] = useState<"zip" | "perAgency" | null>(
    null
  );

  function insertToken(token: string) {
    const target =
      lastFocused === "zip"
        ? zipRef.current
        : lastFocused === "perAgency"
          ? perAgencyRef.current
          : null;
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const before = target.value.slice(0, start);
    const after = target.value.slice(end);
    const next = before + token + after;
    if (lastFocused === "zip") {
      set({ zipFileNameTemplate: next });
    } else {
      setPerAgency({ fileNameTemplate: next });
    }
    requestAnimationFrame(() => {
      target.focus();
      const pos = start + token.length;
      target.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nombre del archivo ZIP</Label>
            <Input
              ref={zipRef}
              value={step?.zipFileNameTemplate ?? ""}
              onChange={(e) => set({ zipFileNameTemplate: e.target.value })}
              onFocus={() => setLastFocused("zip")}
              placeholder="Reportes AGENCIA LIMA Corte 1 {PERIODO_COMI}.zip"
            />
            <p className="text-[11px] text-muted-foreground">
              Usa <code>{`{NOMBRE_VARIABLE}`}</code> para insertar variables del
              contexto.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Nombre del archivo Excel por agencia
            </Label>
            <Input
              ref={perAgencyRef}
              value={step?.perAgency.fileNameTemplate ?? ""}
              onChange={(e) =>
                setPerAgency({ fileNameTemplate: e.target.value })
              }
              onFocus={() => setLastFocused("perAgency")}
              placeholder="Reporte {AGENCIA} Corte 1 {PERIODO_COMI}.xlsx"
            />
            <p className="text-[11px] text-muted-foreground">
              <code>{`{AGENCIA}`}</code> se reemplaza con el nombre de cada
              agencia segmentada.
            </p>
          </div>
        </div>

        <VariablesPanel
          variables={availableVariables}
          onInsert={insertToken}
          title="Variables disponibles"
        />
      </div>

      {/* Hojas del archivo */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Hojas del archivo Excel por agencia</Label>
            <p className="text-xs text-muted-foreground">
              Cada agencia recibe un Excel con estas hojas. Si una agencia no
              tiene filas en una hoja segmentada, esa hoja se omite
              automáticamente.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setPerAgency({
                sheets: [
                  ...sheets,
                  { name: "", from: availableSources[0]?.id ?? "" },
                ],
              })
            }
          >
            <Plus className="h-4 w-4" />
            Hoja
          </Button>
        </div>

        {sheets.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin hojas.</p>
        ) : (
          <div className="space-y-2">
            {sheets.map((s, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 p-3 rounded border bg-muted/30"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Nombre de la hoja</Label>
                  <Input
                    value={s.name}
                    onChange={(e) => updateSheet(idx, { name: e.target.value })}
                    placeholder="BASE"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dataset de origen</Label>
                  <DatasetSelect
                    value={s.from}
                    onChange={(v) => updateSheet(idx, { from: v })}
                    options={availableSources}
                  />
                </div>
                <label className="flex items-end gap-2 text-xs pb-2">
                  <input
                    type="checkbox"
                    checked={s.filterToAgency !== false}
                    onChange={(e) =>
                      updateSheet(idx, { filterToAgency: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  Filtrar a agencia
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setPerAgency({ sheets: sheets.filter((_, i) => i !== idx) })
                  }
                  className="self-end"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Formatos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Formato de columnas (opcional)</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setPerAgency({
                formats: [...formats, { columns: [], format: "integer" }],
              })
            }
          >
            <Plus className="h-4 w-4" />
            Formato
          </Button>
        </div>

        {formats.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Las celdas se escriben tal cual.
          </p>
        ) : (
          <div className="space-y-2">
            {formats.map((f, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2"
              >
                <div className="space-y-1">
                  <Label className="text-xs">
                    Columnas (separadas por coma)
                  </Label>
                  <CommaSeparatedInput
                    value={f.columns}
                    onChange={(cols) => updateFormat(idx, { columns: cols })}
                    placeholder="ALTAS, MONTO"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de formato</Label>
                  <select
                    value={f.format}
                    onChange={(e) =>
                      updateFormat(idx, {
                        format: e.target.value as OutputFormat["format"],
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {entries(OUTPUT_FORMAT_LABELS).map(([val]) => (
                      <option key={val} value={val}>
                        {outputFormatLabel(val)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setPerAgency({
                      formats: formats.filter((_, i) => i !== idx),
                    })
                  }
                  className="self-end"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resaltado de cabeceras */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Resaltado de cabeceras (opcional)</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setPerAgency({
                headerHighlights: [
                  ...highlights,
                  { terms: [], fillColor: "#0070C0", fontColor: "#FFFFFF" },
                ],
              })
            }
          >
            <Plus className="h-4 w-4" />
            Regla
          </Button>
        </div>

        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              Por defecto, las columnas cuyo nombre contenga{" "}
              <strong>&quot;Penalidad&quot;</strong> se pintan de azul claro
              (#0070C0) y las que contengan <strong>&quot;Clawback&quot;</strong>{" "}
              de azul oscuro (#002060), ambas con letra blanca.
            </p>
            <p>
              Aquí puedes agregar reglas adicionales o sobrescribir los
              defaults. Las reglas que agregues tienen prioridad. La búsqueda
              ignora mayúsculas y tildes y matchea por substring.
            </p>
          </div>
        </div>

        {highlights.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Sin reglas adicionales. Solo se aplican los defaults globales.
          </p>
        ) : (
          <div className="space-y-2">
            {highlights.map((h, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-2 p-3 rounded border bg-muted/30"
              >
                <div className="space-y-1">
                  <Label className="text-xs">
                    Términos (separados por coma)
                  </Label>
                  <CommaSeparatedInput
                    value={h.terms}
                    onChange={(terms) => updateHighlight(idx, { terms })}
                    placeholder="Penalidad, Multa"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color de relleno</Label>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      value={normalizeHexInput(h.fillColor)}
                      onChange={(e) =>
                        updateHighlight(idx, {
                          fillColor: e.target.value.toUpperCase(),
                        })
                      }
                      className="h-10 w-10 rounded border border-input cursor-pointer"
                    />
                    <Input
                      value={h.fillColor}
                      onChange={(e) =>
                        updateHighlight(idx, { fillColor: e.target.value })
                      }
                      placeholder="#0070C0"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color de fuente</Label>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      value={normalizeHexInput(h.fontColor)}
                      onChange={(e) =>
                        updateHighlight(idx, {
                          fontColor: e.target.value.toUpperCase(),
                        })
                      }
                      className="h-10 w-10 rounded border border-input cursor-pointer"
                    />
                    <Input
                      value={h.fontColor}
                      onChange={(e) =>
                        updateHighlight(idx, { fontColor: e.target.value })
                      }
                      placeholder="#FFFFFF"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setPerAgency({
                      headerHighlights: highlights.filter((_, i) => i !== idx),
                    })
                  }
                  className="self-end"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  function updateSheet(idx: number, patch: Partial<OutputSheet>) {
    setPerAgency({
      sheets: sheets.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });
  }

  function updateFormat(idx: number, patch: Partial<OutputFormat>) {
    setPerAgency({
      formats: formats.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    });
  }

  function updateHighlight(idx: number, patch: Partial<HeaderHighlight>) {
    setPerAgency({
      headerHighlights: highlights.map((h, i) =>
        i === idx ? { ...h, ...patch } : h
      ),
    });
  }
}

/**
 * El input nativo `<input type="color">` requiere un valor `#RRGGBB` válido.
 * Si el usuario está editando el campo de texto y aún no es válido, devolvemos
 * un fallback para no romper el color picker.
 */
function normalizeHexInput(hex: string): string {
  if (typeof hex !== "string") return "#000000";
  const trimmed = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const c = trimmed.slice(1);
    return "#" + c.split("").map((x) => x + x).join("");
  }
  return "#000000";
}
