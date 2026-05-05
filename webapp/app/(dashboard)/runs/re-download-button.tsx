"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Genera una signed URL bajo demanda para re-descargar un ZIP ya procesado.
 * Esto evita llenar el historial con URLs firmadas precomputadas (que
 * caducarían de todos modos) y mantiene las páginas server-side baratas.
 */
export function ReDownloadButton({
  outputPath,
}: {
  runId: string;
  outputPath: string;
}) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("outputs")
        .createSignedUrl(outputPath, 60 * 10);
      if (error || !data) throw new Error(error?.message ?? "No disponible");
      window.location.href = data.signedUrl;
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "No se pudo descargar el archivo. Puede que haya expirado."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={loading}>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Descargar
    </Button>
  );
}
