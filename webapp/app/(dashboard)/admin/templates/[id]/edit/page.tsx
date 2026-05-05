import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireAdmin } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "../../template-editor";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from("report_templates")
    .select("id, name, description, is_active, version, pipeline")
    .eq("id", id)
    .maybeSingle();

  if (error || !template) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/templates">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
            {template.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edita el pipeline. Cada guardado crea una nueva versión (actual: v
            {template.version}).
          </p>
        </div>
      </div>

      <TemplateEditor
        mode="edit"
        templateId={template.id}
        initial={{
          name: template.name,
          description: template.description ?? "",
          is_active: template.is_active,
          pipeline: template.pipeline,
        }}
      />
    </div>
  );
}
