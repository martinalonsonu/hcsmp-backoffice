import type { Metadata } from "next";
import { PortalGate } from "@/components/dashboard/portal-gate";
import { MembersView } from "@/components/dashboard/views/members-view";

export const metadata: Metadata = { title: "Padrón de hermanos" };

export default function MembersPage() {
  return <PortalGate route="members"><MembersView /></PortalGate>;
}
