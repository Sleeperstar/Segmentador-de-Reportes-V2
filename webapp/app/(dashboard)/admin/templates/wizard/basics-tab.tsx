"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BasicsTab({
  name,
  description,
  isActive,
  onChange,
}: {
  name: string;
  description: string;
  isActive: boolean;
  onChange: (
    next: Partial<{ name: string; description: string; isActive: boolean }>
  ) => void;
}) {
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="tpl-name">Nombre de la plantilla *</Label>
        <Input
          id="tpl-name"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ej: Lima Corte 1 (multi-hoja)"
        />
        <p className="text-xs text-muted-foreground">
          Es el nombre que verán los usuarios al elegir esta plantilla en la
          pantalla de ejecución. Hazlo claro y descriptivo.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-desc">Descripción (opcional)</Label>
        <Textarea
          id="tpl-desc"
          rows={4}
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Procesa el reporte de Lima del Corte 1 segmentando por agencia..."
          className="font-sans"
        />
        <p className="text-xs text-muted-foreground">
          Aparece debajo del nombre como ayuda al usuario.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
            className="h-4 w-4 rounded border-input"
          />
          <span>Plantilla activa (visible para los usuarios)</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Si la desactivas, queda guardada pero no aparece en la pantalla de
          ejecución. Útil para iterar sin afectar a los usuarios.
        </p>
      </div>
    </div>
  );
}
