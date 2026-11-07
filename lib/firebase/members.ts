import { addDoc, collection, doc, serverTimestamp, updateDoc, runTransaction } from "firebase/firestore";
import { getFirebaseServices } from "./client";
import type { PortalIdentity } from "./auth";
import type { MemberRecord } from "./models";

type MemberInput = Pick<MemberRecord, "fullName" | "dni" | "birthDate" | "address" | "phone" | "email" | "occupation" | "maritalStatus" | "joinedAt" | "swornAt" | "category" | "sacraments" | "guardian">;
type ContactInput = Pick<MemberRecord, "address" | "phone" | "email" | "occupation" | "maritalStatus">;
const date = () => new Date().toISOString().slice(0, 10);

function requireRosterManager(identity: PortalIdentity) {
  if (identity.user.role !== "secretaria" && identity.user.role !== "presidencia")
    throw new Error("No tienes permiso para gestionar el padrón.");
}

export async function createInstitutionalMember(identity: PortalIdentity, input: MemberInput) {
  requireRosterManager(identity);
  const fullName = input.fullName.trim();
  const dni = input.dni.trim();
  if (fullName.length < 5 || fullName.length > 160) throw new Error("Nombre inválido.");
  if (dni && !/^[0-9]{8}$/.test(dni)) throw new Error("El DNI debe tener ocho dígitos.");
  if (!["postulante", "reingresante", "activo", "vitalicio"].includes(input.category))
    throw new Error("Categoría inválida.");
  const guardian = input.guardian;
  if (input.sacraments.length > 10 || input.sacraments.some((value) => typeof value !== "string" || value.length > 60))
    throw new Error("Revisa los sacramentos seleccionados.");
  if (guardian && (!guardian.fullName.trim() || (guardian.dni && !/^[0-9]{8}$/.test(guardian.dni))))
    throw new Error("Revisa el nombre y DNI del apoderado.");
  const { db } = getFirebaseServices();
  const payload = {
    fullName, dni, birthDate: input.birthDate, address: input.address.trim(),
    phone: input.phone.trim(), email: input.email.trim(), occupation: input.occupation.trim(),
    maritalStatus: input.maritalStatus.trim(), joinedAt: input.joinedAt,
    swornAt: input.swornAt, category: input.category, status: "vigente",
    sacraments: input.sacraments, photoUrl: null, guardian: guardian ?? null,
    retiredAt: "", rejoinedAt: "", createdAt: date(), updatedAt: date(),
    createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp(),
    createdBy: identity.uid,
  };
  if (dni) {
    // Deterministic ID plus create-only Security Rule prevents concurrent duplicates.
    const memberRef = doc(db, "hermanos", `dni-${dni}`);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(memberRef);
      if (existing.exists()) throw new Error("Ya existe un hermano registrado con ese DNI.");
      transaction.set(memberRef, payload);
    });
  } else {
    await addDoc(collection(db, "hermanos"), payload);
  }
}

export async function updateInstitutionalMemberContact(identity: PortalIdentity, memberId: string, input: ContactInput) {
  requireRosterManager(identity);
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, "hermanos", memberId), {
    address: input.address.trim(), phone: input.phone.trim(), email: input.email.trim(),
    occupation: input.occupation.trim(), maritalStatus: input.maritalStatus.trim(),
    updatedAt: date(), updatedAtServer: serverTimestamp(),
  });
}

/** Atomic category change and immutable institutional history; Secretary only. */
export async function changeMemberCategory(identity: PortalIdentity, memberId: string, category: MemberRecord["category"], reason: string) {
  if (identity.user.role !== "secretaria") throw new Error("Solo Secretaría puede cambiar categorías.");
  const motive = reason.trim();
  if (motive.length < 10 || motive.length > 500) throw new Error("Indica un motivo de 10 a 500 caracteres.");
  if (!["postulante","reingresante","activo","vitalicio"].includes(category)) throw new Error("Categoría inválida.");
  const { db } = getFirebaseServices();
  const memberRef = doc(db,"hermanos",memberId);
  const eventRef = doc(collection(db,"historialInstitucional"));
  await runTransaction(db,async (tx) => {
    const snapshot = await tx.get(memberRef);
    if (!snapshot.exists()) throw new Error("No se encontró al hermano.");
    const current = snapshot.data() as MemberRecord;
    if (current.status !== "vigente") throw new Error("Solo se puede cambiar la categoría de hermanos vigentes.");
    if (current.category === category) throw new Error("Selecciona una categoría diferente.");
    const now = date();
    tx.update(memberRef,{category,updatedAt:now,updatedAtServer:serverTimestamp(),lastCategoryEventId:eventRef.id});
    tx.set(eventRef,{hermanoId:memberId,type:"cambio_categoria",fromCategory:current.category,
      category,date:now,reason:motive,recordedBy:identity.uid,createdAt:now,
      createdAtServer:serverTimestamp()});
  });
}

/** Secretary-only lifecycle transition. The original member ID and ledger remain intact. */
export async function changeMemberLifecycle(identity: PortalIdentity, memberId: string, action: "retiro" | "reingreso", reason: string) {
  if (identity.user.role !== "secretaria") throw new Error("Solo Secretaría puede registrar retiros y reingresos.");
  const motive = reason.trim();
  if (motive.length < 10 || motive.length > 500) throw new Error("Indica un motivo de 10 a 500 caracteres.");
  const { db } = getFirebaseServices();
  const memberRef = doc(db,"hermanos",memberId);
  const eventRef = doc(collection(db,"historialInstitucional"));
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(memberRef);
    if (!snapshot.exists()) throw new Error("No se encontró al hermano.");
    const current = snapshot.data() as MemberRecord;
    if (action === "retiro" && current.status !== "vigente") throw new Error("El hermano ya se encuentra retirado.");
    if (action === "reingreso" && current.status !== "retirado") throw new Error("Solo puede reingresar un hermano retirado.");
    const now = date();
    const status = action === "retiro" ? "retirado" : "vigente";
    const category = action === "reingreso" ? "reingresante" : current.category;
    tx.update(memberRef,{
      status, category,
      ...(action === "retiro" ? {retiredAt:now} : {rejoinedAt:now}),
      updatedAt:now, updatedAtServer:serverTimestamp(),
      lastLifecycleEventId:eventRef.id,
    });
    tx.set(eventRef,{
      hermanoId:memberId,type:action,fromStatus:current.status,status,
      fromCategory:current.category,category,date:now,reason:motive,
      recordedBy:identity.uid,createdAt:now,createdAtServer:serverTimestamp(),
    });
  });
}
