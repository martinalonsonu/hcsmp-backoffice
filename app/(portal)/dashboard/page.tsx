import type { Metadata } from "next";
import { PortalGate } from "@/components/dashboard/portal-gate";
import { SummaryView } from "@/components/dashboard/views/summary-view";

export const metadata: Metadata = { title: "Portal institucional" };

export default function SummaryPage() {
  return <PortalGate route="summary"><SummaryView /></PortalGate>;
}
