"use client";

import { Info, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CommaSeparatedInput } from "./comma-input";
import type {
  HeaderHighlight,
  OutputFormat,
  OutputSheet,
  WriteOutputStep,
} from "@/lib/pipeline/types";

const FORMATS: OutputFormat["format"][] = ["percent", "number", "currency", "integer"];

export function WriteOutputTab({
  step,
  availableSources,
  onChange,
}: {
  step: WriteOutputStep | null;
  availableSources: string[];
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">ID del paso</Label>
          <Input
            value={step?.id ?? "salida"}
            onChange={(e) => set({ id: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Plantilla del nombre del ZIP</Label>
          <Input
            value={step?.zipFileNameTemplate ?? ""}
            onChange={(e) => set({ zipFileNameTemplate: e.target.value })}
            placeholder="Reportes AGENCIA LIMA Corte 1 {PERIODO_COMI}.zip"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Plantilla del nombre por agencia</Label>
        <Input
          value={step?.perAgency.fileNameTemplate ?? ""}
          onChange={(e) => setPerAgency({ fileNameTemplate: e.target.value })}
          placeholder="Reporte {AGENCIA} Corte 1 {PERIODO_COMI}.xlsx"
        />
        <p className="text-xs text-muted-foreground">
          Variables disponibles: <code>{`{AGENCIA}`}</code> y todas las variables
          derivadas (ej: <code>{`{PERIODO_COMI}`}</code>).
        </p>
      </div>

      {/* Hojas del archivo */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Hojas que se incluirán por agencia</Label>
            <p className="text-xs text-muted-foreground">
              Si una agencia no tiene filas en una hoja segmentada, esa hoja se
              omite automáticamente en su archivo.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setPerAgency({
                sheets: [
                  ...sheets,
                  { name: "", from: availableSources[0] ?? "" },
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
                  <Label className="text-xs">Dataset origen</Label>
                  <select
                    value={s.from}
                    onChange={(e) => updateSheet(idx, { from: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecciona...</option>
                    {availableSources.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
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
          <Label>Formatos de columnas (opcional)</Label>
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
                  <Label className="text-xs">Formato</Label>
                  <select
                    value={f.format}
                    onChange={(e) =>
                      updateFormat(idx, {
                        format: e.target.value as OutputFormat["format"],
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {FORMATS.map((fmt) => (
                      <option key={fmt} value={fmt}>
                        {fmt}
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
              (#0070C0) y las que contengan <strong>&quot;Clawback&quot;</strong>
              {" "}de azul oscuro (#002060), ambas con letra blanca.
            </p>
            <p>
              Aquí puedes agregar reglas adicionales o sobrescribir los defaults.
              Las reglas que agregues tienen prioridad sobre las globales. El
              match es <em>case-insensitive</em> y por substring.
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
                        updateHighlight(idx, { fillColor: e.target.value.toUpperCase() })
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
                        updateHighlight(idx, { fontColor: e.target.value.toUpperCase() })
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
