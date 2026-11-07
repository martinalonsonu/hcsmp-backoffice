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
  accrueScheduledDues,
  canAccessPortal,
  createSeedData,
  generatePassword,
  hashPassword,
  normalizeDraft,
  migratePortalData,
  nextMonth,
  retiredMember,
  readmittedMember,
  todayDate,
  ownProfilePatch,
  uniqueUsername,
  updatedMember,
  validateMovement,
  validateRequestInput,
  validateRequestStatus,
  verifyPassword,
  type Member,
  type MemberRequest,
  type MemberDraft,
  type MemberNameParts,
  type Movement,
  type PortalData,
  type RequestStatus,
  type Role,
} from "@/lib/portal";

const DATA_KEY = "hcsmp.portal.demo.v1";
const SESSION_KEY = "hcsmp.portal.session.v1";

type PortalContextValue = {
  ready: boolean;
  currentDate: string;
  currentMember: Member | null;
  members: Member[];
  movements: Movement[];
  requests: MemberRequest[];
  ordinaryFees: PortalData["ordinaryFees"];
  billingStartMonth: string;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  createMember: (
    draft: MemberDraft,
    nameParts: MemberNameParts,
  ) => Promise<{ member: Member; username: string; password: string }>;
  updateMember: (
    id: string,
    patch: Partial<MemberDraft> & { role?: Role },
  ) => void;
  retireMember: (id: string) => void;
  readmitMember: (id: string) => void;
  updateOwnProfile: (patch: Partial<MemberDraft>) => void;
  changePassword: (current: string, next: string) => Promise<void>;
  addMovement: (input: Omit<Movement, "id">) => void;
  submitRequest: (title: string, content: string) => void;
  updateRequestStatus: (id: string, status: RequestStatus) => void;
  updateOrdinaryFee: (amount: number) => void;
};
const PortalContext = createContext<PortalContextValue | null>(null);

function parseData(raw: string): PortalData {
  return migratePortalData(JSON.parse(raw));
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [currentDate, setCurrentDate] = useState("");
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
        const loaded = stored ? parseData(stored) : await createSeedData();
        const initial = accrueScheduledDues(loaded);
        if (cancelled) return;
        // Persist before displaying success; storage failures leave the original state intact.
        const serialized = JSON.stringify(initial);
        if (stored !== serialized) localStorage.setItem(DATA_KEY, serialized);
        const savedSession = sessionStorage.getItem(SESSION_KEY);
        const validSession = initial.members.some(
          (member) => member.id === savedSession && canAccessPortal(member),
        )
          ? savedSession
          : null;
        if (savedSession && !validSession)
          sessionStorage.removeItem(SESSION_KEY);
        dataRef.current = initial;
        sessionRef.current = validSession;
        setCurrentDate(todayDate());
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
        if (
          sessionRef.current &&
          !next.members.some(
            (member) =>
              member.id === sessionRef.current && canAccessPortal(member),
          )
        ) {
          sessionRef.current = null;
          setSessionId(null);
          sessionStorage.removeItem(SESSION_KEY);
        }
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
    const member =
      dataRef.current?.members.find(
        (candidate) => candidate.id === sessionRef.current,
      ) ?? null;
    return member && canAccessPortal(member) ? member : null;
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
    if (
      sessionRef.current &&
      !next.members.some(
        (member) => member.id === sessionRef.current && canAccessPortal(member),
      )
    ) {
      sessionRef.current = null;
      setSessionId(null);
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        setError(
          "El acceso está suspendido, pero no se pudo limpiar la sesión guardada.",
        );
      }
    }
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
    const latest = currentData().members.find(
      (candidate) => candidate.id === member.id,
    );
    if (!latest || latest.passwordHash !== member.passwordHash)
      throw new Error("Las credenciales cambiaron. Vuelve a iniciar sesión.");
    if (!canAccessPortal(latest))
      throw new Error(
        "Tu acceso está suspendido por retiro. Comunícate con Secretaría para registrar tu reingreso.",
      );
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
  async function createMember(draft: MemberDraft, nameParts: MemberNameParts) {
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
    const username = uniqueUsername(nameParts, current.members);
    const member: Member = {
      ...normalizeDraft(draft),
      id: crypto.randomUUID(),
      role: "estandar",
      username,
      passwordHash,
      status: "vigente",
      retiredAt: "",
      rejoinedAt: draft.category === "reingresante" ? todayDate() : "",
      membershipHistory:
        draft.category === "reingresante"
          ? [{ type: "reingreso", date: todayDate(), category: "reingresante" }]
          : [],
    };
    commit(
      accrueScheduledDues(
        { ...current, members: [...current.members, member] },
        todayDate(),
      ),
    );
    return { member, username, password };
  }
  function updateMember(
    id: string,
    patch: Partial<MemberDraft> & { role?: Role },
  ) {
    const current = currentData();
    const member = current.members.find((candidate) => candidate.id === id);
    if (!member) throw new Error("No se encontró al hermano.");
    const withAccruedDues = accrueScheduledDues(current, todayDate());
    const next = updatedMember(actor(), member, patch, current.members);
    commit(
      {
        ...withAccruedDues,
        members: withAccruedDues.members.map((candidate) =>
          candidate.id === id ? next : candidate,
        ),
      },
    );
  }
  function retireMember(id: string) {
    const current = currentData();
    const member = current.members.find((candidate) => candidate.id === id);
    if (!member) throw new Error("No se encontró al hermano.");
    const withAccruedDues = accrueScheduledDues(current, todayDate());
    const next = retiredMember(actor(), member);
    commit({
      ...withAccruedDues,
      members: withAccruedDues.members.map((candidate) =>
        candidate.id === id ? next : candidate,
      ),
    });
  }
  function readmitMember(id: string) {
    const current = currentData();
    const member = current.members.find((candidate) => candidate.id === id);
    if (!member) throw new Error("No se encontró al hermano.");
    const withAccruedDues = accrueScheduledDues(current, todayDate());
    const next = readmittedMember(actor(), member);
    commit(
      accrueScheduledDues(
        {
          ...withAccruedDues,
          members: withAccruedDues.members.map((candidate) =>
            candidate.id === id ? next : candidate,
          ),
        },
        todayDate(),
      ),
    );
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
  function submitRequest(title: string, content: string) {
    const requester = actor();
    if (!requester)
      throw new Error("Inicia sesión para enviar una solicitud.");
    if (requester.role === "secretaria")
      throw new Error("Secretaría gestiona las solicitudes y no puede enviarlas.");
    validateRequestInput(title, content);
    const current = currentData();
    const submittedAt = todayDate();
    const request: MemberRequest = {
      id: crypto.randomUUID(),
      requesterId: requester.id,
      title: title.trim(),
      content: content.trim(),
      status: "enviada",
      submittedAt,
      updatedAt: submittedAt,
    };
    commit({ ...current, requests: [...current.requests, request] });
  }
  function updateRequestStatus(id: string, status: RequestStatus) {
    assertRole(actor(), ["secretaria"]);
    validateRequestStatus(status);
    const current = currentData();
    if (!current.requests.some((request) => request.id === id))
      throw new Error("No se encontró la solicitud.");
    commit({
      ...current,
      requests: current.requests.map((request) =>
        request.id === id
          ? { ...request, status, updatedAt: todayDate() }
          : request,
      ),
    });
  }
  function updateOrdinaryFee(amount: number) {
    const current = currentData();
    assertRole(actor(), ["tesoreria"]);
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error("La cuota ordinaria debe ser mayor que cero.");
    const effectiveMonth = nextMonth(todayDate().slice(0, 7));
    const ordinaryFees = [
      ...current.ordinaryFees.filter(
        (rate) => rate.effectiveMonth !== effectiveMonth,
      ),
      { effectiveMonth, amount: Math.round(amount * 100) / 100 },
    ].toSorted((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
    commit({ ...current, ordinaryFees });
  }

  return (
    <PortalContext.Provider
      value={{
        ready,
        currentDate,
        error,
        members: data?.members ?? [],
        movements: data?.movements ?? [],
        requests: data?.requests ?? [],
        ordinaryFees: data?.ordinaryFees ?? [],
        billingStartMonth: data?.billingStartMonth ?? "",
        currentMember:
          data?.members.find(
            (member) => member.id === sessionId && canAccessPortal(member),
          ) ?? null,
        login,
        logout,
        createMember,
        updateMember,
        retireMember,
        readmitMember,
        updateOwnProfile,
        changePassword,
        addMovement,
        submitRequest,
        updateRequestStatus,
        updateOrdinaryFee,
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
