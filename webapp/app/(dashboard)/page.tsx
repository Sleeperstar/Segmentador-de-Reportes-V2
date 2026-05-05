import Link from "next/link";
import { ArrowRight, FileSpreadsheet, Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function TemplatesListPage() {
  const supabase = await createClient();

  const { data: templates, error } = await supabase
    .from("report_templates")
    .select("id, name, description, version, updated_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error al cargar plantillas</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
            Plantillas de reporte
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecciona una plantilla y sube tu archivo Excel para segmentar el
            reporte por agencia.
          </p>
        </div>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card
              key={t.id}
              className="flex flex-col hover:border-brand-primary-300 hover:shadow-md transition-all"
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-brand-primary-50 p-2 text-brand-primary-600">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate">{t.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Versión {t.version}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {t.description ?? "Sin descripción"}
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/execute/${t.id}`}>
                    Ejecutar
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="rounded-full bg-brand-primary-50 p-3 text-brand-primary-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-medium">No hay plantillas disponibles</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Aún no se han configurado plantillas de reporte. Si eres
                administrador, crea la primera desde la sección{" "}
                <Link
                  href="/admin/templates/new"
                  className="font-medium text-primary hover:underline"
                >
                  Administrar plantillas
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
