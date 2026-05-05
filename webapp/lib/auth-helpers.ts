import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getCurrentUserWithRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null as string | null };

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, role: roleRow?.role ?? null };
}

export async function requireAdmin() {
  const { user, role } = await getCurrentUserWithRole();
  if (!user) redirect("/login");
  if (role !== "admin") redirect("/");
  return { user, role };
}
