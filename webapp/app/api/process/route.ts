import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { runPipeline } from "@/lib/pipeline";
import { sanitizeFileName } from "@/lib/pipeline/utils/normalize";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { Pipeline, LogEntry } from "@/lib/pipeline/types";

/**
 * El procesamiento es intensivo en CPU (lectura + escritura de XLSX + ZIP).
 * En Vercel Hobby se permite hasta 60s; en Pro hasta 300s. El runtime debe
 * ser Node (no Edge) porque exceljs y jszip usan APIs de Node.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  templateId: string;
  runId: string;
  path: string;
  fileName: string;
};

export async function POST(req: Request) {
  const startedAt = new Date();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }
  if (!body?.templateId || !body?.runId || !body?.path || !body?.fileName) {
    return NextResponse.json(
      { error: "Faltan campos: templateId, runId, path, fileName." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // Rate limit: 10 procesamientos por hora por usuario (operación pesada).
  const rl = await checkRateLimit(supabase, "process", 10, 3600);
  const rlResp = rateLimitResponse(rl);
  if (rlResp) return rlResp;

  // Seguridad: el path debe empezar con el userId (defensa en profundidad
  // además de las policies de Storage).
  if (!body.path.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { error: "Path no pertenece al usuario." },
      { status: 403 }
    );
  }

  // Cargar plantilla
  const { data: tpl, error: tplErr } = await supabase
    .from("report_templates")
    .select("id, name, version, pipeline, is_active")
    .eq("id", body.templateId)
    .maybeSingle();

  if (tplErr) {
    return NextResponse.json({ error: tplErr.message }, { status: 500 });
  }
  if (!tpl || !tpl.is_active) {
    return NextResponse.json(
      { error: "Plantilla no encontrada o inactiva." },
      { status: 404 }
    );
  }

  // Crear process_run en estado processing
  const { error: insErr } = await supabase.from("process_runs").insert({
    id: body.runId,
    template_id: tpl.id,
    template_version: tpl.version,
    user_id: user.id,
    input_file_path: body.path,
    input_file_name: body.fileName,
    status: "running",
    started_at: startedAt.toISOString(),
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  try {
    // Descargar input desde Storage
    const { data: blob, error: dlErr } = await supabase.storage
      .from("inputs")
      .download(body.path);
    if (dlErr || !blob) {
      throw new Error(dlErr?.message ?? "No se pudo descargar el archivo.");
    }
    const arrayBuffer = await blob.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Ejecutar pipeline
    const pipeline = tpl.pipeline as Pipeline;
    const result = await runPipeline({
      pipeline,
      fileBuffer,
      fileName: body.fileName,
    });

    let outputPath: string | null = null;
    let downloadUrl: string | null = null;

    if (result.output) {
      const zipName = sanitizeFileName(result.output.zipFileName);
      outputPath = `${user.id}/${body.runId}/${zipName}`;
      const { error: upErr } = await supabase.storage
        .from("outputs")
        .upload(outputPath, result.output.zipBuffer, {
          contentType: "application/zip",
          upsert: true,
        });
      if (upErr) throw new Error(`Error subiendo ZIP: ${upErr.message}`);

      const { data: signedDl, error: dlSignErr } = await supabase.storage
        .from("outputs")
        .createSignedUrl(outputPath, 60 * 60); // 1 hora
      if (dlSignErr || !signedDl) {
        throw new Error(dlSignErr?.message ?? "No se pudo generar URL de descarga.");
      }
      downloadUrl = signedDl.signedUrl;
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const status =
      result.status === "error"
        ? "error"
        : result.status === "partial"
        ? "partial"
        : "success";

    await supabase
      .from("process_runs")
      .update({
        status,
        output_zip_path: outputPath,
        summary: result.output?.summary ?? null,
        finished_at: finishedAt.toISOString(),
        duration_ms: durationMs,
      })
      .eq("id", body.runId);

    await insertLogs(supabase, body.runId, result.logs);

    return NextResponse.json({
      runId: body.runId,
      status,
      summary: result.output?.summary ?? null,
      validations: result.output?.validations ?? [],
      downloadUrl,
      zipFileName: result.output?.zipFileName ?? null,
      logs: result.logs.map((l) => ({
        level: l.level,
        message: l.message,
        timestamp: l.timestamp,
      })),
      error: result.error ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await supabase
      .from("process_runs")
      .update({
        status: "error",
        finished_at: finishedAt.toISOString(),
        duration_ms: durationMs,
      })
      .eq("id", body.runId);

    await insertLogs(supabase, body.runId, [
      {
        level: "error",
        message,
        timestamp: finishedAt,
      },
    ]);

    return NextResponse.json(
      { error: message, runId: body.runId, status: "error" },
      { status: 500 }
    );
  }
}

async function insertLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  runId: string,
  logs: LogEntry[]
) {
  if (logs.length === 0) return;
  const rows = logs.map((l, i) => ({
    run_id: runId,
    seq: i,
    level: l.level,
    message: l.message,
    context: l.context ?? null,
    created_at: l.timestamp.toISOString(),
  }));
  // Insertamos en lotes de 100 para evitar payloads gigantes.
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await supabase.from("process_run_logs").insert(chunk);
  }
}
