"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Archive,
  CalendarDays,
  ChartNoAxesCombined,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UsersRound,
} from "lucide-react";
import { HcsmpBrand } from "@/components/brand/hcsmp-brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigationItems = [
  { label: "Resumen", href: "#resumen", icon: LayoutDashboard, active: true },
  {
    label: "Miembros",
    href: "#modulo-miembros",
    icon: UsersRound,
    active: false,
  },
  {
    label: "Actividades",
    href: "#actividades",
    icon: CalendarDays,
    active: false,
  },
  {
    label: "Tesorería",
    href: "#modulo-tesoreria",
    icon: ChartNoAxesCombined,
    active: false,
  },
  { label: "Archivo", href: "#modulo-archivo", icon: Archive, active: false },
];

type DashboardShellProps = {
  children: React.ReactNode;
};

function DashboardShell({ children }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "min-h-screen bg-paper lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]",
        isCollapsed && "lg:grid-cols-[5rem_minmax(0,1fr)]",
      )}
    >
      <aside className="border-b border-line bg-white-warm lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div
          className={cn(
            "flex items-center justify-between px-5 py-4 sm:px-7 lg:px-6 lg:py-7",
            isCollapsed && "lg:justify-center lg:px-3",
          )}
        >
          <Link
            aria-label="HCSMP, ir al resumen"
            className={cn("min-w-0", isCollapsed && "lg:hidden")}
            href="/dashboard"
          >
            <HcsmpBrand iconOnly />
          </Link>
          <span className="rounded-full border border-line px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted lg:hidden">
            Demo
          </span>
          <button
            aria-controls="dashboard-navigation"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expandir menú" : "Contraer menú"}
            className="hidden size-10 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay lg:inline-flex"
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            title={isCollapsed ? "Expandir menú" : "Contraer menú"}
            type="button"
          >
            {isCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-5" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
        <nav
          aria-label="Navegación principal"
          className="grid grid-cols-2 gap-1 px-4 pb-4 lg:block lg:space-y-1 lg:px-3 lg:py-5"
          id="dashboard-navigation"
        >
          <p
            className={cn(
              "hidden px-3 pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-muted lg:block",
              isCollapsed && "lg:sr-only",
            )}
          >
            Espacio de trabajo
          </p>
          {navigationItems.map(({ active, href, icon: Icon, label }) => (
            <Link
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={cn(
                "flex min-h-11 min-w-0 items-center gap-3 rounded-sm px-3 text-xs font-medium transition-colors sm:text-sm lg:w-full",
                active
                  ? "bg-mist text-ink"
                  : "text-muted hover:bg-mist/70 hover:text-ink",
                isCollapsed && "lg:justify-center lg:px-0",
              )}
              href={href}
              key={label}
              title={isCollapsed ? label : undefined}
            >
              <Icon
                aria-hidden="true"
                className="size-4 shrink-0"
                strokeWidth={1.8}
              />
              <span className={cn("truncate", isCollapsed && "lg:sr-only")}>
                {label}
              </span>
            </Link>
          ))}
        </nav>
        <div
          className={cn(
            "mt-auto hidden p-4 lg:block",
            isCollapsed && "lg:px-2",
          )}
        >
          <div
            className={cn(
              "rounded-sm border border-line bg-paper p-4",
              isCollapsed && "lg:flex lg:justify-center lg:p-3",
            )}
            title={isCollapsed ? "¿Necesitas ayuda?" : undefined}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <CircleHelp
                aria-hidden="true"
                className="size-4 text-clay-text"
              />
              <span className={cn(isCollapsed && "lg:sr-only")}>
                ¿Necesitas ayuda?
              </span>
            </div>
            <p
              className={cn(
                "mt-2 text-xs leading-5 text-muted",
                isCollapsed && "lg:hidden",
              )}
            >
              Comunícate con la junta directiva para consultas sobre el portal.
            </p>
          </div>
          <Button
            asChild
            className={cn(
              "mt-3 w-full justify-start",
              isCollapsed && "lg:justify-center lg:px-0",
            )}
            size="sm"
            variant="ghost"
          >
            <Link href="/">
              <LogOut aria-hidden="true" className="size-4" />
              <span className={cn(isCollapsed && "lg:sr-only")}>
                Salir de la demostración
              </span>
            </Link>
          </Button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-18 items-center justify-between border-b border-line bg-white-warm/80 px-5 sm:px-8 lg:px-10">
          <p className="text-xs text-muted sm:text-sm">
            <span className="sm:hidden">Portal HCSMP</span>
            <span className="hidden sm:inline">
              Hermandad de Cargadores de San Martín de Porres
            </span>
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block">
              <span className="block text-xs font-semibold text-ink">
                Perfil de ejemplo
              </span>
              <span className="mt-0.5 block text-[0.6875rem] text-muted">
                Coordinación
              </span>
            </span>
            <span
              aria-label="Perfil de ejemplo"
              className="grid size-9 place-items-center rounded-full bg-ink text-xs font-semibold text-paper"
              role="img"
            >
              HC
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-360 px-4 py-6 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
          {children}
          <footer className="mt-10 border-t border-line pt-5 text-xs text-muted">
            Hermandad de Cargadores de San Martín de Porres · Cruz Blanca
          </footer>
        </main>
      </div>
    </div>
  );
}

export { DashboardShell };
