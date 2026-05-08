"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, Check } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Pipeline } from "@/lib/pipeline/types";
import { validatePipeline } from "@/lib/pipeline/validator";
import { humanizePath } from "@/lib/wizard/path-translator";

export function JsonTab({
  pipeline,
  onChange,
}: {
  pipeline: Pipeline;
  onChange: (p: Pipeline) => void;
}) {
  const [draft, setDraft] = useState(() => JSON.stringify(pipeline, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [success, setSuccess] = useState(false);

  function apply() {
    setError(null);
    setIssues([]);
    setSuccess(false);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      setError(`JSON inválido: ${(e as Error).message}`);
      return;
    }
    const result = validatePipeline(parsed);
    if (!result.valid) {
      setIssues(result.issues);
      setError(`Pipeline inválido (${result.issues.length} problemas).`);
      return;
    }
    onChange(result.pipeline!);
    setSuccess(true);
  }

  function reset() {
    setDraft(JSON.stringify(pipeline, null, 2));
    setError(null);
    setIssues([]);
    setSuccess(false);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium">Edición técnica.</p>
          <p>
            Cambios incorrectos pueden romper la plantilla. Usa esta pestaña
            solo si conoces el formato del pipeline. Para edición normal usa
            las pestañas anteriores.
          </p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Edita el pipeline directamente como JSON. Útil para ajustes finos o
          casos no cubiertos por el wizard. Los cambios se aplican al estado
          del editor cuando presionas “Aplicar”.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={reset}>
            Restaurar
          </Button>
          <Button size="sm" onClick={apply}>
            Aplicar
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
          {issues.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs text-red-700 space-y-1">
              {issues.map((i, idx) => (
                <li key={idx}>
                  {humanizePath(i.path, pipeline)} — {i.message}
                  <details className="ml-4 mt-0.5">
                    <summary className="cursor-pointer text-[10px] text-red-600 hover:underline">
                      Ver path técnico
                    </summary>
                    <code className="text-[10px]">{i.path}</code>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm flex items-center gap-2 text-emerald-700">
          <Check className="h-4 w-4" />
          Pipeline aplicado correctamente.
        </div>
      )}

      <Textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setSuccess(false);
        }}
        rows={28}
        spellCheck={false}
        className="text-xs leading-relaxed"
      />
    </div>
  );
}
