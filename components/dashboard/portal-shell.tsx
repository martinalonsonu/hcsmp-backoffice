"use client";

import Link, { useLinkStatus } from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { HcsmpBrand } from "@/components/brand/hcsmp-brand";
import { routeIcons } from "@/components/dashboard/route-icons";
import { PortalSessionProvider, usePortalSession } from "@/components/dashboard/portal-session";
import { Alert } from "@/components/ui/alert";
import { useAnimatedDialog } from "@/components/ui/use-animated-dialog";
import { categoryLabels, roleLabels } from "@/lib/portal";
import { routeForPath, routesForRole, type PortalRoute } from "@/lib/portal-routes";
import { cn } from "@/lib/utils";

function NavigationPendingHint({ compact = false }: { compact?: boolean }) {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={cn(
    "ml-auto size-1.5 shrink-0 rounded-full bg-clay transition-opacity delay-100 duration-150",
    pending ? "opacity-100" : "opacity-0",
    compact && "hidden",
  )}/>;
}

function PortalFrame({ children }: { children: ReactNode }) {
  const { identity, data, loading, error, signOut } = usePortalSession();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDialogElement>(null);

  useAnimatedDialog(mobileMenuRef, isMobileMenuOpen);

  const role = identity?.user.role;
  const routes = routesForRole(role);
  const current = routeForPath(pathname);

  const navLink = (route: PortalRoute, mobile = false) => {
    const Icon = routeIcons[route.id];
    const active = current?.id === route.id;
    const compact = !mobile && isCollapsed;
    return (
      <Link key={route.id} href={route.href}
        aria-current={active ? "page" : undefined} aria-label={route.label}
        title={compact ? route.label : undefined}
        onClick={mobile ? () => setIsMobileMenuOpen(false) : undefined}
        className={cn(
          "flex min-h-11 items-center rounded-sm text-sm transition-[padding,gap,background-color,color] duration-300",
          compact ? "gap-0 px-[18px]" : "gap-3 px-3",
          active ? "bg-mist font-semibold text-ink" : "text-muted hover:bg-mist/70 hover:text-ink",
        )}>
        <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
        <span className={cn("truncate transition-[max-width,opacity] duration-300", compact ? "max-w-0 opacity-0" : "max-w-44 opacity-100")}>{route.label}</span>
        <NavigationPendingHint compact={compact}/>
      </Link>
    );
  };
  const help = (
    <div className="rounded-sm border border-line bg-paper p-3 text-xs text-muted">
      <div className="flex items-center gap-2 font-semibold text-ink"><CircleHelp className="size-4" />¿Necesitas ayuda?</div>
      <p className="mt-2">Comunícate con la junta directiva para consultas sobre el portal.</p>
    </div>
  );

  return (
    <div className={cn(
      "min-h-screen bg-paper lg:grid lg:transition-[grid-template-columns] lg:duration-300 lg:ease-in-out",
      isCollapsed ? "lg:grid-cols-[5rem_minmax(0,1fr)]" : "lg:grid-cols-[16rem_minmax(0,1fr)]",
    )}>
      <aside className="hidden border-r border-line bg-white-warm lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <Link href="/dashboard" aria-label="HCSMP, ir al resumen" inert={isCollapsed}
            className={cn("overflow-hidden transition-[max-width,opacity] duration-300", isCollapsed ? "max-w-0 opacity-0" : "max-w-14 opacity-100")}>
            <HcsmpBrand iconOnly />
          </Link>
          <button type="button" aria-label={isCollapsed ? "Expandir menú" : "Contraer menú"}
            aria-expanded={!isCollapsed} aria-controls="portal-navigation"
            onClick={() => setIsCollapsed((value) => !value)} className="grid size-10 shrink-0 place-items-center rounded-sm hover:bg-mist">
            {isCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        </div>
        <nav id="portal-navigation" aria-label="Navegación principal" className="space-y-1 px-3 py-4">
          <p aria-hidden={isCollapsed}
            className={cn("overflow-hidden whitespace-nowrap px-3 text-xs font-semibold uppercase tracking-widest text-muted transition-[max-height,opacity,padding] duration-300",
              isCollapsed ? "max-h-0 pb-0 opacity-0" : "max-h-8 pb-2 opacity-100")}>Espacio de trabajo</p>
          {routes.map((route) => navLink(route))}
        </nav>
        <div className="mt-auto p-3">
          <div inert={isCollapsed}
            className={cn("grid transition-[grid-template-rows,opacity] duration-300", isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")}>
            <div className="overflow-hidden"><div className="pb-3">{help}</div></div>
          </div>
          <button type="button" onClick={() => void signOut()} title="Cerrar sesión" aria-label="Cerrar sesión"
            className={cn("flex w-full items-center rounded-sm py-3 text-sm transition-[padding,gap,background-color] duration-300 hover:bg-mist",
              isCollapsed ? "gap-0 px-[18px]" : "gap-3 px-3")}>
            <LogOut className="size-5 shrink-0" />
            <span className={cn("overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300", isCollapsed ? "max-w-0 opacity-0" : "max-w-44 opacity-100")}>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <dialog ref={mobileMenuRef} id="portal-mobile-navigation" aria-label="Menú de navegación" data-modal="menu"
        onCancel={(event) => { event.preventDefault(); setIsMobileMenuOpen(false); }}
        onClick={(event) => { if (event.target === event.currentTarget) setIsMobileMenuOpen(false); }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-ink/50 lg:hidden">
        <div className="flex h-full">
          <aside className="flex h-full w-[min(18rem,85vw)] flex-col border-r border-line bg-white-warm shadow-xl">
            <div className="flex items-center justify-between border-b border-line p-5">
              <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} aria-label="HCSMP, ir al resumen"><HcsmpBrand iconOnly /></Link>
              <button type="button" aria-label="Cerrar menú" onClick={() => setIsMobileMenuOpen(false)} className="grid size-10 place-items-center"><X className="size-5" /></button>
            </div>
            <nav aria-label="Navegación móvil" className="flex-1 space-y-1 overflow-y-auto p-3">
              <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-widest text-muted">Espacio de trabajo</p>
              {routes.map((route) => navLink(route, true))}
            </nav>
            <div className="space-y-3 border-t border-line p-4">{help}
              <button type="button" onClick={() => { setIsMobileMenuOpen(false); void signOut(); }} className="flex items-center gap-3 p-2 text-sm">
                <LogOut className="size-5" />Cerrar sesión
              </button>
            </div>
          </aside>
          <div className="min-w-0 flex-1" aria-hidden="true" />
        </div>
      </dialog>
      <div className="min-w-0">
        <header className="flex min-h-18 items-center justify-between border-b border-line bg-white-warm/80 px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label="Abrir menú" aria-controls="portal-mobile-navigation"
              aria-expanded={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(true)}
              className="grid size-10 place-items-center rounded-sm hover:bg-mist lg:hidden"><Menu className="size-5" /></button>
            <p className="truncate text-xs text-muted sm:text-sm"><span className="sm:hidden">Portal HCSMP</span>
              <span className="hidden sm:inline">Hermandad de Cargadores de San Martín de Porres</span></p>
          </div>
          <div className="flex items-center gap-3">
            {data && role && <span className="hidden text-right sm:block">
              <span className="block text-xs font-semibold">{data.member.fullName}</span>
              <span className="block text-xs text-muted">{roleLabels[role]} · {categoryLabels[data.member.category]}</span>
            </span>}
            {data && <span role="img" aria-label={data.member.fullName} className="grid size-9 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">
              {data.member.fullName.split(" ").slice(0, 2).map((word) => word[0]).join("")}
            </span>}
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-7xl space-y-8 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
          {loading && <Alert variant="loading">Cargando información institucional…</Alert>}
          {error && <Alert variant="error">{error}</Alert>}
          {!loading && !identity && !error && <Alert>Inicia sesión para acceder al portal.</Alert>}
          {children}
          {data && <p className="border-t border-line pt-5 text-xs text-muted">
            Hermandad de Cargadores de San Martín de Porres · Cruz Blanca
          </p>}
        </main>
      </div>
    </div>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <PortalSessionProvider>
      <PortalFrame>{children}</PortalFrame>
    </PortalSessionProvider>
  );
}
