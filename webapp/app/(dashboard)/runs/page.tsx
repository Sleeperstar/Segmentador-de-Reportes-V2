import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  History,
  Loader2,
  XCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ReDownloadButton } from "./re-download-button";

type RunRow = {
  id: string;
  status: "pending" | "running" | "success" | "partial" | "error";
  input_file_name: string;
  output_zip_path: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  summary: {
    totalGroups?: number;
    filesGenerated?: number;
    mismatches?: number;
  } | null;
  report_templates: { name: string; id: string } | null;
};

export default async function RunsPage() {
  const supabase = await createClient();
  const { data: runs, error } = await supabase
    .from("process_runs")
    .select(
      "id, status, input_file_name, output_zip_path, started_at, finished_at, duration_ms, summary, report_templates(id, name)"
    )
    .order("started_at", { ascending: false })
    .limit(30);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error al cargar historial</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  const rows = (runs ?? []) as unknown as RunRow[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          Últimos procesos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Se muestran los últimos 30 procesamientos. Los archivos ZIP se
          conservan 7 días en almacenamiento antes de expirar.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="rounded-full bg-brand-primary-50 p-3 text-brand-primary-600">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-medium">Todavía no has procesado reportes</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Cuando ejecutes una plantilla, aparecerá aquí.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <StatusIcon status={r.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base truncate">
                        {r.report_templates?.name ?? "Plantilla eliminada"}
                      </CardTitle>
                      <StatusBadge status={r.status} />
                    </div>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span className="truncate">{r.input_file_name}</span>
                    </CardDescription>
                  </div>
                  <div className="text-right text-xs text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                    <Clock className="h-3 w-3" />
                    {formatDate(r.started_at)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
                    {r.summary ? (
                      <>
                        <span>
                          <b className="text-foreground">
                            {r.summary.filesGenerated ?? 0}
                          </b>{" "}
                          archivos
                        </span>
                        <span>
                          <b className="text-foreground">
                            {r.summary.totalGroups ?? 0}
                          </b>{" "}
                          agencias
                        </span>
                        {r.summary.mismatches ? (
                          <span className="text-amber-700">
                            <b>{r.summary.mismatches}</b> descuadres
                          </span>
                        ) : null}
                      </>
                    ) : null}
                    {r.duration_ms ? (
                      <span>{(r.duration_ms / 1000).toFixed(1)}s</span>
                    ) : null}
                  </div>
                  {r.output_zip_path && r.status !== "error" ? (
                    <ReDownloadButton
                      runId={r.id}
                      outputPath={r.output_zip_path}
                    />
                  ) : r.report_templates ? (
                    <Link
                      href={`/execute/${r.report_templates.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reintentar →
                    </Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: RunRow["status"] }) {
  const cls = "h-5 w-5 mt-0.5";
  switch (status) {
    case "success":
      return <CheckCircle2 className={`${cls} text-emerald-600`} />;
    case "partial":
      return <AlertTriangle className={`${cls} text-amber-600`} />;
    case "error":
      return <XCircle className={`${cls} text-red-600`} />;
    case "running":
    case "pending":
      return <Loader2 className={`${cls} text-brand-primary-600 animate-spin`} />;
  }
}

function StatusBadge({ status }: { status: RunRow["status"] }) {
  switch (status) {
    case "success":
      return <Badge variant="success">Exitoso</Badge>;
    case "partial":
      return <Badge variant="warning">Con descuadres</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    case "running":
      return <Badge variant="brand">Procesando...</Badge>;
    case "pending":
      return <Badge variant="outline">Pendiente</Badge>;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
