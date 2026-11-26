import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "./client";
import { normalizeEmail } from "./registration";
import type { UserRecord } from "./models";

/** Authentication account + authorization record, not a Member or a password hash. */
export interface PortalIdentity {
  uid: string;
  user: UserRecord;
}

async function loadIdentity(uid: string): Promise<PortalIdentity> {
  const { db } = getFirebaseServices();
  const snapshot = await getDoc(doc(db, "usuarios", uid));
  if (!snapshot.exists()) {
    throw new Error("Tu cuenta no está habilitada en el padrón de usuarios.");
  }
  const record = snapshot.data() as UserRecord;
  if (
    record.activo !== true ||
    !record.hermanoId ||
    !["estandar", "tesoreria", "secretaria", "presidencia"].includes(record.role)
  ) {
    throw new Error("Tu cuenta no tiene autorización para ingresar.");
  }
  return { uid, user: record };
}

/** Sign-in is complete only after verifying the server-authorized Firestore record. */
export async function loginWithEmail(
  email: string,
  password: string,
): Promise<PortalIdentity> {
  const { auth } = getFirebaseServices();
  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      normalizeEmail(email),
      password,
    );
    return await loadIdentity(credential.user.uid);
  } catch (error) {
    await signOut(auth).catch(() => undefined);
    if (error instanceof Error && /habilitada|autorización|válido/.test(error.message)) {
      throw error;
    }
    throw new Error("El usuario o la contraseña no son correctos.");
  }
}

export async function logoutFirebase(): Promise<void> {
  const { auth } = getFirebaseServices();
  await signOut(auth);
}

/**
 * Subscribe to Firebase's persistent session. This does not replace checking
 * account status on privileged writes or Firestore Security Rules.
 */
export function observePortalIdentity(
  onChange: (identity: PortalIdentity | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const { auth } = getFirebaseServices();
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      onChange(null);
      return;
    }
    void loadIdentity(user.uid)
      .then(onChange)
      .catch(async (error: unknown) => {
        await signOut(auth).catch(() => undefined);
        onChange(null);
        onError(error instanceof Error ? error : new Error("Error de sesión."));
      });
  }, onError);
}
