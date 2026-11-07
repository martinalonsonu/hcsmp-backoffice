import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "./client";
import type { UserRecord } from "./models";

/** Authentication account + authorization record, not a Member or a password hash. */
export interface PortalIdentity {
  uid: string;
  user: UserRecord;
}

/**
 * Usernames are UI aliases. Provision Firebase Auth accounts with matching
 * addresses on an institution-controlled domain (or a tested reserved domain).
 * The alias must be globally unique and immutable unless both sides are updated.
 */
export function usernameToAuthEmail(username: string): string {
  const normalized = username.trim().normalize("NFKC").toLowerCase();
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(normalized)) {
    throw new Error("Ingresa un nombre de usuario válido.");
  }
  const domain = process.env.NEXT_PUBLIC_FIREBASE_LOGIN_DOMAIN?.trim().toLowerCase();
  if (!domain || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain)) {
    throw new Error("Configura NEXT_PUBLIC_FIREBASE_LOGIN_DOMAIN.");
  }
  return `${normalized}@${domain}`;
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
export async function loginWithUsername(
  username: string,
  password: string,
): Promise<PortalIdentity> {
  const { auth } = getFirebaseServices();
  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      usernameToAuthEmail(username),
      password,
    );
    return await loadIdentity(credential.user.uid);
  } catch (error) {
    await signOut(auth).catch(() => undefined);
    if (error instanceof Error && /habilitada|autorización|Configura|válido/.test(error.message)) {
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
