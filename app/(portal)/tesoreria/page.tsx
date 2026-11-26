import type { Metadata } from "next";
import { PortalGate } from "@/components/dashboard/portal-gate";
import { MovementsView } from "@/components/dashboard/views/movements-view";

export const metadata: Metadata = { title: "Tesorería" };

export default function TreasuryPage() {
  return <PortalGate route="treasury"><MovementsView scope="institution" /></PortalGate>;
}
