import { LogOut, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  user: { email: string; isAdmin: boolean };
};

export function TopBar({ user }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 backdrop-blur px-4 lg:px-6">
      <div className="lg:hidden">
        <span className="font-semibold text-sm">Segmentador</span>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          {user.isAdmin ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary-50 text-brand-primary-700 px-2 py-1 font-medium">
              <Shield className="h-3 w-3" />
              Admin
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 font-medium">
              <User className="h-3 w-3" />
              Usuario
            </span>
          )}
          <span>{user.email}</span>
        </div>

        <form action="/api/auth/signout" method="post">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
