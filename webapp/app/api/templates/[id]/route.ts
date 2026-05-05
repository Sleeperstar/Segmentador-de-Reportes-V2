import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { validatePipeline } from "@/lib/pipeline/validator";

export const runtime = "nodejs";

async function ensureAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleRow?.role !== "admin") {
    return { error: "Acceso denegado", status: 403 as const };
  }
  return { supabase, user };
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await ensureAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await params;

  let body: {
    name?: string;
    description?: string | null;
    pipeline?: unknown;
    is_active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const validation = validatePipeline(body.pipeline);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Pipeline inválido", issues: validation.issues },
      { status: 400 }
    );
  }

  const { supabase } = guard;
  const { data: current } = await supabase
    .from("report_templates")
    .select("version")
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  }

  const { error } = await supabase
    .from("report_templates")
    .update({
      name: body.name.trim(),
      description: body.description ?? null,
      pipeline: validation.pipeline,
      is_active: body.is_active ?? true,
      version: current.version + 1,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await ensureAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await params;

  let body: { is_active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "is_active requerido" }, { status: 400 });
  }

  const { supabase } = guard;
  const { error } = await supabase
    .from("report_templates")
    .update({ is_active: body.is_active })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await ensureAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await params;

  const { supabase } = guard;
  const { error } = await supabase.from("report_templates").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
