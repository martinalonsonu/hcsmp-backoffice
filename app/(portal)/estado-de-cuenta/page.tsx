import type { Metadata } from "next";
import { PortalGate } from "@/components/dashboard/portal-gate";
import { MovementsView } from "@/components/dashboard/views/movements-view";

export const metadata: Metadata = { title: "Mi estado de cuenta" };

export default function AccountPage() {
  return <PortalGate route="account"><MovementsView scope="personal" /></PortalGate>;
}
