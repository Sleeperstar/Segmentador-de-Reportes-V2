import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitResult =
  | { allowed: true; count: number; max: number }
  | { allowed: false; count?: number; max?: number; retry_after_seconds?: number; reason?: string };

/**
 * Llama a la función `public.check_rate_limit` en Supabase (SECURITY DEFINER).
 * Devuelve el resultado tal cual o un objeto con allowed=true por seguridad si
 * la función no está disponible (fail-open con log).
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  endpoint: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_endpoint: endpoint,
    p_max: max,
    p_window_seconds: windowSeconds,
  });

  if (error || !data) {
    console.warn("rate-limit RPC failed, fail-open", error);
    return { allowed: true, count: 0, max };
  }

  return data as RateLimitResult;
}

/**
 * Helper: si rate limit excedido, retorna un NextResponse 429 listo;
 * si no, retorna null y el caller continúa.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse | null {
  if (result.allowed) return null;
  const headers: HeadersInit = {};
  if (result.retry_after_seconds) {
    headers["Retry-After"] = String(result.retry_after_seconds);
  }
  return NextResponse.json(
    {
      error: "Demasiadas solicitudes. Intenta de nuevo en unos momentos.",
      retry_after_seconds: result.retry_after_seconds,
    },
    { status: 429, headers }
  );
}
