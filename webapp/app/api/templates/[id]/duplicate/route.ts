import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const { data: src, error: srcErr } = await supabase
    .from("report_templates")
    .select("name, description, pipeline")
    .eq("id", id)
    .maybeSingle();
  if (srcErr || !src) {
    return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("report_templates")
    .insert({
      name: `${src.name} (copia)`,
      description: src.description,
      pipeline: src.pipeline,
      is_active: false,
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
