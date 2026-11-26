"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { logoutFirebase, observePortalIdentity, type PortalIdentity } from "@/lib/firebase/auth";
import {
  readAccountMovements,
  readAllMovements,
  readEnrollments,
  readMyMember,
  readRequests,
  readUserDirectory,
} from "@/lib/firebase/queries";
import { rosterCoverage } from "@/lib/firebase/roster";
import type { MemberRecord, MovementRecord, RequestRecord, UserRecord } from "@/lib/firebase/models";
import type { Enrollment } from "@/lib/firebase/registration";

export type MemberRow = MemberRecord & { id: string };
export type MovementRow = MovementRecord & { id: string };
export type RequestRow = RequestRecord & { id: string };
export type PortalSnapshot = {
  member: MemberRow;
  rosterCoverage: { total: number; indexed: number } | null;
  requests: RequestRow[];
  movements: MovementRow[];
  users: Array<UserRecord & { id: string }>;
  enrollments: Array<Enrollment & { id: string }>;
};

type PortalSession = {
  identity: PortalIdentity | null;
  data: PortalSnapshot | null;
  loading: boolean;
  error: string;
  /** Vuelve a consultar los datos compartidos sin ocultar la pantalla actual. */
  reload: () => void;
  signOut: () => Promise<void>;
};

const PortalSessionContext = createContext<PortalSession | null>(null);

async function loadSnapshot(identity: PortalIdentity): Promise<PortalSnapshot> {
  const member = await readMyMember(identity);
  if (!member || member.status !== "vigente") throw new Error("Tu ficha institucional no está vigente.");
  const role = identity.user.role;
  const manager = role === "secretaria" || role === "presidencia";
  const [coverage, requests, movements, users, enrollments] = await Promise.all([
    manager ? rosterCoverage(identity) : Promise.resolve(null),
    readRequests(identity),
    role === "tesoreria" || role === "presidencia" ? readAllMovements(identity) : readAccountMovements(identity),
    manager ? readUserDirectory(identity) : Promise.resolve([]),
    manager ? readEnrollments(identity) : Promise.resolve([]),
  ]);
  return { member, rosterCoverage: coverage, requests, movements, users, enrollments };
}

export function PortalSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [data, setData] = useState<PortalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = observePortalIdentity((next) => {
        if (!active) return;
        setIdentity(next);
        setData(null);
        setError("");
        if (!next) {
          setLoading(false);
          router.replace("/");
          return;
        }
        setLoading(true);
      }, (cause) => {
        if (active) { setError(cause.message); setLoading(false); }
      });
    } catch (cause) {
      // Firebase sin configurar falla de forma síncrona; se informa fuera del cuerpo del efecto.
      queueMicrotask(() => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Firebase no está configurado.");
        setLoading(false);
      });
    }
    return () => { active = false; unsubscribe?.(); };
  }, [router]);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    void (async () => {
      try {
        const snapshot = await loadSnapshot(identity);
        if (active) { setData(snapshot); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar Firestore.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [identity, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const signOut = useCallback(async () => {
    try {
      await logoutFirebase();
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cerrar sesión.");
    }
  }, [router]);

  const value = useMemo(
    () => ({ identity, data, loading, error, reload, signOut }),
    [identity, data, loading, error, reload, signOut],
  );
  return <PortalSessionContext.Provider value={value}>{children}</PortalSessionContext.Provider>;
}

export function usePortalSession(): PortalSession {
  const session = useContext(PortalSessionContext);
  if (!session) throw new Error("usePortalSession debe usarse dentro de PortalSessionProvider.");
  return session;
}

/** Para las pantallas de módulo: el layout solo las monta cuando la sesión ya está cargada. */
export function useLoadedPortal() {
  const { identity, data, ...rest } = usePortalSession();
  if (!identity || !data) throw new Error("La sesión del portal todavía no está disponible.");
  return { ...rest, identity, data, role: identity.user.role };
}
