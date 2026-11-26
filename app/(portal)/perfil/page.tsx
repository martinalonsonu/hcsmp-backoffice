import type { Metadata } from "next";
import { PortalGate } from "@/components/dashboard/portal-gate";
import { ProfileView } from "@/components/dashboard/views/profile-view";

export const metadata: Metadata = { title: "Mi perfil" };

export default function ProfilePage() {
  return <PortalGate route="profile"><ProfileView /></PortalGate>;
}
