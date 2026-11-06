"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  assertRole,
  assertValidMember,
  createSeedData,
  generatePassword,
  hashPassword,
  normalizeDraft,
  ownProfilePatch,
  uniqueUsername,
  updatedMember,
  validateMovement,
  verifyPassword,
  type Member,
  type MemberDraft,
  type Movement,
  type PortalData,
  type Role,
} from "@/lib/portal";

const DATA_KEY = "hcsmp.portal.demo.v1";
const SESSION_KEY = "hcsmp.portal.session.v1";

type PortalContextValue = {
  ready: boolean;
  currentMember: Member | null;
  members: Member[];
  movements: Movement[];
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  createMember: (
    draft: MemberDraft,
  ) => Promise<{ member: Member; username: string; password: string }>;
  updateMember: (
    id: string,
    patch: Partial<MemberDraft> & { role?: Role },
  ) => void;
  updateOwnProfile: (patch: Partial<MemberDraft>) => void;
  changePassword: (current: string, next: string) => Promise<void>;
  addMovement: (input: Omit<Movement, "id">) => void;
};
const PortalContext = createContext<PortalContextValue | null>(null);

function parseData(raw: string): PortalData {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object")
    throw new Error("Los datos locales no son válidos.");
  const data = value as PortalData;
  if (
    data.version !== 1 ||
    !Array.isArray(data.members) ||
    !Array.isArray(data.movements) ||
    !data.members.every(
      (member) =>
        typeof member.id === "string" &&
        typeof member.username === "string" &&
        typeof member.passwordHash === "string" &&
        typeof member.fullName === "string",
    )
  ) {
    throw new Error("Los datos locales no son compatibles con esta versión.");
  }
  return data;
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<PortalData | null>(null);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const stored = localStorage.getItem(DATA_KEY);
        const initial = stored ? parseData(stored) : await createSeedData();
        if (cancelled) return;
        // Persist before displaying success; storage failures leave the original state intact.
        if (!stored) localStorage.setItem(DATA_KEY, JSON.stringify(initial));
        const savedSession = sessionStorage.getItem(SESSION_KEY);
        const validSession = initial.members.some(
          (member) => member.id === savedSession,
        )
          ? savedSession
          : null;
        dataRef.current = initial;
        sessionRef.current = validSession;
        setData(initial);
        setSessionId(validSession);
      } catch {
        if (!cancelled)
          setError(
            "No se pudieron cargar los datos de demostración. Comprueba que el navegador permita almacenamiento local.",
          );
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void initialize();
    function synchronize(event: StorageEvent) {
      if (event.key !== DATA_KEY || !event.newValue) return;
      try {
        const next = parseData(event.newValue);
        dataRef.current = next;
        setData(next);
      } catch {
        setError("No se pudo sincronizar el cambio realizado en otra pestaña.");
      }
    }
    window.addEventListener("storage", synchronize);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", synchronize);
    };
  }, []);

  function currentData(): PortalData {
    if (!dataRef.current)
      throw new Error("Espera a que se carguen los datos del portal.");
    return dataRef.current;
  }
  function actor(): Member | null {
    return (
      dataRef.current?.members.find(
        (member) => member.id === sessionRef.current,
      ) ?? null
    );
  }
  function commit(next: PortalData) {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(next));
    } catch {
      throw new Error(
        "No se pudo guardar. Revisa el espacio y los permisos de almacenamiento del navegador.",
      );
    }
    dataRef.current = next;
    setData(next);
  }

  async function login(username: string, password: string) {
    const loginName = username.trim().toLowerCase();
    const member = currentData().members.find(
      (candidate) =>
        candidate.username.toLowerCase() === loginName ||
        (!!candidate.email && candidate.email.toLowerCase() === loginName),
    );
    if (!member || !(await verifyPassword(password, member.passwordHash)))
      throw new Error("El usuario o la contraseña no son correctos.");
    try {
      sessionStorage.setItem(SESSION_KEY, member.id);
    } catch {
      throw new Error(
        "El navegador no permite guardar la sesión de demostración.",
      );
    }
    sessionRef.current = member.id;
    setSessionId(member.id);
  }
  function logout() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      setError("No se pudo eliminar la sesión guardada en el navegador.");
    }
    sessionRef.current = null;
    setSessionId(null);
  }
  async function createMember(draft: MemberDraft) {
    assertRole(actor(), ["secretaria"]);
    const authorId = actor()!.id;
    assertValidMember(draft, currentData().members);
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    const author = actor();
    assertRole(author, ["secretaria"]);
    if (author.id !== authorId)
      throw new Error("La sesión cambió. Vuelve a registrar al hermano.");
    const current = currentData();
    assertValidMember(draft, current.members);
    const username = uniqueUsername(draft, current.members);
    const member: Member = {
      ...normalizeDraft(draft),
      id: crypto.randomUUID(),
      role: "estandar",
      username,
      passwordHash,
    };
    commit({ ...current, members: [...current.members, member] });
    return { member, username, password };
  }
  function updateMember(
    id: string,
    patch: Partial<MemberDraft> & { role?: Role },
  ) {
    const current = currentData();
    const member = current.members.find((candidate) => candidate.id === id);
    if (!member) throw new Error("No se encontró al hermano.");
    const next = updatedMember(actor(), member, patch, current.members);
    commit({
      ...current,
      members: current.members.map((candidate) =>
        candidate.id === id ? next : candidate,
      ),
    });
  }
  function updateOwnProfile(patch: Partial<MemberDraft>) {
    const current = currentData();
    const next = ownProfilePatch(actor(), patch, current.members);
    commit({
      ...current,
      members: current.members.map((member) =>
        member.id === next.id ? next : member,
      ),
    });
  }
  async function changePassword(currentPassword: string, nextPassword: string) {
    const member = actor();
    if (!member) throw new Error("Inicia sesión para cambiar tu contraseña.");
    if (nextPassword.length < 8)
      throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
    if (!(await verifyPassword(currentPassword, member.passwordHash)))
      throw new Error("La contraseña actual no es correcta.");
    const passwordHash = await hashPassword(nextPassword);
    const currentActor = actor();
    if (
      !currentActor ||
      currentActor.id !== member.id ||
      currentActor.passwordHash !== member.passwordHash
    )
      throw new Error("La sesión o la contraseña cambió. Vuelve a intentarlo.");
    const current = currentData();
    commit({
      ...current,
      members: current.members.map((candidate) =>
        candidate.id === member.id ? { ...candidate, passwordHash } : candidate,
      ),
    });
  }
  function addMovement(input: Omit<Movement, "id">) {
    const current = currentData();
    validateMovement(actor(), input, current.members);
    const movement: Movement = {
      ...input,
      description: input.description.trim(),
      amount: Math.round(input.amount * 100) / 100,
      id: crypto.randomUUID(),
    };
    if (movement.amount <= 0) throw new Error("El importe mínimo es S/ 0.01.");
    commit({ ...current, movements: [...current.movements, movement] });
  }

  return (
    <PortalContext.Provider
      value={{
        ready,
        error,
        members: data?.members ?? [],
        movements: data?.movements ?? [],
        currentMember:
          data?.members.find((member) => member.id === sessionId) ?? null,
        login,
        logout,
        createMember,
        updateMember,
        updateOwnProfile,
        changePassword,
        addMovement,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal(): PortalContextValue {
  const value = useContext(PortalContext);
  if (!value)
    throw new Error("usePortal debe usarse dentro de PortalProvider.");
  return value;
}
