/** Firestore contracts aligned with lib/portal.ts (2026-11-06).
 * Auth passwords and password hashes must never be persisted here.
 */
import type {
  Category, Guardian, MemberRequest, OrdinaryFeeRate, RequestStatus, Role,
} from "@/lib/portal";

export interface UserRecord {
  hermanoId: string;
  username: string; // e.g. nombre.apellido; Firebase Auth uses a separate email identity
  role: Role;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemberRecord {
  fullName: string;
  dni: string;
  birthDate: string;
  address: string;
  phone: string;
  email: string;
  occupation: string;
  maritalStatus: string;
  joinedAt: string;
  swornAt: string;
  category: Category;
  status: "vigente" | "retirado";
  sacraments: string[];
  /** Reference to a separately stored photo; never base64 in Firestore. */
  photoUrl: string | null;
  guardian: Guardian | null;
  retiredAt: string;
  rejoinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipHistoryRecord {
  hermanoId: string;
  type: "retiro" | "reingreso" | "cambio_categoria";
  date: string;
  category: Category;
  recordedBy: string;
  createdAt: string;
}

/** Values in integer céntimos; convert to/from the UI's PEN amounts at the adapter. */
export interface MovementRecord {
  date: string;
  description: string;
  memberId: string;
  type: "ingreso" | "egreso" | "cargo" | "pago";
  amountCents: number;
  createdBy: string;
  createdAt: string;
}

/** Requests are a current feature, not a future extension. */
export interface RequestRecord extends Pick<
  MemberRequest,
  "requesterId" | "title" | "content" | "submittedAt" | "updatedAt"
> {
  status: RequestStatus;
}

/** Mirrors the effective-dated fee rates and billing start in PortalData. */
export interface EconomicSettingsRecord {
  billingStartMonth: string;
  ordinaryFees: OrdinaryFeeRate[];
  updatedBy: string;
  updatedAt: string;
}
