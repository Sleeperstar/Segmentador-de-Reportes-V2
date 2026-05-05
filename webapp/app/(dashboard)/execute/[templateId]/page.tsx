import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { ExecuteClient } from "./execute-client";
import type { Pipeline } from "@/lib/pipeline/types";

type RouteProps = {
  params: Promise<{ templateId: string }>;
};

export default async function ExecutePage({ params }: RouteProps) {
  const { templateId } = await params;
  const supabase = await createClient();
  const { data: tpl, error } = await supabase
    .from("report_templates")
    .select("id, name, description, version, pipeline, is_active")
    .eq("id", templateId)
    .maybeSingle();

  if (error || !tpl || !tpl.is_active) {
    notFound();
  }

  const pipeline = tpl.pipeline as Pipeline;
  const sheets = pipeline.steps
    .filter((s) => s.type === "load_sheet")
    .map((s) => (s.type === "load_sheet" ? s.sheet : ""))
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-3">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Volver a plantillas
          </Link>
        </Button>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="rounded-lg bg-brand-primary-50 p-2.5 text-brand-primary-600">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{tpl.name}</h1>
              <Badge variant="outline">v{tpl.version}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {tpl.description ?? "Sin descripción"}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hojas esperadas en el archivo</CardTitle>
          <CardDescription>
            El archivo Excel que subas debe contener las siguientes hojas (el
            nombre puede variar ligeramente en mayúsculas/tildes).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sheets.length > 0 ? (
              sheets.map((s) => (
                <Badge key={s} variant="brand">
                  {s}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Esta plantilla no carga hojas del archivo.
              </p>
            )}
          </div>
          {pipeline.inputs?.fileNamePattern ? (
            <div className="mt-4 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground mb-1">
                Formato esperado del nombre del archivo
              </div>
              <code className="break-all">{pipeline.inputs.fileNamePattern}</code>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ExecuteClient templateId={tpl.id} templateName={tpl.name} />
    </div>
  );
}
