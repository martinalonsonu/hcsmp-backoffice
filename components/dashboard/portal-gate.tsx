"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { usePortalSession } from "@/components/dashboard/portal-session";
import { EmptyState } from "@/components/ui/empty-state";
import { routesForRole, type PortalRouteId } from "@/lib/portal-routes";

/**
 * Cada página lo renderiza alrededor de su vista: mientras la sesión carga no muestra nada
 * (el shell informa el estado) y, si el rol no corresponde, explica que no hay acceso.
 */
export function PortalGate({ route, children }: { route: PortalRouteId; children: ReactNode }) {
  const { identity, data } = usePortalSession();
  if (!identity || !data) return null;
  if (!routesForRole(identity.user.role).some((item) => item.id === route)) {
    return (
      <EmptyState icon={ShieldAlert} title="No tienes acceso a este módulo"
        description="Si crees que es un error, comunícate con la junta directiva." />
    );
  }
  return <>{children}</>;
}
