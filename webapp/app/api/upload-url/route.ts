import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { sanitizeFileName } from "@/lib/pipeline/utils/normalize";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Body = {
  templateId: string;
  fileName: string;
};

/**
 * Genera una URL firmada para subir el archivo Excel directamente a
 * Supabase Storage (bucket `inputs`), evitando pasar 15 MB por el
 * function de Vercel. El path sigue la convención:
 *   {userId}/{runId}/{sanitizedFileName}
 *
 * Así las policies de Storage (auth.uid()::text = (storage.foldername(name))[1])
 * aprueban la operación. El cliente recibe `runId` para encadenar el POST a
 * /api/process luego del upload.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  if (!body?.templateId || !body?.fileName) {
    return NextResponse.json(
      { error: "Faltan campos: templateId y fileName son obligatorios." },
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

  // Rate limit: 30 generaciones de upload-url por hora por usuario.
  const rl = await checkRateLimit(supabase, "upload-url", 30, 3600);
  const rlResp = rateLimitResponse(rl);
  if (rlResp) return rlResp;

  // Verificar que la plantilla existe y está activa (RLS permite lectura a todos los autenticados).
  const { data: tpl, error: tplErr } = await supabase
    .from("report_templates")
    .select("id, is_active")
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

  const runId = randomUUID();
  const sanitized = sanitizeFileName(body.fileName) || "archivo.xlsx";
  const path = `${user.id}/${runId}/${sanitized}`;

  const { data: signed, error: signErr } = await supabase.storage
    .from("inputs")
    .createSignedUploadUrl(path);

  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? "No se pudo generar URL de subida." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    runId,
    path,
    fileName: sanitized,
    uploadUrl: signed.signedUrl,
    token: signed.token,
  });
}
