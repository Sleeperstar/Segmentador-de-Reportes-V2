"use client";

import { useState } from "react";
import { AlertCircle, Check } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Pipeline } from "@/lib/pipeline/types";
import { validatePipeline } from "@/lib/pipeline/validator";

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
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Edita el pipeline directamente como JSON. Útil para ajustes finos o
          casos no cubiertos por el wizard. Los cambios se aplican al estado del
          editor cuando presionas “Aplicar”.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={reset}>
            Reset
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
            <ul className="mt-2 list-disc list-inside text-xs text-red-700 space-y-0.5">
              {issues.map((i, idx) => (
                <li key={idx}>
                  <code>{i.path}</code> — {i.message}
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
