"use client";

import { Sparkles } from "lucide-react";

/**
 * Panel pequeño que lista las variables disponibles en el contexto y permite
 * insertarlas en un campo de texto haciendo click. Usado en la pestaña
 * "Salida" junto a los inputs de plantilla de nombre de archivo.
 */
export function VariablesPanel({
  variables,
  onInsert,
  title = "Variables disponibles",
}: {
  variables: string[];
  onInsert: (token: string) => void;
  title?: string;
}) {
  if (variables.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground italic">
        No hay variables definidas. Agrégalas en la pestaña &quot;Inputs&quot;.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        {title}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Click en una variable para agregarla al final del campo activo.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => {
          const token = `{${v}}`;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onInsert(token)}
              className="inline-flex items-center rounded-full bg-brand-primary-100 px-2.5 py-1 text-[11px] font-mono text-brand-primary-700 hover:bg-brand-primary-200 transition-colors"
              title={`Insertar ${token}`}
            >
              {token}
            </button>
          );
        })}
      </div>
    </div>
  );
}
