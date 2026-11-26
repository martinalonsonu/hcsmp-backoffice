import type { Metadata } from "next";
import { PortalGate } from "@/components/dashboard/portal-gate";
import { RequestsView } from "@/components/dashboard/views/requests-view";

export const metadata: Metadata = { title: "Solicitudes" };

export default function RequestsPage() {
  return <PortalGate route="requests"><RequestsView /></PortalGate>;
}
