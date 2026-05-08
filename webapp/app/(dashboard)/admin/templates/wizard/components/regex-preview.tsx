"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Editor de expresión regular con preview en vivo. El usuario tipea un
 * filename de ejemplo y ve qué grupos captura la regex (en pills verdes) o
 * un mensaje de error si la regex no compila o no matchea.
 *
 * No altera el valor que se guarda: el `value` se sigue persistiendo tal cual.
 * Solo es un ayudante visual.
 */
export function RegexPreview({
  value,
  onChange,
  id,
  placeholder,
  exampleFilenamePlaceholder = "Reportes AGENCIA LIMA Corte 1 MARZO 2026.xlsx",
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  exampleFilenamePlaceholder?: string;
}) {
  const [example, setExample] = useState("");

  const result = useMemo(() => {
    if (!value.trim()) {
      return { kind: "empty" as const };
    }
    let regex: RegExp;
    try {
      regex = new RegExp(value);
    } catch (e) {
      return { kind: "invalid" as const, error: (e as Error).message };
    }
    if (!example.trim()) {
      return { kind: "valid_no_test" as const, regex };
    }
    const match = example.match(regex);
    if (!match) {
      return { kind: "no_match" as const };
    }
    const groups = match.groups ?? {};
    const captures: Array<{ name: string; value: string }> = [];
    for (const name of Object.keys(groups)) {
      captures.push({ name, value: groups[name] ?? "" });
    }
    if (captures.length === 0) {
      // Sin grupos nombrados, mostrar el match completo
      captures.push({ name: "match", value: match[0] });
    }
    return { kind: "match" as const, captures };
  }, [value, example]);

  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-xs"
      />

      <div className="space-y-1">
        <Label className="text-xs">
          Probar con un nombre de archivo de ejemplo
        </Label>
        <Input
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder={exampleFilenamePlaceholder}
          className="text-xs"
        />
      </div>

      {result.kind === "invalid" && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">La expresión regular no es válida.</p>
            <p className="font-mono text-[10px] mt-0.5">{result.error}</p>
          </div>
        </div>
      )}

      {result.kind === "no_match" && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>El patrón no coincide con este nombre de archivo.</p>
        </div>
      )}

      {result.kind === "valid_no_test" && example.trim() === "" && (
        <p className="text-xs text-muted-foreground italic">
          Escribe un nombre de archivo de ejemplo para ver qué captura el
          patrón.
        </p>
      )}

      {result.kind === "match" && (
        <div className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Coincide. Capturas:</p>
            <div className="flex flex-wrap gap-1">
              {result.captures.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] font-medium text-emerald-900"
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="opacity-70">=</span>
                  <span className="font-mono">{c.value}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
