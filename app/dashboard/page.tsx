import type { Metadata } from "next";
import { Suspense } from "react";
import { FirebaseDashboard } from "@/components/dashboard/firebase-dashboard";

export const metadata: Metadata = { title: "Portal institucional" };

export default function DashboardRoute() {
  return <Suspense fallback={<p className="p-8">Cargando portal…</p>}><FirebaseDashboard /></Suspense>;
}
