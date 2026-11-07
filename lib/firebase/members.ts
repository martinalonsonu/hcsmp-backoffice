import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseServices } from "./client";
import type { PortalIdentity } from "./auth";
import type { MemberRecord } from "./models";

type MemberInput = Pick<MemberRecord, "fullName" | "dni" | "birthDate" | "address" | "phone" | "email" | "occupation" | "maritalStatus" | "joinedAt" | "swornAt" | "category" | "sacraments">;
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
  const { db } = getFirebaseServices();
  await addDoc(collection(db, "hermanos"), {
    fullName, dni, birthDate: input.birthDate, address: input.address.trim(),
    phone: input.phone.trim(), email: input.email.trim(), occupation: input.occupation.trim(),
    maritalStatus: input.maritalStatus.trim(), joinedAt: input.joinedAt,
    swornAt: input.swornAt, category: input.category, status: "vigente",
    sacraments: input.sacraments, photoUrl: null, guardian: null,
    retiredAt: "", rejoinedAt: "", createdAt: date(), updatedAt: date(),
    createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp(),
    createdBy: identity.uid,
  });
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
