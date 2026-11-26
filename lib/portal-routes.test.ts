import assert from "node:assert/strict";
import { test } from "node:test";
import { portalRoutes, routeForPath, routesForRole } from "./portal-routes.ts";

test("cada módulo tiene su propia ruta, sin parámetros de consulta", () => {
  const hrefs = portalRoutes.map((route) => route.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const href of hrefs) assert.match(href, /^\/[a-z-]+$/);
});

test("cada rol solo ve los módulos que le corresponden", () => {
  const ids = (role: Parameters<typeof routesForRole>[0]) => routesForRole(role).map((route) => route.id);
  const common = ["summary", "requests", "account", "profile"];
  assert.deepEqual(ids("estandar"), common);
  assert.deepEqual(ids("tesoreria"), ["summary", "treasury", ...common.slice(1)]);
  assert.deepEqual(ids("secretaria"), ["summary", "members", "users", ...common.slice(1)]);
  assert.deepEqual(ids("presidencia"), ["summary", "members", "treasury", "users", ...common.slice(1)]);
  assert.deepEqual(ids(undefined), common);
});

test("routeForPath reconoce la ruta activa aunque tenga barra final o subrutas", () => {
  assert.equal(routeForPath("/usuarios")?.id, "users");
  assert.equal(routeForPath("/usuarios/")?.id, "users");
  assert.equal(routeForPath("/padron/123")?.id, "members");
  assert.equal(routeForPath("/dashboard")?.id, "summary");
  assert.equal(routeForPath("/usuarios-falso"), undefined);
  assert.equal(routeForPath("/"), undefined);
});
