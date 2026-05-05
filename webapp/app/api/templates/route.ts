import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { validatePipeline } from "@/lib/pipeline/validator";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleRow?.role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

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

  const { data, error } = await supabase
    .from("report_templates")
    .insert({
      name: body.name.trim(),
      description: body.description ?? null,
      pipeline: validation.pipeline,
      is_active: body.is_active ?? true,
      version: 1,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
