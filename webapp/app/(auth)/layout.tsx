import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-brand-primary-50 via-background to-brand-secondary-50">
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-xs text-muted-foreground">
        WIN Empresas · Segmentador de Reportes
      </p>
    </div>
  );
}
