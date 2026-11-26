import type { Role } from "./portal.ts";

export type PortalRouteId =
  | "summary"
  | "members"
  | "treasury"
  | "users"
  | "requests"
  | "account"
  | "profile";

export type PortalRoute = {
  id: PortalRouteId;
  href: string;
  label: string;
  /** Roles que pueden abrir el módulo; si se omite, cualquier hermano autenticado. */
  roles?: readonly Role[];
};

export const portalRoutes: readonly PortalRoute[] = [
  { id: "summary", href: "/dashboard", label: "Resumen" },
  { id: "members", href: "/padron", label: "Padrón de hermanos", roles: ["secretaria", "presidencia"] },
  { id: "treasury", href: "/tesoreria", label: "Tesorería", roles: ["tesoreria", "presidencia"] },
  { id: "users", href: "/usuarios", label: "Usuarios y accesos", roles: ["secretaria", "presidencia"] },
  { id: "requests", href: "/solicitudes", label: "Solicitudes" },
  { id: "account", href: "/estado-de-cuenta", label: "Mi estado de cuenta" },
  { id: "profile", href: "/perfil", label: "Mi perfil" },
];

export function routesForRole(role: Role | undefined): PortalRoute[] {
  return portalRoutes.filter(
    (route) => !route.roles || (role !== undefined && route.roles.includes(role)),
  );
}

export function routeForPath(pathname: string): PortalRoute | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return portalRoutes.find((route) => path === route.href || path.startsWith(`${route.href}/`));
}
