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
        <Label htmlFor="tpl-name">Nombre *</Label>
        <Input
          id="tpl-name"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ej: Lima Corte 1 (multi-hoja)"
        />
        <p className="text-xs text-muted-foreground">
          Nombre que verán los usuarios al elegir la plantilla.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-desc">Descripción</Label>
        <Textarea
          id="tpl-desc"
          rows={4}
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Procesa el reporte de Lima del Corte 1 segmentando por agencia..."
          className="font-sans"
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
            className="h-4 w-4 rounded border-input"
          />
          <span>Plantilla activa</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Solo las plantillas activas aparecen en la vista de usuarios para ejecutar.
        </p>
      </div>
    </div>
  );
}
