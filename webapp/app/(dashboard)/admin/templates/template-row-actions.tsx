"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Pencil, Power, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TemplateRowActions({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggleActive() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Error al actualizar");
        return;
      }
      router.refresh();
    });
  }

  function handleDuplicate() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/templates/${id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Error al duplicar");
        return;
      }
      const { id: newId } = await res.json();
      router.push(`/admin/templates/${newId}/edit`);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Error al eliminar");
        return;
      }
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="sm" title="Editar">
        <Link href={`/admin/templates/${id}/edit`}>
          <Pencil className="h-4 w-4" />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        title="Duplicar"
        onClick={handleDuplicate}
        disabled={isPending}
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        title={isActive ? "Desactivar" : "Activar"}
        onClick={handleToggleActive}
        disabled={isPending}
      >
        <Power
          className={
            "h-4 w-4 " +
            (isActive ? "text-emerald-600" : "text-muted-foreground")
          }
        />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        title="Eliminar"
        onClick={() => setConfirmDelete(true)}
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4 text-red-600" />
      </Button>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar plantilla</DialogTitle>
            <DialogDescription>
              ¿Eliminar definitivamente la plantilla <strong>{name}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
