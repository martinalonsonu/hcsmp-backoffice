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

const isPagesExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  ...(isPagesExport ? {
    output: "export" as const,
    basePath: "",
    images: { unoptimized: true },
  } : {}),
  ...(!isPagesExport ? {
    async redirects() {
      return Object.entries(legacyViews).map(([view, destination]) => ({
        source: "/dashboard",
        has: [{ type: "query" as const, key: "view", value: view }],
        destination,
        permanent: false,
      }));
    },
  } : {}),
  ...(!isPagesExport ? {
    cacheComponents: true,
    partialPrefetching: true,
  } : {
    cacheComponents: false,
  }),
  experimental: {
    agentFeedback: true,
  },
};

export default nextConfig;
