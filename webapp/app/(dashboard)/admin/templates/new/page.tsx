import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdmin } from "@/lib/auth-helpers";
import { TemplateEditor } from "../template-editor";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const EMPTY_PIPELINE = {
  inputs: { fileNamePattern: "", derivedVariables: [] },
  steps: [],
};

export default async function NewTemplatePage() {
  await requireAdmin();
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
            Nueva plantilla
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura el pipeline siguiendo los pasos del wizard.
          </p>
        </div>
      </div>

      <TemplateEditor
        mode="create"
        initial={{
          name: "",
          description: "",
          is_active: true,
          pipeline: EMPTY_PIPELINE,
        }}
      />
    </div>
  );
}
