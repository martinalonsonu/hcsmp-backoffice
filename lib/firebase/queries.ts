import {
  collection, doc, getDoc, getDocs, query, where,
  type DocumentData, type QueryConstraint,
} from "firebase/firestore";
import { getFirebaseServices } from "./client";
import type { PortalIdentity } from "./auth";
import type {
  MemberRecord, MovementRecord, RequestRecord, EconomicSettingsRecord, UserRecord,
} from "./models";

function listWithIds<T extends DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): Promise<Array<T & { id: string }>> {
  const { db } = getFirebaseServices();
  return getDocs(query(collection(db, collectionName), ...constraints)).then(
    (snapshot) => snapshot.docs.map((item) => ({
      ...(item.data() as T),
      id: item.id,
    })),
  );
}

/** Standard accounts read only their own profile. */
export async function readMyMember(identity: PortalIdentity) {
  const { db } = getFirebaseServices();
  const snapshot = await getDoc(doc(db, "hermanos", identity.user.hermanoId));
  return snapshot.exists()
    ? ({ ...snapshot.data(), id: snapshot.id } as MemberRecord & { id: string })
    : null;
}

/** Only Secretaría and Presidencia may query the complete roster. */
export async function readRoster(identity: PortalIdentity) {
  if (!["secretaria", "presidencia"].includes(identity.user.role)) {
    throw new Error("No tienes permiso para consultar el padrón.");
  }
  return listWithIds<MemberRecord>("hermanos");
}

export async function readAccountMovements(identity: PortalIdentity) {
  // Security Rules are not query filters: memberId MUST be part of the query.
  return listWithIds<MovementRecord>("movimientos", [
    where("memberId", "==", identity.user.hermanoId),
  ]);
}

export async function readAllMovements(identity: PortalIdentity) {
  if (!["tesoreria", "presidencia"].includes(identity.user.role)) {
    throw new Error("No tienes permiso para consultar la caja.");
  }
  return listWithIds<MovementRecord>("movimientos");
}

export async function readRequests(identity: PortalIdentity) {
  return listWithIds<RequestRecord>(
    "solicitudes",
    identity.user.role === "secretaria"
      ? []
      : [where("requesterId", "==", identity.user.hermanoId)],
  );
}

export async function readEconomicSettings(identity: PortalIdentity) {
  if (!["tesoreria", "presidencia"].includes(identity.user.role)) {
    throw new Error("No tienes permiso para consultar la configuración económica.");
  }
  const { db } = getFirebaseServices();
  const snapshot = await getDoc(doc(db, "configuracionEconomica", "general"));
  return snapshot.exists() ? (snapshot.data() as EconomicSettingsRecord) : null;
}

/** User accounts are visible to Presidency only. Provisioning remains server-only. */
export async function readUserDirectory(identity: PortalIdentity) {
  if (!["secretaria","presidencia"].includes(identity.user.role)) {
    throw new Error("Solo Secretaría y Presidencia pueden consultar las cuentas.");
  }
  return listWithIds<UserRecord>("usuarios");
}
