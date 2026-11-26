import { collection, doc, serverTimestamp, runTransaction } from "firebase/firestore";
import { getFirebaseServices } from "./client.ts";
import type { PortalIdentity } from "./auth";
import type { MemberRecord, UserRecord } from "./models";
import { normalizeEmail, type Enrollment } from "./registration.ts";
import { makeRosterIndex } from "../roster-index.ts";

type MemberInput = Pick<MemberRecord, "fullName" | "dni" | "birthDate" | "sex" | "hasChildren" | "nonResidentHuacho" | "address" | "phone" | "email" | "occupation" | "maritalStatus" | "joinedAt" | "swornAt" | "category" | "sacraments" | "guardian">;
type ContactInput = Pick<MemberRecord, "address" | "phone" | "email" | "occupation" | "maritalStatus" | "sex" | "hasChildren" | "nonResidentHuacho" | "sacraments" | "guardian">;
const date = () => new Date().toISOString().slice(0, 10);

function validateFamilyFields(input: Pick<MemberRecord, "sex" | "hasChildren" | "nonResidentHuacho">) {
  if (input.sex != null && input.sex !== "varon" && input.sex !== "dama")
    throw new Error("Selecciona un sexo válido.");
  if (input.hasChildren != null && typeof input.hasChildren !== "boolean")
    throw new Error("Indica si el hermano tiene hijos.");
  if (input.nonResidentHuacho != null && typeof input.nonResidentHuacho !== "boolean")
    throw new Error("Indica si el hermano se acoge a la condición de no residente en Huacho.");
}

function requireRosterManager(identity: PortalIdentity) {
  if (identity.user.role !== "secretaria" && identity.user.role !== "presidencia")
    throw new Error("No tienes permiso para gestionar el padrón.");
}

export async function createInstitutionalMember(identity: PortalIdentity, input: MemberInput, role: UserRecord["role"]) {
  if (identity.user.role !== "secretaria") throw new Error("Solo Secretaría puede registrar accesos.");
  const fullName = input.fullName.trim();
  const dni = input.dni.trim();
  const email = normalizeEmail(input.email);
  if (fullName.length < 5 || fullName.length > 160) throw new Error("Nombre inválido.");
  if (dni && !/^[0-9]{8}$/.test(dni)) throw new Error("El DNI debe tener ocho dígitos.");
  if (!["postulante", "reingresante", "activo", "vitalicio"].includes(input.category))
    throw new Error("Categoría inválida.");
  if (!["estandar", "tesoreria", "secretaria", "presidencia"].includes(role))
    throw new Error("Perfil inválido.");
  if (role !== "estandar" && (input.category === "postulante" || input.category === "reingresante"))
    throw new Error("Los postulantes y reingresantes solo pueden tener el perfil Estándar.");
  validateFamilyFields(input);
  const guardian = input.guardian;
  if (input.sacraments.length > 10 || input.sacraments.some((value) => typeof value !== "string" || value.length > 60))
    throw new Error("Revisa los sacramentos seleccionados.");
  if (guardian && (!guardian.fullName.trim() || (guardian.dni && !/^[0-9]{8}$/.test(guardian.dni))))
    throw new Error("Revisa el nombre y DNI del apoderado.");
  const { db } = getFirebaseServices();
  const payload = {
    fullName, dni, birthDate: input.birthDate, sex: input.sex ?? null,
    hasChildren: input.hasChildren ?? null, nonResidentHuacho: input.nonResidentHuacho ?? false,
    address: input.address.trim(),
    phone: input.phone.trim(), email, occupation: input.occupation.trim(),
    maritalStatus: input.maritalStatus.trim(), joinedAt: input.joinedAt,
    swornAt: input.swornAt, category: input.category, status: "vigente",
    sacraments: input.sacraments, photoUrl: null, guardian: guardian ?? null,
    rosterIndex: makeRosterIndex({ ...input, fullName, dni, status: "vigente" }),
    retiredAt: "", rejoinedAt: "", createdAt: date(), updatedAt: date(),
    createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp(),
    createdBy: identity.uid,
  };
  const memberRef = dni ? doc(db, "hermanos", `dni-${dni}`) : doc(collection(db, "hermanos"));
  const enrollmentRef = doc(db, "preautorizaciones", email);
  await runTransaction(db, async (transaction) => {
    const [existing, enrollment] = await Promise.all([
      transaction.get(memberRef), transaction.get(enrollmentRef),
    ]);
    if (existing.exists()) throw new Error("Ya existe un hermano registrado con ese DNI.");
    if (enrollment.exists()) throw new Error("Este correo ya tiene una autorización de acceso.");
    transaction.set(memberRef, payload);
    transaction.set(enrollmentRef, {
      hermanoId: memberRef.id, role, activo: true, uid: null, createdAtServer: serverTimestamp(),
    });
  });
}

export async function authorizeExistingMember(identity: PortalIdentity, memberId: string, role: UserRecord["role"]) {
  if (identity.user.role !== "secretaria") throw new Error("Solo Secretaría puede registrar accesos.");
  const { db } = getFirebaseServices();
  await runTransaction(db, async (tx) => {
    const memberRef = doc(db, "hermanos", memberId);
    const member = await tx.get(memberRef);
    if (!member.exists()) throw new Error("No se encontró al hermano.");
    const data = member.data() as MemberRecord;
    if (data.status !== "vigente") throw new Error("La ficha debe estar vigente.");
    if (!["estandar", "tesoreria", "secretaria", "presidencia"].includes(role))
      throw new Error("Perfil inválido.");
    if (role !== "estandar" && (data.category === "postulante" || data.category === "reingresante"))
      throw new Error("Los postulantes y reingresantes solo pueden tener el perfil Estándar.");
    const email = normalizeEmail(data.email);
    const ref = doc(db, "preautorizaciones", email);
    if ((await tx.get(ref)).exists()) throw new Error("Este correo ya tiene una autorización de acceso.");
    tx.set(ref, { hermanoId: memberId, role, activo: true, uid: null, createdAtServer: serverTimestamp() });
  });
}

export async function updateInstitutionalMemberContact(identity: PortalIdentity, memberId: string, input: ContactInput) {
  requireRosterManager(identity);
  validateFamilyFields(input);
  const { db } = getFirebaseServices();
  const memberRef = doc(db, "hermanos", memberId);
  await runTransaction(db, async (tx) => {
    const member = await tx.get(memberRef);
    if (!member.exists()) throw new Error("No se encontró al hermano.");
    const current = member.data() as MemberRecord;
    const oldEmail = (current.email ?? "").trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    if (oldEmail !== email && oldEmail) {
      const oldRef = doc(db, "preautorizaciones", normalizeEmail(oldEmail));
      const oldEnrollment = await tx.get(oldRef);
      if (oldEnrollment.exists() && (oldEnrollment.data() as Enrollment).uid === null) {
        if (identity.user.role !== "secretaria") throw new Error("Solo Secretaría puede cambiar el correo de un acceso pendiente.");
        const newEmail = normalizeEmail(email);
        const newRef = doc(db, "preautorizaciones", newEmail);
        const replacement = await tx.get(newRef);
        if (replacement.exists()) throw new Error("Este correo ya tiene una autorización de acceso.");
        const enrollment = oldEnrollment.data() as Enrollment;
        if (!enrollment.activo) throw new Error("Habilita el acceso pendiente antes de cambiar el correo.");
        tx.delete(oldRef);
        tx.set(newRef, {
          hermanoId: memberId, role: enrollment.role, activo: true, uid: null,
          createdAtServer: serverTimestamp(),
        });
      }
    }
    tx.update(memberRef, {
      address: input.address.trim(), phone: input.phone.trim(), email,
      occupation: input.occupation.trim(), maritalStatus: input.maritalStatus.trim(),
      sex: input.sex ?? null, hasChildren: input.hasChildren ?? null,
      nonResidentHuacho: input.nonResidentHuacho ?? false,
      sacraments: input.sacraments, guardian: input.guardian,
      rosterIndex: makeRosterIndex({ ...current, ...input }),
      updatedAt: date(), updatedAtServer: serverTimestamp(),
    });
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
    tx.update(memberRef,{category,rosterIndex:makeRosterIndex({...current,category}),updatedAt:now,updatedAtServer:serverTimestamp(),lastCategoryEventId:eventRef.id});
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
      status, category, rosterIndex:makeRosterIndex({...current,status,category}),
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
