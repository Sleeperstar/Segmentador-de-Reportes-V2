import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";

import { requireAdmin } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TemplateRowActions } from "./template-row-actions";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: templates, error } = await supabase
    .from("report_templates")
    .select("id, name, description, version, is_active, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-primary-50 p-2 text-brand-primary-600">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
              Administrar plantillas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crea, edita, duplica o activa/desactiva las plantillas de reporte.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/templates/new">
            <Plus className="h-4 w-4" />
            Nueva plantilla
          </Link>
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : templates && templates.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Nombre</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                    Descripción
                  </th>
                  <th className="text-left font-medium px-4 py-3">Versión</th>
                  <th className="text-left font-medium px-4 py-3">Estado</th>
                  <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
                    Actualizada
                  </th>
                  <th className="text-right font-medium px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-md truncate">
                      {t.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">v{t.version}</td>
                    <td className="px-4 py-3">
                      {t.is_active ? (
                        <Badge variant="success">Activa</Badge>
                      ) : (
                        <Badge variant="muted">Inactiva</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {new Date(t.updated_at).toLocaleString("es-PE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TemplateRowActions
                        id={t.id}
                        name={t.name}
                        isActive={t.is_active}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no hay plantillas. Crea la primera con el botón “Nueva plantilla”.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
