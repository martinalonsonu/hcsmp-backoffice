import {
  EmailAuthProvider,
  isSignInWithEmailLink,
  linkWithCredential,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { getFirebaseServices } from "./client.ts";
import type { Role } from "@/lib/portal";

export interface Enrollment {
  hermanoId: string;
  role: Role;
  activo: boolean;
  uid: string | null;
}

export function normalizeEmail(email: string | null | undefined): string {
  const normalized = (email ?? "").trim().toLowerCase();
  if (normalized.length > 200 || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(normalized)) {
    throw new Error("Ingresa un correo electrónico válido.");
  }
  return normalized;
}

export async function sendRegistrationLink(email: string): Promise<void> {
  const address = normalizeEmail(email);
  const { auth } = getFirebaseServices();
  await sendSignInLinkToEmail(auth, address, {
    url: `${window.location.origin}/?registro=1`,
    handleCodeInApp: true,
  });
}

export async function finishRegistration(email: string, password: string): Promise<void> {
  const address = normalizeEmail(email);
  if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  const { auth, db } = getFirebaseServices();
  if (!isSignInWithEmailLink(auth, window.location.href)) {
    throw new Error("El enlace de registro no es válido.");
  }
  const credential = await signInWithEmailLink(auth, address, window.location.href);
  try {
    const user = credential.user;
    await user.getIdToken(true);
    const enrollmentRef = doc(db, "preautorizaciones", address);
    const snapshot = await getDoc(enrollmentRef);
    if (!snapshot.exists()) {
      throw new Error("Este correo no tiene una autorización. Contacta a Secretaría.");
    }
    const enrollment = snapshot.data() as Enrollment;
    if (!enrollment.activo || (enrollment.uid && enrollment.uid !== user.uid)) {
      throw new Error("Esta autorización no está disponible. Contacta a Secretaría.");
    }
    if (user.providerData.some((provider) => provider.providerId === "password")) {
      await updatePassword(user, password);
    } else {
      await linkWithCredential(user, EmailAuthProvider.credential(address, password));
    }
    if (!enrollment.uid) {
      const batch = writeBatch(db);
      const today = new Date().toISOString().slice(0, 10);
      batch.set(doc(db, "usuarios", user.uid), {
        hermanoId: enrollment.hermanoId,
        username: address,
        role: enrollment.role,
        activo: enrollment.activo,
        createdAt: today,
        updatedAt: today,
      });
      batch.update(enrollmentRef, { uid: user.uid, claimedAtServer: serverTimestamp() });
      await batch.commit();
    }
    window.history.replaceState(null, "", "/");
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}
