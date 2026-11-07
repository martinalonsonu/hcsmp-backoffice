"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePortal } from "@/components/portal/portal-provider";
import { categoryLabels, roleLabels } from "@/lib/portal";
import {
  Wallet,
  UserRound,
  ChartNoAxesCombined,
  ClipboardList,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  UsersRound,
} from "lucide-react";
import { HcsmpBrand } from "@/components/brand/hcsmp-brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  children: React.ReactNode;
};

function DashboardShell({ children }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDialogElement>(null);
  const { ready, currentMember, logout, error } = usePortal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "summary";
  useEffect(() => {
    const dialog = mobileMenuRef.current;
    if (!dialog) return;
    if (isMobileMenuOpen && !dialog.open) dialog.showModal();
    if (!isMobileMenuOpen && dialog.open) dialog.close();
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (ready && !currentMember) router.replace("/");
  }, [ready, currentMember, router]);

  if (!ready)
    return (
      <p role="status" className="p-8 text-muted">
        Cargando portal…
      </p>
    );
  if (!currentMember)
    return (
      <p className="p-8">
        <Link href="/">Volver al acceso</Link>
      </p>
    );

  const role = currentMember.role;
  const navigationItems = [
    { label: "Resumen", view: "summary", icon: LayoutDashboard },
    ...(role === "secretaria" || role === "presidencia"
      ? [{ label: "Padrón de hermanos", view: "members", icon: UsersRound }]
      : []),
    ...(role === "tesoreria" || role === "presidencia"
      ? [{ label: "Tesorería", view: "treasury", icon: ChartNoAxesCombined }]
      : []),
    ...(role === "secretaria"
      ? [{ label: "Deudas generales", view: "debts", icon: Wallet }]
      : []),
    { label: "Solicitudes", view: "requests", icon: ClipboardList },
    { label: "Mi estado de cuenta", view: "account", icon: Wallet },
    { label: "Mi perfil", view: "profile", icon: UserRound },
  ];
  function signOut() {
    logout();
    router.replace("/");
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-paper lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]",
        isCollapsed && "lg:grid-cols-[5rem_minmax(0,1fr)]",
      )}
    >
      <aside className="hidden border-b border-line bg-white-warm lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
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
          {navigationItems.map(({ view: targetView, icon: Icon, label }) => (
            <Link
              aria-current={view === targetView ? "page" : undefined}
              aria-label={label}
              className={cn(
                "flex min-h-11 min-w-0 items-center gap-3 rounded-sm px-3 text-xs font-medium transition-colors sm:text-sm lg:w-full",
                view === targetView
                  ? "bg-mist text-ink"
                  : "text-muted hover:bg-mist/70 hover:text-ink",
                isCollapsed && "lg:justify-center lg:px-0",
              )}
              href={`/dashboard?view=${targetView}`}
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
            onClick={signOut}
            className={cn(
              "mt-3 w-full justify-start",
              isCollapsed && "lg:justify-center lg:px-0",
            )}
            size="sm"
            variant="ghost"
          >
            <LogOut aria-hidden="true" className="size-4" />
            <span className={cn(isCollapsed && "lg:sr-only")}>
              Cerrar sesión
            </span>
          </Button>
        </div>
      </aside>
      <dialog
        ref={mobileMenuRef}
        id="mobile-dashboard-navigation"
        aria-label="Menú de navegación"
        onCancel={(event) => {
          event.preventDefault();
          setIsMobileMenuOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsMobileMenuOpen(false);
          }
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-ink backdrop:bg-ink/50 lg:hidden"
      >
        <div className="flex h-full">
          <aside className="flex h-full w-[min(18rem,85vw)] flex-col border-r border-line bg-white-warm shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-5">
              <Link
                aria-label="HCSMP, ir al resumen"
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <HcsmpBrand iconOnly />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar menú"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            </div>
            <nav
              aria-label="Navegación principal"
              className="flex-1 space-y-1 overflow-y-auto p-3"
            >
              <p className="px-3 pb-2 pt-3 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-muted">
                Espacio de trabajo
              </p>
              {navigationItems.map(
                ({ view: targetView, icon: Icon, label }) => (
                  <Link
                    aria-current={view === targetView ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors",
                      view === targetView
                        ? "bg-mist text-ink"
                        : "text-muted hover:bg-mist/70 hover:text-ink",
                    )}
                    href={`/dashboard?view=${targetView}`}
                    key={label}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-5 shrink-0"
                      strokeWidth={1.8}
                    />
                    <span>{label}</span>
                  </Link>
                ),
              )}
            </nav>
            <div className="border-t border-line p-4">
              <div className="rounded-sm border border-line bg-paper p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  <CircleHelp
                    aria-hidden="true"
                    className="size-4 text-clay-text"
                  />
                  ¿Necesitas ayuda?
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Comunícate con la junta directiva para consultas sobre el
                  portal.
                </p>
              </div>
              <Button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  signOut();
                }}
                className="mt-3 w-full justify-start"
                size="sm"
                variant="ghost"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Cerrar sesión
              </Button>
            </div>
          </aside>
          <div className="min-w-0 flex-1" aria-hidden="true" />
        </div>
      </dialog>
      <div className="min-w-0">
        <header className="flex min-h-18 items-center justify-between border-b border-line bg-white-warm/80 px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Abrir menú"
              aria-controls="mobile-dashboard-navigation"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu aria-hidden="true" className="size-5" />
            </Button>
            <p className="truncate text-xs text-muted sm:text-sm">
              <span className="sm:hidden">Portal HCSMP</span>
              <span className="hidden sm:inline">
                Hermandad de Cargadores de San Martín de Porres
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block">
              <span className="block text-xs font-semibold text-ink">
                {currentMember.fullName}
              </span>
              <span className="mt-0.5 block text-[0.6875rem] text-muted">
                {roleLabels[currentMember.role]} ·{" "}
                {categoryLabels[currentMember.category]}
              </span>
            </span>
            <span
              aria-label={currentMember.fullName}
              className="grid size-9 place-items-center rounded-full bg-ink text-xs font-semibold text-paper"
              role="img"
            >
              {currentMember.fullName
                .split(" ")
                .slice(0, 2)
                .map((word) => word[0])
                .join("")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Cerrar sesión"
              onClick={signOut}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-360 px-4 py-6 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
          <p className="mb-6 rounded-sm border border-line bg-white/70 px-4 py-3 text-xs text-muted">
            Demostración local · Los registros y accesos se conservan únicamente
            en este navegador. Usa datos de prueba.
          </p>
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {error}
            </p>
          )}
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
