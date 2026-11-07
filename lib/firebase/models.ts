/** Modelos persistidos; las contraseñas nunca se guardan en Firestore. */
export type Role = "estandar" | "tesoreria" | "secretaria" | "presidencia";
export type Category = "postulante" | "reingresante" | "activo" | "vitalicio" | "honorario";
export type MembershipStatus = "vigente" | "retirado";

export interface UserRecord {
  hermanoId: string | null; // null para una cuenta de servicio excepcional
  username: string;
  role: Role;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuardianRecord {
  fullName: string;
  dni: string;
  education: string;
  address: string;
  phone: string;
  relationship: string;
  age: string;
  sacraments: string[];
}

export interface MemberRecord {
  fullName: string;
  dni: string;
  birthDate: string; // YYYY-MM-DD, calendario de Lima
  address: string;
  phone: string;
  email: string;
  occupation: string;
  maritalStatus: string;
  joinedAt: string;
  swornAt: string;
  category: Category;
  status: MembershipStatus;
  sacraments: string[];
  photoUrl: string | null; // Nunca imágenes base64 en documentos Firestore
  guardian: GuardianRecord | null;
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

/** Compatible semánticamente con Movement de lib/portal.ts; importes en céntimos. */
export interface MovementRecord {
  date: string;
  description: string;
  memberId: string;
  type: "ingreso" | "egreso" | "cargo" | "pago";
  amountCents: number;
  createdBy: string;
  createdAt: string;
}
