"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Editor visual de tabla de equivalencias (lookup) para la operación
 * `derive_column` con `op = "lookup"`. Reemplaza al input JSON crudo.
 *
 * Internamente lee/escribe el mismo objeto `Record<string, string>` que
 * antes se persistía manualmente como JSON.
 */
export function LookupTableEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  // Convertimos el record a una lista ordenada para edición; preservamos las
  // claves vacías mientras el usuario está escribiendo.
  const entries = Object.entries(value);

  function setEntry(idx: number, key: string, val: string) {
    const next: Record<string, string> = {};
    entries.forEach(([k, v], i) => {
      if (i === idx) {
        if (key !== "") next[key] = val;
      } else {
        next[k] = v;
      }
    });
    onChange(next);
  }

  function addRow() {
    onChange({ ...value, "": "" });
  }

  function removeRow(idx: number) {
    const next: Record<string, string> = {};
    entries.forEach(([k, v], i) => {
      if (i !== idx) next[k] = v;
    });
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Tabla de equivalencias</Label>
        <Button size="sm" variant="ghost" onClick={addRow}>
          <Plus className="h-4 w-4" />
          Agregar fila
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Sin equivalencias. Agrega filas con &quot;valor original&quot; →
          &quot;valor destino&quot; (ej: PIURA → Piura Centro).
        </p>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground px-1">
            <span>Valor original</span>
            <span></span>
            <span>Valor destino</span>
            <span></span>
          </div>
          {entries.map(([k, v], idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center"
            >
              <Input
                value={k}
                onChange={(e) => setEntry(idx, e.target.value, v)}
                placeholder="PIURA"
                className="text-sm"
              />
              <span className="text-muted-foreground select-none">→</span>
              <Input
                value={v}
                onChange={(e) => setEntry(idx, k, e.target.value)}
                placeholder="Piura Centro"
                className="text-sm"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeRow(idx)}
                title="Eliminar fila"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
