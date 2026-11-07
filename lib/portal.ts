/** Front-only demo domain. Replace this adapter with a backend before real use. */
export type Category = "postulante" | "reingresante" | "activo" | "vitalicio";
export type MembershipStatus = "vigente" | "retirado";
export type MembershipEvent = {
  type: "retiro" | "reingreso";
  date: string;
  category: Category;
};
export type CategoryChange = {
  date: string;
  category: Category;
};
export type Role = "estandar" | "tesoreria" | "secretaria" | "presidencia";
export type MemberNameParts = {
  givenNames: string;
  firstSurname: string;
  secondSurname: string;
};
export type Guardian = {
  fullName: string;
  dni: string;
  education: string;
  address: string;
  phone: string;
  relationship: string;
  age: string;
  sacraments: string[];
};
export type MemberDraft = {
  fullName: string;
  dni: string;
  birthDate: string;
  address: string;
  phone: string;
  email: string;
  occupation: string;
  maritalStatus: string;
  joinedAt: string;
  swornAt: string;
  category: Category;
  sacraments: string[];
  photo: string;
  guardian: Guardian | null;
};
export type Member = MemberDraft & {
  id: string;
  role: Role;
  username: string;
  passwordHash: string;
  status: MembershipStatus;
  retiredAt: string;
  rejoinedAt: string;
  membershipHistory: MembershipEvent[];
  categoryHistory?: CategoryChange[];
};
export type Movement = {
  id: string;
  date: string;
  description: string;
  memberId: string;
  type: "ingreso" | "egreso" | "cargo" | "pago";
  amount: number;
};
export type RequestStatus = "enviada" | "en_revision" | "derivada" | "resuelta";
export type MemberRequest = {
  id: string;
  requesterId: string;
  title: string;
  content: string;
  status: RequestStatus;
  submittedAt: string;
  updatedAt: string;
};
export type OrdinaryFeeRate = {
  effectiveMonth: string;
  amount: number;
};
export type PortalData = {
  version: 1;
  members: Member[];
  movements: Movement[];
  requests: MemberRequest[];
  ordinaryFees: OrdinaryFeeRate[];
  billingStartMonth: string;
};
export const roleLabels: Record<Role, string> = {
  estandar: "Estándar",
  tesoreria: "Tesorería",
  secretaria: "Secretaría",
  presidencia: "Presidencia",
};
export const categoryLabels: Record<Category, string> = {
  postulante: "Postulante",
  reingresante: "Reingresante",
  activo: "Activo",
  vitalicio: "Vitalicio",
};

export const statusLabels: Record<MembershipStatus, string> = {
  vigente: "Vigente",
  retirado: "Retirado",
};

export function isTrialCategory(category: Category): boolean {
  return category === "postulante" || category === "reingresante";
}

/** Retired accounts retain their credentials, which work again after readmission. */
export function canAccessPortal(
  member: Pick<Member, "status"> | null,
): boolean {
  return member?.status === "vigente";
}

/** Add lifecycle metadata without resetting existing members, credentials or ledger. */
export function migratePortalData(value: unknown): PortalData {
  if (!value || typeof value !== "object")
    throw new Error("Los datos locales no son válidos.");
  const stored = value as PortalData;
  if (
    stored.version !== 1 ||
    !Array.isArray(stored.members) ||
    !Array.isArray(stored.movements)
  )
    throw new Error("Los datos locales no son compatibles con esta versión.");
  const members = stored.members.map((item): Member => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      typeof item.username !== "string" ||
      typeof item.passwordHash !== "string" ||
      typeof item.fullName !== "string" ||
      !(item.category in categoryLabels)
    )
      throw new Error("La ficha local de un hermano no es válida.");
    const status = item.status ?? "vigente";
    const membershipHistory = item.membershipHistory ?? [];
    const categoryHistory = item.categoryHistory ?? [];
    if (
      !(status in statusLabels) ||
      !Array.isArray(membershipHistory) ||
      !membershipHistory.every(
        (event) =>
          event &&
          (event.type === "retiro" || event.type === "reingreso") &&
          typeof event.date === "string" &&
          validDate(event.date) &&
          event.category in categoryLabels,
      ) ||
      !Array.isArray(categoryHistory) ||
      !categoryHistory.every(
        (event) =>
          event &&
          typeof event.date === "string" &&
          validDate(event.date) &&
          event.category in categoryLabels,
      )
    )
      throw new Error("Los datos locales del historial no son válidos.");
    return {
      ...item,
      status,
      retiredAt: item.retiredAt ?? "",
      rejoinedAt: item.rejoinedAt ?? "",
      membershipHistory,
      categoryHistory,
    };
  });
  const requests = stored.requests ?? [];
  if (
    !Array.isArray(requests) ||
    !requests.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.requesterId === "string" &&
        typeof item.title === "string" &&
        typeof item.content === "string" &&
        (item.status === "enviada" ||
          item.status === "en_revision" ||
          item.status === "derivada" ||
          item.status === "resuelta") &&
        typeof item.submittedAt === "string" &&
        validDate(item.submittedAt) &&
        typeof item.updatedAt === "string" &&
        validDate(item.updatedAt),
    )
  )
    throw new Error("Las solicitudes locales no son válidas.");
  const month = todayDate().slice(0, 7);
  const ordinaryFees = stored.ordinaryFees ?? [
    { effectiveMonth: month, amount: 10 },
  ];
  if (
    !Array.isArray(ordinaryFees) ||
    !ordinaryFees.length ||
    !ordinaryFees.every(
      (rate) =>
        rate &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(rate.effectiveMonth) &&
        Number.isFinite(rate.amount) &&
        rate.amount > 0,
    )
  )
    throw new Error("La configuración de cuotas ordinarias no es válida.");
  const billingStartMonth = stored.billingStartMonth ?? month;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billingStartMonth))
    throw new Error("El inicio del periodo de cuotas no es válido.");
  return { ...stored, members, requests, ordinaryFees, billingStartMonth };
}

export function validateRequestInput(title: string, content: string): void {
  if (!title.trim()) throw new Error("Ingresa el título de la solicitud.");
  if (title.trim().length > 120)
    throw new Error("El título no puede superar los 120 caracteres.");
  if (!content.trim()) throw new Error("Escribe el detalle de la solicitud.");
  if (content.trim().length > 5000)
    throw new Error("El detalle no puede superar los 5000 caracteres.");
}

export function isRequestStatus(value: string): value is RequestStatus {
  return ["enviada", "en_revision", "derivada", "resuelta"].includes(value);
}

export function validateRequestStatus(status: string): asserts status is RequestStatus {
  if (!isRequestStatus(status))
    throw new Error("Selecciona un estado de solicitud válido.");
}

export function todayDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function nextMonth(value: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    throw new Error("Indica un mes válido.");
  const [year, month] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dateInMonth(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function memberHasCoverageOn(member: Member, date: string): boolean {
  let covered = member.joinedAt <= date;
  for (const event of [...member.membershipHistory].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    if (event.date > date) break;
    covered = event.type === "reingreso";
  }
  if (member.status === "retirado" && member.retiredAt <= date) covered = false;
  if (member.rejoinedAt && member.rejoinedAt > date) covered = false;
  return covered;
}

function memberCoverageDateInMonth(
  member: Member,
  month: string,
): string | null {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = dateInMonth(month, 1);
  const monthEnd = dateInMonth(
    month,
    new Date(Date.UTC(year, monthNumber, 0)).getUTCDate(),
  );
  const dates = [
    monthStart,
    monthEnd,
    member.joinedAt,
    ...member.membershipHistory.map((event) => event.date),
  ]
    .filter((date) => date >= monthStart && date <= monthEnd)
    .toSorted();
  return dates.toReversed().find((date) => memberHasCoverageOn(member, date)) ?? null;
}

function memberCategoryOn(member: Member, date: string): Category {
  let category = member.category;
  const history = [
    ...member.membershipHistory,
    ...(member.categoryHistory ?? []),
  ].toSorted((a, b) => a.date.localeCompare(b.date));
  for (const event of history) {
    if (event.date > date) break;
    category = event.category;
  }
  return category;
}

function ordinaryFeeForMonth(rates: OrdinaryFeeRate[], month: string): number {
  const rate = rates
    .filter((item) => item.effectiveMonth <= month)
    .toSorted((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
    .at(-1);
  if (!rate)
    throw new Error(`No hay una cuota ordinaria configurada para ${month}.`);
  return rate.amount;
}

/** Adds any due monthly and extraordinary charges once, without changing old charges. */
export function accrueScheduledDues(
  data: PortalData,
  asOf = todayDate(),
): PortalData {
  const currentMonth = asOf.slice(0, 7);
  const additions: Movement[] = [];
  for (const member of data.members) {
    let month = data.billingStartMonth;
    while (month < currentMonth) {
      const dueDate = dateInMonth(nextMonth(month), 1);
      const coverageDate = memberCoverageDateInMonth(member, month);
      const category = coverageDate
        ? memberCategoryOn(member, coverageDate)
        : "vitalicio";
      if (
        dueDate <= asOf &&
        category !== "vitalicio" &&
        coverageDate !== null
      ) {
        const amount =
          ordinaryFeeForMonth(data.ordinaryFees, month) *
          (category === "postulante" ? 0.5 : 1);
        additions.push({
          id: `fee-ordinary-${member.id}-${month}`,
          date: dueDate,
          description: `Cuota ordinaria · ${month}`,
          memberId: member.id,
          type: "cargo",
          amount,
        });
      }
      month = nextMonth(month);
    }

    for (
      let year = Number(data.billingStartMonth.slice(0, 4));
      year <= Number(currentMonth.slice(0, 4));
      year += 1
    ) {
      for (const [monthNumber, day, label, amount] of [
        ["05", 6, "Mayo", 10],
        ["11", 3, "Noviembre", 20],
      ] as const) {
        const feeMonth = `${year}-${monthNumber}`;
        const dueDate = dateInMonth(feeMonth, day);
        const category = memberCategoryOn(member, dueDate);
        if (
          feeMonth >= data.billingStartMonth &&
          dueDate <= asOf &&
          category !== "vitalicio" &&
          memberHasCoverageOn(member, dueDate)
        )
          additions.push({
            id: `fee-extra-${member.id}-${feeMonth}`,
            date: dueDate,
            description: `Cuota extraordinaria · ${label} ${year}`,
            memberId: member.id,
            type: "cargo",
            amount,
          });
      }
    }

    for (const event of member.membershipHistory) {
      if (
        event.type === "reingreso" &&
        event.date >= dateInMonth(data.billingStartMonth, 1) &&
        event.date <= asOf
      )
        additions.push({
          id: `fee-readmission-${member.id}-${event.date}`,
          date: event.date,
          description: "Cuota de reingreso",
          memberId: member.id,
          type: "cargo",
          amount: 200,
        });
    }
    if (
      member.rejoinedAt &&
      !member.membershipHistory.some(
        (event) => event.type === "reingreso" && event.date === member.rejoinedAt,
      ) &&
      member.rejoinedAt >= dateInMonth(data.billingStartMonth, 1) &&
      member.rejoinedAt <= asOf
    )
      additions.push({
        id: `fee-readmission-${member.id}-${member.rejoinedAt}`,
        date: member.rejoinedAt,
        description: "Cuota de reingreso",
        memberId: member.id,
        type: "cargo",
        amount: 200,
      });
  }
  const existingIds = new Set(data.movements.map((movement) => movement.id));
  const newMovements = additions.filter(
    (movement) => !existingIds.has(movement.id),
  );
  return newMovements.length
    ? { ...data, movements: [...data.movements, ...newMovements] }
    : data;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function ageOnDate(
  birthDate: string,
  asOf = todayDate(),
): number | null {
  if (!validDate(birthDate) || !validDate(asOf) || birthDate > asOf)
    return null;
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, day] = asOf.split("-").map(Number);
  return (
    year -
    birthYear -
    (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0)
  );
}

export function isVitalicioEligible(
  member: Pick<MemberDraft, "birthDate" | "swornAt">,
  asOf = todayDate(),
): boolean {
  return (
    (ageOnDate(member.birthDate, asOf) ?? -1) >= 65 ||
    (ageOnDate(member.swornAt, asOf) ?? -1) >= 30
  );
}

export function emptyMemberDraft(): MemberDraft {
  return {
    fullName: "",
    dni: "",
    birthDate: "",
    address: "",
    phone: "",
    email: "",
    occupation: "",
    maritalStatus: "",
    joinedAt: todayDate(),
    swornAt: "",
    category: "postulante",
    sacraments: [],
    photo: "",
    guardian: null,
  };
}

export function validateMember(
  draft: MemberDraft,
  members: Member[] = [],
  excludeId?: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const today = todayDate();
  if (draft.fullName.trim().length < 3)
    errors.fullName = "Ingresa los nombres y apellidos.";
  if (!/^\d{8}$/.test(draft.dni.trim()))
    errors.dni = "El DNI debe tener 8 dígitos.";
  else {
    const duplicate = members.find(
      (member) => member.id !== excludeId && member.dni === draft.dni.trim(),
    );
    if (duplicate)
      errors.dni =
        duplicate.status === "retirado"
          ? "Este hermano está retirado. Registra su reingreso desde el listado de retirados para conservar su ficha y cuenta."
          : "Ya existe un hermano con este DNI.";
  }
  const age = ageOnDate(draft.birthDate);
  if (age === null)
    errors.birthDate = "Ingresa una fecha de nacimiento válida, no futura.";
  if (!validDate(draft.joinedAt) || draft.joinedAt > today)
    errors.joinedAt = "Ingresa una fecha de ingreso válida, no futura.";
  else if (validDate(draft.birthDate) && draft.joinedAt < draft.birthDate)
    errors.joinedAt = "El ingreso no puede ser anterior al nacimiento.";
  if (
    draft.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())
  )
    errors.email = "Ingresa un correo válido o deja el campo vacío.";
  else if (
    draft.email.trim() &&
    members.some(
      (member) =>
        member.id !== excludeId &&
        member.email.toLowerCase() === draft.email.trim().toLowerCase(),
    )
  )
    errors.email = "Este correo ya está asociado a otro hermano.";
  if (!(draft.category in categoryLabels))
    errors.category = "Selecciona una categoría válida.";
  if (draft.swornAt) {
    if (!validDate(draft.swornAt) || draft.swornAt > today)
      errors.swornAt = "La juramentación debe ser una fecha válida, no futura.";
    else if (validDate(draft.joinedAt) && draft.swornAt < draft.joinedAt)
      errors.swornAt = "La juramentación no puede ser anterior al ingreso.";
  }
  if (draft.category !== "postulante" && (age === null || age < 18))
    errors.category = "Los menores de 18 años solo pueden ser postulantes.";
  if (
    (draft.category === "activo" || draft.category === "vitalicio") &&
    !draft.swornAt
  )
    errors.swornAt = "Registra la fecha de juramentación para esta categoría.";
  if (draft.category === "vitalicio" && !isVitalicioEligible(draft))
    errors.category =
      "Para ser vitalicio debe cumplir 65 años de edad o 30 años desde su juramentación.";
  if (age !== null && age < 18) {
    const guardian = draft.guardian;
    if (!guardian?.fullName.trim())
      errors["guardian.fullName"] = "Ingresa el nombre del apoderado.";
    if (!guardian || !/^\d{8}$/.test(guardian.dni.trim()))
      errors["guardian.dni"] = "El DNI del apoderado debe tener 8 dígitos.";
    if (!guardian?.phone.trim())
      errors["guardian.phone"] =
        "Ingresa un celular de contacto del apoderado.";
    if (!guardian?.relationship.trim())
      errors["guardian.relationship"] = "Indica el parentesco con el menor.";
    if (
      guardian?.age &&
      (!/^\d{1,3}$/.test(guardian.age) || Number(guardian.age) < 0)
    )
      errors["guardian.age"] = "Ingresa una edad válida.";
  }
  return errors;
}

export function assertRole(
  actor: Member | null,
  roles: Role[],
): asserts actor is Member {
  if (!actor || !canAccessPortal(actor) || !roles.includes(actor.role))
    throw new Error("Tu perfil no tiene permiso para realizar esta acción.");
}

export function assertValidMember(
  draft: MemberDraft,
  members: Member[],
  excludeId?: string,
): void {
  const errors = validateMember(draft, members, excludeId);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
}

export function normalizeDraft(draft: MemberDraft): MemberDraft {
  return {
    ...draft,
    fullName: draft.fullName.trim(),
    dni: draft.dni.trim(),
    email: draft.email.trim().toLowerCase(),
    guardian: draft.guardian
      ? {
          ...draft.guardian,
          fullName: draft.guardian.fullName.trim(),
          dni: draft.guardian.dni.trim(),
        }
      : null,
  };
}

function usernamePart(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function uniqueUsername(
  nameParts: MemberNameParts,
  members: Member[],
): string {
  const firstName = usernamePart(nameParts.givenNames.split(/\s+/)[0] ?? "");
  const firstSurname = usernamePart(nameParts.firstSurname);
  if (!firstName || !firstSurname)
    throw new Error("Ingresa el primer nombre y el primer apellido para crear el usuario.");
  const base = `${firstName}.${firstSurname}`;
  const occupied = new Set(
    members.map((member) => member.username.toLocaleLowerCase("es")),
  );
  if (!occupied.has(base.toLocaleLowerCase("es"))) return base;

  const secondSurname = usernamePart(nameParts.secondSurname);
  const disambiguated = secondSurname ? `${base}.${secondSurname}` : "";
  if (disambiguated && !occupied.has(disambiguated.toLocaleLowerCase("es")))
    return disambiguated;

  let suffix = 2;
  let candidate = `${disambiguated || base}.${suffix}`;
  while (occupied.has(candidate.toLocaleLowerCase("es")))
    candidate = `${disambiguated || base}.${++suffix}`;
  return candidate;
}

export function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return `Hc!${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

export async function hashPassword(
  password: string,
  existing?: string,
): Promise<string> {
  const salt =
    existing?.split(":")[1] ??
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  const digest = Array.from(new Uint8Array(bits), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `v1:${salt}:${digest}`;
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if (!/^v1:[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash)) return false;
  return (await hashPassword(password, hash)) === hash;
}

export function updatedMember(
  actor: Member | null,
  member: Member,
  patch: Partial<MemberDraft> & { role?: Role },
  members: Member[],
): Member {
  assertRole(actor, ["secretaria"]);
  const next = {
    ...member,
    ...patch,
    id: member.id,
    username: member.username,
    passwordHash: member.passwordHash,
    status: member.status,
    retiredAt: member.retiredAt,
    rejoinedAt: member.rejoinedAt,
    membershipHistory: member.membershipHistory,
    categoryHistory: member.categoryHistory ?? [],
  };
  if (!(next.role in roleLabels))
    throw new Error("Selecciona un perfil válido.");
  if (isTrialCategory(next.category)) {
    if (patch.role && patch.role !== "estandar")
      throw new Error(
        "Un postulante o reingresante solo puede tener el perfil Estándar.",
      );
    next.role = "estandar";
  }
  assertValidMember(next, members, member.id);
  if (
    next.status === "vigente" &&
    next.category === "reingresante" &&
    member.category !== "reingresante"
  ) {
    next.rejoinedAt = todayDate();
    next.membershipHistory = [
      ...member.membershipHistory,
      { type: "reingreso", date: next.rejoinedAt, category: "reingresante" },
    ];
  }
  const categoryHistory = [...(member.categoryHistory ?? [])];
  if (next.category !== member.category)
    categoryHistory.push({ date: todayDate(), category: next.category });
  return { ...next, categoryHistory, ...normalizeDraft(next) };
}

export function retiredMember(
  actor: Member | null,
  member: Member,
  date = todayDate(),
): Member {
  assertRole(actor, ["secretaria"]);
  if (member.status === "retirado")
    throw new Error("El hermano ya está retirado.");
  if (!validDate(date) || date > todayDate() || date < member.joinedAt)
    throw new Error(
      "La fecha de retiro debe ser válida y posterior al ingreso.",
    );
  return {
    ...member,
    status: "retirado",
    retiredAt: date,
    membershipHistory: [
      ...member.membershipHistory,
      { type: "retiro", date, category: member.category },
    ],
  };
}

export function readmittedMember(
  actor: Member | null,
  member: Member,
  date = todayDate(),
): Member {
  assertRole(actor, ["secretaria"]);
  if (member.status !== "retirado")
    throw new Error(
      "Solo se puede registrar el reingreso de un hermano retirado.",
    );
  if (!validDate(date) || date > todayDate() || date < member.retiredAt)
    throw new Error(
      "La fecha de reingreso debe ser válida y posterior al retiro.",
    );
  const age = ageOnDate(member.birthDate, date);
  if (age === null)
    throw new Error(
      "Corrige la fecha de nacimiento antes de registrar el reingreso.",
    );
  const category: Category = age < 18 ? "postulante" : "reingresante";
  return {
    ...member,
    status: "vigente",
    category,
    role: "estandar",
    rejoinedAt: date,
    membershipHistory: [
      ...member.membershipHistory,
      { type: "reingreso", date, category },
    ],
  };
}

const selfEditable = [
  "fullName",
  "address",
  "phone",
  "email",
  "occupation",
  "maritalStatus",
  "sacraments",
  "photo",
] as const;
export function ownProfilePatch(
  actor: Member | null,
  patch: Partial<MemberDraft>,
  members: Member[],
): Member {
  if (!actor || !canAccessPortal(actor))
    throw new Error("Inicia sesión para actualizar tu información.");
  const next = { ...actor };
  for (const key of selfEditable) {
    if (patch[key] !== undefined) Object.assign(next, { [key]: patch[key] });
  }
  assertValidMember(next, members, actor.id);
  return normalizeDraft(next) as Member;
}

export function validateMovement(
  actor: Member | null,
  input: Omit<Movement, "id">,
  members: Member[],
): void {
  assertRole(actor, ["tesoreria"]);
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    throw new Error("El importe debe ser mayor que cero.");
  if (!input.description.trim())
    throw new Error("Indica el concepto del movimiento.");
  if (!["ingreso", "egreso", "cargo", "pago"].includes(input.type))
    throw new Error("Selecciona un tipo de movimiento válido.");
  if (!validDate(input.date) || input.date > todayDate())
    throw new Error("Ingresa una fecha válida, no futura.");
  if (
    (input.type === "cargo" || input.type === "pago") &&
    !members.some((member) => member.id === input.memberId)
  )
    throw new Error("Selecciona el hermano asociado al movimiento.");
}

export async function createSeedData(): Promise<PortalData> {
  const base = emptyMemberDraft();
  const profiles: Array<
    Partial<Member> &
      Pick<Member, "id" | "fullName" | "dni" | "username" | "role">
  > = [
    {
      id: "demo-secretaria",
      fullName: "María Torres Salazar",
      dni: "10000001",
      username: "secretaria",
      role: "secretaria",
    },
    {
      id: "demo-tesoreria",
      fullName: "José Luis Ramos",
      dni: "10000002",
      username: "tesoreria",
      role: "tesoreria",
    },
    {
      id: "demo-presidencia",
      fullName: "Carlos Mendoza Ríos",
      dni: "10000003",
      username: "presidencia",
      role: "presidencia",
    },
    {
      id: "demo-hermano",
      fullName: "Luis Antonio Pérez",
      dni: "10000004",
      username: "hermano",
      role: "estandar",
    },
    {
      id: "demo-postulante",
      fullName: "Ana Lucía Castillo",
      dni: "10000005",
      username: "postulante",
      role: "estandar",
      birthDate: "2000-05-12",
      joinedAt: "2026-01-10",
      swornAt: "",
      category: "postulante",
    },
    {
      id: "demo-menor",
      fullName: "Diego Romero Díaz",
      dni: "10000006",
      username: "menor",
      role: "estandar",
      birthDate: "2012-04-18",
      joinedAt: "2026-01-10",
      swornAt: "",
      category: "postulante",
      guardian: {
        fullName: "Patricia Díaz",
        dni: "20000001",
        age: "42",
        education: "Superior",
        address: "Santa María",
        phone: "900000006",
        relationship: "Madre",
        sacraments: ["Bautizo"],
      },
    },
    {
      id: "demo-vitalicio",
      fullName: "Pedro García Soto",
      dni: "10000007",
      username: "vitalicio",
      role: "estandar",
      birthDate: "1955-08-20",
      joinedAt: "1988-03-12",
      swornAt: "1989-11-03",
      category: "vitalicio",
    },
    {
      id: "demo-retirado",
      fullName: "Raúl Sánchez Flores",
      dni: "10000008",
      username: "retirado",
      role: "estandar",
      status: "retirado",
      retiredAt: "2026-09-15",
      membershipHistory: [
        { type: "retiro", date: "2026-09-15", category: "activo" },
      ],
    },
    {
      id: "demo-reingresante",
      fullName: "Rosa Elena Vargas",
      dni: "10000009",
      username: "reingresante",
      role: "estandar",
      category: "reingresante",
      retiredAt: "2025-03-01",
      rejoinedAt: "2026-08-01",
      membershipHistory: [
        { type: "retiro", date: "2025-03-01", category: "activo" },
        { type: "reingreso", date: "2026-08-01", category: "reingresante" },
      ],
    },
  ];
  const members = await Promise.all(
    profiles.map(async (profile): Promise<Member> => ({
      ...base,
      status: "vigente",
      retiredAt: "",
      rejoinedAt: "",
      membershipHistory: [],
      birthDate: "1986-05-20",
      address: "Santa María, Huacho",
      phone: "900000000",
      occupation: "Independiente",
      joinedAt: "2010-01-15",
      swornAt: "2011-11-03",
      category: "activo",
      sacraments: ["Bautizo", "Primera comunión"],
      ...profile,
      passwordHash: await hashPassword("Demo2026!"),
    })),
  );
  const movements: Movement[] = members.flatMap((member, index) => [
    {
      id: `cargo-${member.id}`,
      date: "2026-10-01",
      description: "Cuota institucional · octubre",
      memberId: member.id,
      type: "cargo",
      amount: 30,
    },
    ...(index % 3 !== 1
      ? [
          {
            id: `pago-${member.id}`,
            date: "2026-10-15",
            description: "Pago de cuota · octubre",
            memberId: member.id,
            type: "pago" as const,
            amount: 30,
          },
        ]
      : []),
  ]);
  movements.push({
    id: "ingreso-inicial",
    date: "2026-10-20",
    description: "Colecta institucional",
    memberId: "",
    type: "ingreso",
    amount: 250,
  });
  return {
  version: 1,
  members,
  movements,
  requests: [],
  ordinaryFees: [{ effectiveMonth: todayDate().slice(0, 7), amount: 10 }],
  billingStartMonth: todayDate().slice(0, 7),
  };
}
