import { PortalShell } from "@/components/dashboard/portal-shell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
