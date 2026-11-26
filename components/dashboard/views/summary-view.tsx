"use client";

import { ClipboardList, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { ModuleCard } from "@/components/dashboard/module-card";
import { Metric } from "@/components/dashboard/metric";
import { useLoadedPortal } from "@/components/dashboard/portal-session";
import { routeIcons } from "@/components/dashboard/route-icons";
import { PageHeader } from "@/components/ui/page-header";
import { categoryLabels, statusLabels, type Role } from "@/lib/portal";
import { routesForRole, type PortalRouteId } from "@/lib/portal-routes";

const quickAccessDescriptions: Partial<Record<PortalRouteId, (role: Role) => string>> = {
  members: (role) => role === "secretaria" ? "Registra hermanos y administra sus fichas." : "Consulta las fichas de los hermanos.",
  treasury: () => "Consulta los movimientos registrados de la institución.",
  users: (role) => role === "secretaria" ? "Administra las cuentas y los accesos al portal." : "Consulta las cuentas y los accesos al portal.",
  requests: (role) => role === "secretaria" ? "Revisa las solicitudes recibidas y actualiza su seguimiento." : "Envía solicitudes a Secretaría y consulta su estado.",
  account: () => "Consulta tus cuotas, pagos y saldo personal.",
  profile: () => "Revisa los datos de tu ficha de hermano.",
};

export function SummaryView() {
  const { data, role } = useLoadedPortal();
  const canRoster = role === "secretaria" || role === "presidencia";
  const shortcuts = routesForRole(role).filter((route) => route.id !== "summary");

  return (
    <>
      <PageHeader eyebrow="Hermandad de Cargadores de San Martín de Porres" title="Portal de Gestión Interna"
        description={<>Bienvenido, <span className="font-medium text-ink">{data.member.fullName.split(" ")[0]}</span>. Este es el resumen de tu espacio de trabajo.</>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric icon={UserRound} label="Mi categoría" value={categoryLabels[data.member.category]} />
        <Metric icon={ClipboardList} label="Solicitudes visibles" value={String(data.requests.length)} />
        {canRoster
          ? <Metric icon={UsersRound} label="Hermanos en el padrón" value={String(data.rosterCoverage?.total ?? 0)} />
          : <Metric icon={ShieldCheck} label="Mi estado" value={statusLabels[data.member.status]} />}
      </div>
      <section aria-labelledby="quick-access-title" className="space-y-4">
        <h2 id="quick-access-title" className="font-display text-2xl">Accesos rápidos</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((route) => <ModuleCard key={route.id} id={`acceso-${route.id}`}
            title={route.label} description={quickAccessDescriptions[route.id]?.(role) ?? ""}
            href={route.href} icon={routeIcons[route.id]} />)}
        </div>
      </section>
    </>
  );
}
