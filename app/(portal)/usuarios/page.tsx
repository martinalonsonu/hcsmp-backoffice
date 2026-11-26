import type { Metadata } from "next";
import { PortalGate } from "@/components/dashboard/portal-gate";
import { UsersView } from "@/components/dashboard/views/users-view";

export const metadata: Metadata = { title: "Usuarios y accesos" };

export default function UsersPage() {
  return <PortalGate route="users"><UsersView /></PortalGate>;
}
