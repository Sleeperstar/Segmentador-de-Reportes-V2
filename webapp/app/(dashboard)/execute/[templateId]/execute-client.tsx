"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

type LogItem = { level: string; message: string; timestamp: string | Date };
type Validation = {
  ruleName: string;
  groupKey?: string;
  left: number;
  right: number;
  matched: boolean;
};
type ProcessResponse = {
  runId: string;
  status: "success" | "partial" | "error";
  downloadUrl: string | null;
  zipFileName: string | null;
  summary: {
    totalGroups: number;
    filesGenerated: number;
    mismatches: number;
    successful: number;
  } | null;
  validations: Validation[];
  logs: LogItem[];
  error?: { message: string } | null;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB alineado con bucket

export function ExecuteClient({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = phase === "uploading" || phase === "processing";

  const pickFile = useCallback((picked: File | null) => {
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith(".xlsx")) {
      setErrorMsg("Solo se aceptan archivos .xlsx");
      return;
    }
    if (picked.size > MAX_FILE_SIZE) {
      setErrorMsg(
        `El archivo excede el límite de ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB.`
      );
      return;
    }
    setErrorMsg(null);
    setResult(null);
    setFile(picked);
    setPhase("idle");
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  };

  const start = async () => {
    if (!file) return;
    setErrorMsg(null);
    setResult(null);
    setPhase("uploading");
    setUploadProgress(0);

    try {
      // 1) Pedir URL firmada
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId, fileName: file.name }),
      });
      if (!urlRes.ok) {
        const e = await urlRes.json().catch(() => ({}));
        throw new Error(e.error ?? "No se pudo preparar la subida.");
      }
      const { runId, path, token, fileName } = (await urlRes.json()) as {
        runId: string;
        path: string;
        token: string;
        fileName: string;
      };

      // 2) Subir a Supabase Storage usando supabase-js (que gestiona progreso)
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("inputs")
        .uploadToSignedUrl(path, token, file, {
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true,
        });
      if (upErr) throw new Error(`Error subiendo archivo: ${upErr.message}`);

      setUploadProgress(100);
      setPhase("processing");

      // 3) Disparar procesamiento
      const procRes = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId,
          runId,
          path,
          fileName,
        }),
      });
      const procBody = (await procRes.json()) as ProcessResponse | { error: string };
      if (!procRes.ok) {
        const msg = (procBody as { error?: string }).error ?? "Error en el procesamiento.";
        throw new Error(msg);
      }

      const r = procBody as ProcessResponse;
      setResult(r);
      setPhase(r.status === "error" ? "error" : "done");
      if (r.error?.message) setErrorMsg(r.error.message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setErrorMsg(null);
    setPhase("idle");
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      {/* Zona de subida */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-brand-primary-600" />
            Sube tu archivo Excel
          </CardTitle>
          <CardDescription>
            Arrastra el archivo o haz clic para seleccionarlo. Máximo 50 MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isBusy) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            disabled={isBusy}
            className={cn(
              "w-full rounded-xl border-2 border-dashed p-8 text-center transition-all",
              "hover:border-brand-primary-400 hover:bg-brand-primary-50/40",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              dragActive
                ? "border-brand-primary-500 bg-brand-primary-50"
                : file
                ? "border-brand-primary-300 bg-brand-primary-50/30"
                : "border-border"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <FileSpreadsheet className="h-8 w-8 text-brand-primary-600" />
                <div className="text-left">
                  <div className="font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <CloudUpload className="h-10 w-10 text-brand-primary-500" />
                <span className="text-sm">
                  Haz clic o arrastra tu archivo <b>.xlsx</b> aquí
                </span>
              </div>
            )}
          </button>

          <div className="flex gap-2 mt-4 justify-end">
            {file ? (
              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={isBusy}
              >
                Cambiar archivo
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={start}
              disabled={!file || isBusy}
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {phase === "uploading" ? "Subiendo..." : "Procesando..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Procesar reporte
                </>
              )}
            </Button>
          </div>

          {/* Progreso */}
          {phase === "uploading" ? (
            <div className="mt-4 space-y-1">
              <Progress value={uploadProgress} />
              <div className="text-xs text-muted-foreground">
                Subiendo a Supabase Storage...
              </div>
            </div>
          ) : null}
          {phase === "processing" ? (
            <div className="mt-4 rounded-md bg-brand-secondary-50 border border-brand-secondary-200 p-3 flex items-center gap-3 text-sm text-brand-secondary-900">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ejecutando pipeline en el servidor. Esto puede tomar entre 5s y
              60s según el tamaño del archivo.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Error */}
      {errorMsg ? (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error al procesar "{templateName}"</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      ) : null}

      {/* Resultado */}
      {result ? <ResultPanel result={result} /> : null}
    </div>
  );
}

function ResultPanel({ result }: { result: ProcessResponse }) {
  const mismatches = result.validations.filter((v) => !v.matched);
  const successIcon =
    result.status === "success" ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
    ) : result.status === "partial" ? (
      <AlertTriangle className="h-5 w-5 text-amber-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    );

  const statusLabel =
    result.status === "success"
      ? "Procesado sin descuadres"
      : result.status === "partial"
      ? "Procesado con descuadres"
      : "Error";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {successIcon}
          <div>
            <CardTitle className="text-base">{statusLabel}</CardTitle>
            <CardDescription>
              {result.summary
                ? `${result.summary.filesGenerated} archivos generados para ${result.summary.totalGroups} agencias.`
                : "Sin resumen disponible."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Download */}
        {result.downloadUrl ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-primary-200 bg-brand-primary-50/50 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-md bg-brand-primary-500 p-2 text-white">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {result.zipFileName ?? "Resultado.zip"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Enlace firmado válido por 1 hora.
                </div>
              </div>
            </div>
            <Button asChild>
              <a href={result.downloadUrl} download>
                <Download className="h-4 w-4" />
                Descargar ZIP
              </a>
            </Button>
          </div>
        ) : null}

        {/* Validaciones */}
        {result.validations.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium mb-2">Validaciones</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                OK: {result.validations.length - mismatches.length}
              </Badge>
              {mismatches.length > 0 ? (
                <Badge variant="warning">Descuadres: {mismatches.length}</Badge>
              ) : null}
            </div>
            {mismatches.length > 0 ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 max-h-48 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-amber-100 text-amber-900">
                    <tr>
                      <th className="text-left px-3 py-1.5">Regla</th>
                      <th className="text-left px-3 py-1.5">Grupo</th>
                      <th className="text-right px-3 py-1.5">Hoja Reporte</th>
                      <th className="text-right px-3 py-1.5">Hoja Base</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mismatches.map((m, i) => (
                      <tr key={i} className="border-t border-amber-200">
                        <td className="px-3 py-1.5">{m.ruleName}</td>
                        <td className="px-3 py-1.5">{m.groupKey ?? "global"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{m.left}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{m.right}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Logs */}
        {result.logs.length > 0 ? (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              Ver {result.logs.length} logs detallados
            </summary>
            <div className="mt-2 rounded-md bg-muted/60 max-h-64 overflow-auto font-mono text-xs">
              {result.logs.map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-3 py-1 border-b border-border/40 last:border-b-0",
                    l.level === "error" && "text-red-700",
                    l.level === "warn" && "text-amber-700",
                    l.level === "success" && "text-emerald-700"
                  )}
                >
                  <span className="opacity-60 uppercase text-[10px] mr-2">
                    [{l.level}]
                  </span>
                  {l.message}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
