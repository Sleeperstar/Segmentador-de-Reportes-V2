"use client";

import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type {
  DerivedVariable,
  PipelineInputs,
  FileNameTransform,
} from "@/lib/pipeline/types";

const TRANSFORMS: FileNameTransform[] = ["monthYearToYYYYMM", "upper", "lower", "trim"];

export function InputsTab({
  inputs,
  onChange,
}: {
  inputs: PipelineInputs;
  onChange: (inputs: PipelineInputs) => void;
}) {
  const variables = inputs.derivedVariables ?? [];

  function setVariables(next: DerivedVariable[]) {
    onChange({ ...inputs, derivedVariables: next });
  }

  function addVariable() {
    setVariables([
      ...variables,
      { name: "", from: "fileName", transform: "monthYearToYYYYMM" },
    ]);
  }

  function updateVariable(idx: number, patch: Partial<DerivedVariable>) {
    setVariables(variables.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  function removeVariable(idx: number) {
    setVariables(variables.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-3xl">
        <Label htmlFor="filename-pattern">Expresión regular del nombre de archivo</Label>
        <Input
          id="filename-pattern"
          value={inputs.fileNamePattern ?? ""}
          onChange={(e) => onChange({ ...inputs, fileNamePattern: e.target.value })}
          placeholder="Reportes AGENCIA LIMA Corte (?<corte>\\d+) (?<mes>\\w+) (?<anio>\\d{4})"
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Usa grupos nombrados <code>(?&lt;nombre&gt;...)</code> para capturar
          partes del filename. Las capturas quedan disponibles como variables.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Variables derivadas</Label>
          <Button size="sm" variant="outline" onClick={addVariable}>
            <Plus className="h-4 w-4" />
            Añadir variable
          </Button>
        </div>

        {variables.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Sin variables. Útil cuando necesitas derivar otra variable a partir
            de un grupo de la regex (por ejemplo, transformar “MARZO 2026” en
            “202603”).
          </p>
        ) : (
          <div className="space-y-2">
            {variables.map((v, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 p-3 rounded-lg border bg-muted/30"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={v.name}
                    onChange={(e) => updateVariable(idx, { name: e.target.value })}
                    placeholder="PERIODO_COMI"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fuente</Label>
                  <select
                    value={v.from}
                    onChange={(e) =>
                      updateVariable(idx, {
                        from: e.target.value as DerivedVariable["from"],
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="fileName">fileName</option>
                    <option value="regexGroup">regexGroup</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {v.from === "regexGroup" ? "Grupo" : "Transformación"}
                  </Label>
                  {v.from === "regexGroup" ? (
                    <Input
                      value={v.source ?? ""}
                      onChange={(e) =>
                        updateVariable(idx, { source: e.target.value })
                      }
                      placeholder="corte"
                    />
                  ) : (
                    <select
                      value={v.transform ?? "monthYearToYYYYMM"}
                      onChange={(e) =>
                        updateVariable(idx, {
                          transform: e.target.value as FileNameTransform,
                        })
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {TRANSFORMS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeVariable(idx)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
