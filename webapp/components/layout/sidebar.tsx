"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, History, Settings2, LayoutGrid } from "lucide-react";

import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/logo";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Plantillas", icon: LayoutGrid },
  { href: "/runs", label: "Últimos procesos", icon: History },
  {
    href: "/admin/templates",
    label: "Administrar plantillas",
    icon: Settings2,
    adminOnly: true,
  },
];

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-background">
      <div className="p-5 border-b border-border">
        <Link href="/" className="block">
          <BrandLogo className="h-10" />
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileSpreadsheet className="h-3.5 w-3.5 text-brand-primary-500" />
          <span>Procesamiento Excel</span>
        </div>
      </div>
    </aside>
  );
}
