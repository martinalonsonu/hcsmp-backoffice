import type { NextConfig } from "next";

// Enlaces antiguos del tipo /dashboard?view=users hacia la ruta propia de cada módulo.
const legacyViews: Record<string, string> = {
  members: "/padron",
  users: "/usuarios",
  requests: "/solicitudes",
  treasury: "/tesoreria",
  account: "/estado-de-cuenta",
  profile: "/perfil",
};

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return Object.entries(legacyViews).map(([view, destination]) => ({
      source: "/dashboard",
      has: [{ type: "query" as const, key: "view", value: view }],
      destination,
      permanent: false,
    }));
  },
};

export default nextConfig;
