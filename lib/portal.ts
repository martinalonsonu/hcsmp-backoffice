/** Front-only demo domain. Replace this adapter with a backend before real use. */
export type Category = "postulante" | "activo" | "vitalicio";
export type Role = "estandar" | "tesoreria" | "secretaria" | "presidencia";
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
};
export type Movement = {
  id: string;
  date: string;
  description: string;
  memberId: string;
  type: "ingreso" | "egreso" | "cargo" | "pago";
  amount: number;
};
export type PortalData = {
  version: 1;
  members: Member[];
  movements: Movement[];
};
export const roleLabels: Record<Role, string> = {
  estandar: "Estándar",
  tesoreria: "Tesorería",
  secretaria: "Secretaría",
  presidencia: "Presidencia",
};
export const categoryLabels: Record<Category, string> = {
  postulante: "Postulante",
  activo: "Activo",
  vitalicio: "Vitalicio",
};

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
  else if (
    members.some(
      (member) => member.id !== excludeId && member.dni === draft.dni.trim(),
    )
  )
    errors.dni = "Ya existe un hermano con este DNI.";
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
  if (draft.category !== "postulante") {
    if (age === null || age < 18)
      errors.category =
        "Un hermano activo o vitalicio debe tener al menos 18 años.";
    if (!draft.swornAt)
      errors.swornAt =
        "Registra la fecha de juramentación para esta categoría.";
  }
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
  if (!actor || !roles.includes(actor.role))
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

export function uniqueUsername(
  draft: Pick<MemberDraft, "dni">,
  members: Member[],
): string {
  const base = `h${draft.dni.trim()}`;
  let name = base;
  let suffix = 2;
  while (
    members.some(
      (member) => member.username.toLowerCase() === name.toLowerCase(),
    )
  )
    name = `${base}.${suffix++}`;
  return name;
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
  };
  if (!(next.role in roleLabels))
    throw new Error("Selecciona un perfil válido.");
  if (next.category === "postulante") {
    if (patch.role && patch.role !== "estandar")
      throw new Error("Un postulante solo puede tener el perfil Estándar.");
    next.role = "estandar";
  }
  assertValidMember(next, members, member.id);
  return { ...next, ...normalizeDraft(next) };
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
  if (!actor) throw new Error("Inicia sesión para actualizar tu información.");
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
  ];
  const members = await Promise.all(
    profiles.map(async (profile): Promise<Member> => ({
      ...base,
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
  return { version: 1, members, movements };
}
