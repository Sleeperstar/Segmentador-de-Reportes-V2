"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, AlertCircle, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import type {
  DeriveColumnStep,
  FilterRowsStep,
  LoadSheetStep,
  Pipeline,
  PipelineStep,
  SplitByColumnStep,
  ValidateStep,
  WriteOutputStep,
} from "@/lib/pipeline/types";
import { BasicsTab } from "./wizard/basics-tab";
import { InputsTab } from "./wizard/inputs-tab";
import { LoadSheetsTab } from "./wizard/load-sheets-tab";
import { TransformsTab } from "./wizard/transforms-tab";
import { SplitValidateTab } from "./wizard/split-validate-tab";
import { WriteOutputTab } from "./wizard/write-output-tab";
import { JsonTab } from "./wizard/json-tab";

type Initial = {
  name: string;
  description: string;
  is_active: boolean;
  pipeline: Pipeline;
};

export function TemplateEditor({
  mode,
  templateId,
  initial,
}: {
  mode: "create" | "edit";
  templateId?: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [isActive, setIsActive] = useState(initial.is_active);
  const [pipeline, setPipeline] = useState<Pipeline>(() => ({
    inputs: initial.pipeline.inputs ?? {},
    steps: initial.pipeline.steps ?? [],
  }));
  const [activeTab, setActiveTab] = useState("basics");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [success, setSuccess] = useState(false);

  /* ---------- Derived slices of pipeline ---------- */

  const loadSheets = useMemo(
    () => pipeline.steps.filter((s): s is LoadSheetStep => s.type === "load_sheet"),
    [pipeline.steps]
  );

  const transforms = useMemo(
    () =>
      pipeline.steps.filter(
        (s): s is FilterRowsStep | DeriveColumnStep =>
          s.type === "filter_rows" || s.type === "derive_column"
      ),
    [pipeline.steps]
  );

  const split = useMemo(
    () =>
      (pipeline.steps.find((s) => s.type === "split_by_column") as
        | SplitByColumnStep
        | undefined) ?? null,
    [pipeline.steps]
  );

  const validate = useMemo(
    () =>
      (pipeline.steps.find((s) => s.type === "validate") as
        | ValidateStep
        | undefined) ?? null,
    [pipeline.steps]
  );

  const writeOutput = useMemo(
    () =>
      (pipeline.steps.find((s) => s.type === "write_output") as
        | WriteOutputStep
        | undefined) ?? null,
    [pipeline.steps]
  );

  const availableSources = useMemo(() => {
    const ids = new Set<string>();
    for (const s of pipeline.steps) {
      if (s.type !== "validate" && s.type !== "write_output") {
        ids.add(s.id);
      }
    }
    return Array.from(ids);
  }, [pipeline.steps]);

  /* ---------- Mutators que reescriben pipeline.steps ---------- */

  function setSteps(next: PipelineStep[]) {
    setPipeline({ ...pipeline, steps: next });
  }

  function replaceLoadSheets(next: LoadSheetStep[]) {
    const others = pipeline.steps.filter((s) => s.type !== "load_sheet");
    setSteps([...next, ...others]);
  }

  function replaceTransforms(next: (FilterRowsStep | DeriveColumnStep)[]) {
    const before = pipeline.steps.filter((s) => s.type === "load_sheet");
    const after = pipeline.steps.filter(
      (s) =>
        s.type !== "load_sheet" &&
        s.type !== "filter_rows" &&
        s.type !== "derive_column"
    );
    setSteps([...before, ...next, ...after]);
  }

  function replaceStepByType<T extends PipelineStep>(
    type: T["type"],
    next: T | null
  ) {
    const filtered = pipeline.steps.filter((s) => s.type !== type);
    if (next) {
      // write_output siempre va al final, validate antes de write_output, split antes de validate
      const order: Record<PipelineStep["type"], number> = {
        load_sheet: 0,
        filter_rows: 1,
        derive_column: 1,
        split_by_column: 2,
        join: 1,
        validate: 3,
        write_output: 4,
      };
      const insertOrder = order[next.type];
      let idx = filtered.length;
      for (let i = 0; i < filtered.length; i++) {
        if (order[filtered[i].type] > insertOrder) {
          idx = i;
          break;
        }
      }
      const arr = [...filtered];
      arr.splice(idx, 0, next);
      setSteps(arr);
    } else {
      setSteps(filtered);
    }
  }

  /* ---------- Save ---------- */

  async function save() {
    setError(null);
    setIssues([]);
    setSuccess(false);
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      setActiveTab("basics");
      return;
    }
    startTransition(async () => {
      const url = mode === "create" ? "/api/templates" : `/api/templates/${templateId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
          pipeline,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          issues?: { path: string; message: string }[];
        };
        setError(j.error ?? "Error al guardar");
        if (j.issues) setIssues(j.issues);
        return;
      }
      setSuccess(true);
      if (mode === "create") {
        const { id } = (await res.json()) as { id: string };
        router.push(`/admin/templates/${id}/edit`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="basics">1. Datos</TabsTrigger>
            <TabsTrigger value="inputs">2. Inputs</TabsTrigger>
            <TabsTrigger value="sheets">3. Hojas</TabsTrigger>
            <TabsTrigger value="transforms">4. Transformaciones</TabsTrigger>
            <TabsTrigger value="split">5. Segmentar + validar</TabsTrigger>
            <TabsTrigger value="output">6. Salida</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="basics">
            <BasicsTab
              name={name}
              description={description}
              isActive={isActive}
              onChange={(p) => {
                if (p.name !== undefined) setName(p.name);
                if (p.description !== undefined) setDescription(p.description);
                if (p.isActive !== undefined) setIsActive(p.isActive);
              }}
            />
          </TabsContent>

          <TabsContent value="inputs">
            <InputsTab
              inputs={pipeline.inputs ?? {}}
              onChange={(inputs) => setPipeline({ ...pipeline, inputs })}
            />
          </TabsContent>

          <TabsContent value="sheets">
            <LoadSheetsTab steps={loadSheets} onChange={replaceLoadSheets} />
          </TabsContent>

          <TabsContent value="transforms">
            <TransformsTab
              steps={transforms}
              onChange={replaceTransforms}
              availableSources={availableSources}
            />
          </TabsContent>

          <TabsContent value="split">
            <SplitValidateTab
              split={split}
              validate={validate}
              availableSources={availableSources}
              onSplitChange={(s) => replaceStepByType("split_by_column", s)}
              onValidateChange={(s) => replaceStepByType("validate", s)}
            />
          </TabsContent>

          <TabsContent value="output">
            <WriteOutputTab
              step={writeOutput}
              availableSources={availableSources}
              onChange={(s) => replaceStepByType("write_output", s)}
            />
          </TabsContent>

          <TabsContent value="json">
            <JsonTab pipeline={pipeline} onChange={setPipeline} />
          </TabsContent>
        </Tabs>

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
            Plantilla guardada correctamente.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => router.push("/admin/templates")}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {mode === "create" ? "Crear plantilla" : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
