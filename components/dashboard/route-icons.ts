import {
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PortalRouteId } from "@/lib/portal-routes";

export const routeIcons: Record<PortalRouteId, LucideIcon> = {
  summary: LayoutDashboard,
  members: UsersRound,
  treasury: ChartNoAxesCombined,
  users: ShieldCheck,
  requests: ClipboardList,
  account: Wallet,
  profile: UserRound,
};
