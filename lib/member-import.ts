import type { MemberRecord } from "./firebase/models";
import { ageOnDate, todayDate, type Category } from "./portal.ts";
import { normalizeRosterSearch } from "./roster-index.ts";

export type RosterImportSourceRow = {
  rowNumber: number;
  values: unknown[];
};

export type RosterImportCell = { raw: unknown; display: string };

export type RosterImportRow = {
  sourceSheet: string;
  rowNumber: number;
  member: Omit<MemberRecord, "rosterIndex">;
  identityKey: string;
  tenure: string;
  errors: string[];
  warnings: string[];
};

function cellValue(value: unknown): unknown {
  if (value && typeof value === "object" && "raw" in value && "display" in value)
    return (value as RosterImportCell).raw;
  return value;
}

function displayValue(value: unknown): string {
  if (value && typeof value === "object" && "raw" in value && "display" in value)
    return String((value as RosterImportCell).display ?? "").trim();
  return "";
}

function text(value: unknown): string {
  const raw = cellValue(value);
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number") {
    const display = displayValue(value);
    return display && !/[eE][+-]?\d+/.test(display) ? display : String(raw);
  }
  if (typeof raw === "object") {
    if ("text" in raw && typeof raw.text === "string") return raw.text.trim();
    if ("result" in raw) return text(raw.result);
    if ("richText" in raw && Array.isArray(raw.richText))
      return raw.richText.map((item) => item && typeof item === "object" && "text" in item ? String(item.text) : "").join("").trim();
    return displayValue(value);
  }
  return String(raw).trim();
}

function rawDateValue(value: unknown): unknown {
  return cellValue(value);
}

function dateValue(value: unknown): string | null {
  const rawDate = rawDateValue(value);
  if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime()))
    return rawDate.toISOString().slice(0, 10);
  if (rawDate && typeof rawDate === "object" && "result" in rawDate)
    return dateValue(rawDate.result);

  if (typeof rawDate === "number" && Number.isFinite(rawDate) && rawDate >= 1) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(rawDate) * 86_400_000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const raw = text(value);
  if (!raw) return "";
  if (raw === "-") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw ? raw : null;
  }

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  const day = first > 12 || second <= 12 ? first : second;
  const month = first > 12 || second <= 12 ? second : first;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

function normalized(value: unknown): string {
  return normalizeRosterSearch(text(value)).replace(/[^a-z0-9]/g, "");
}

function categoryValue(value: unknown): Category | null {
  const category = normalized(value);
  if (category === "activo" || category === "activonoresidenteenhuacho") return "activo";
  if (category === "vitalicio" || category === "pasivo")
    return category === "pasivo" ? "vitalicio" : category;
  if (category === "postulante" || category === "aspirante") return "postulante";
  if (category === "reingresante") return category;
  return null;
}

function sexValue(value: unknown): MemberRecord["sex"] {
  const sex = normalized(value);
  if (["varon", "hombre", "masculino", "m", "v"].includes(sex)) return "varon";
  if (["dama", "mujer", "femenino", "f", "d"].includes(sex)) return "dama";
  return null;
}

function booleanValue(value: unknown, blankAsFalse = false): boolean | null | undefined {
  const raw = text(value).toLocaleLowerCase("es").trim();
  if (!raw || raw === "-") return blankAsFalse ? false : null;
  if (["✓", "✔"].includes(raw)) return true;
  const flag = normalized(value);
  if (["si", "s", "true", "verdadero", "yes", "1", "x", "madre", "padre"].includes(flag)) return true;
  if (["no", "n", "false", "falso", "0"].includes(flag)) return false;
  return undefined;
}

function dniValue(value: unknown): string {
  const rawValue = cellValue(value);
  if (typeof rawValue === "number" && Number.isInteger(rawValue) && rawValue >= 0 && rawValue <= 99_999_999)
    return String(rawValue).padStart(8, "0");
  const raw = text(value).replace(/\s/g, "");
  if (!raw) return "";
  if (!/^\d{1,8}$/.test(raw)) return raw;
  return raw.padStart(8, "0");
}

function tenureFrom(swornAt: string, today: string, category: Category): string {
  if (!swornAt) return category === "postulante" ? "Aún no juramentó" : "Revisar: posible postulante/aspirante";
  if (swornAt > today) return "Fecha futura";

  const [startYear, startMonth, startDay] = swornAt.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  let months = (todayYear - startYear) * 12 + todayMonth - startMonth;
  if (todayDay < startDay) months -= 1;
  if (months < 0) return "Menos de un mes";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const yearText = years ? `${years} ${years === 1 ? "año" : "años"}` : "";
  const monthText = remainingMonths ? `${remainingMonths} ${remainingMonths === 1 ? "mes" : "meses"}` : "";
  return [yearText, monthText].filter(Boolean).join(", ") || "Menos de un mes";
}

function emptyMember(): Omit<MemberRecord, "rosterIndex"> {
  return {
    fullName: "",
    dni: "",
    birthDate: "",
    sex: null,
    hasChildren: null,
    nonResidentHuacho: false,
    address: "",
    phone: "",
    email: "",
    occupation: "",
    maritalStatus: "",
    joinedAt: "",
    swornAt: "",
    category: "postulante",
    status: "vigente",
    sacraments: [],
    photoUrl: null,
    guardian: null,
    retiredAt: "",
    rejoinedAt: "",
    createdAt: "",
    updatedAt: "",
  };
}

export function rosterImportIdentityKey(fullName: string, birthDate: string): string {
  return `${normalizeRosterSearch(fullName).replace(/\s+/g, " ").trim()}|${birthDate}`;
}

export function markRosterImportDuplicates(rows: RosterImportRow[]): void {
  const seen = new Map<string, RosterImportRow>();
  for (const row of rows) {
    const prior = (row.member.dni ? seen.get(`dni:${row.member.dni}`) : undefined)
      ?? seen.get(`identity:${row.identityKey}`);
    if (prior) {
      const sameDni = Boolean(row.member.dni && row.member.dni === prior.member.dni);
      const describe = (other: RosterImportRow) => sameDni
        ? `DNI duplicado con ${other.sourceSheet}, fila ${other.rowNumber}.`
        : `Posible duplicado en ${other.sourceSheet}, fila ${other.rowNumber}; sin DNI coincidente no se puede distinguir automáticamente.`;
      const message = describe(prior);
      const priorMessage = describe(row);
      row.errors.push(message);
      prior.errors.push(priorMessage);
    } else {
      seen.set(`identity:${row.identityKey}`, row);
      if (row.member.dni) seen.set(`dni:${row.member.dni}`, row);
    }
  }
}

export function parseRosterImportRows(
  sourceRows: RosterImportSourceRow[],
  today = todayDate(),
  sourceSheet = "Hoja 1",
  detectDuplicates = true,
): RosterImportRow[] {
  const header = sourceRows.find((row) =>
    row.values.some((value) => ["apellidosynombres", "apelllidosynombres"].includes(normalized(value))),
  );
  if (!header) throw new Error("No se encontró la fila de encabezados «APELLIDOS Y NOMBRES».");

  const headers = header.values.map(normalized);
  const find = (...names: string[]) => headers.findIndex((value) => names.includes(value));
  const nameIndex = find("apellidosynombres", "apelllidosynombres", "nombresyapellidos");
  const categoryIndex = find("estatus", "categoria");
  const birthIndex = find("fechanacimiento", "nacimiento");
  const sexIndex = find("genero", "sexo");
  const parentIndex = find("madre", "padre", "tienehijos", "tienehijas");
  const joinedIndex = find("fechadeingreso", "fechaingreso");
  const swornIndex = find("fechadejuramentacion", "fechajuramentacion");
  const guardianIndex = find("apoderado", "apoderadoa");
  const memberDniIndex = find("dnihermano", "dnidelhermano", "deldnihermano");
  const phoneIndex = headers.findIndex((value, index) => value === "telefono" && (guardianIndex < 0 || index < guardianIndex));
  const guardianPhoneIndex = guardianIndex < 0 ? -1 : headers.findIndex((value, index) => value === "telefono" && index > guardianIndex);
  const addressIndex = headers.findIndex((value, index) => value === "direccion" && (guardianIndex < 0 || index < guardianIndex));
  const guardianAddressIndex = guardianIndex < 0 ? -1 : headers.findIndex((value, index) => value === "direccion" && index > guardianIndex);
  const guardianDniIndex = guardianIndex < 0 ? -1 : headers.findIndex((value, index) =>
    index > guardianIndex && ["dni", "dniapoderado", "dnidelapoderado"].includes(value),
  );
  const guardianNameIndex = guardianIndex;
  const baptismIndex = find("bautizo", "bautismo");
  const communionIndex = find("primeracomunion");
  const confirmationIndex = find("confirmacion");
  const marriageIndex = find("matrimonio");
  const maritalStatusIndex = find("estadocivil");
  const occupationIndex = find("profesionocupacion", "profesion", "ocupacion");

  const requiredHeaders: Array<[number, string]> = [
    [nameIndex, "APELLIDOS Y NOMBRES"],
    [categoryIndex, "ESTATUS"],
    [birthIndex, "FECHA NACIMIENTO"],
    [joinedIndex, "FECHA DE INGRESO"],
    [swornIndex, "FECHA DE JURAMENTACIÓN"],
  ];
  const missingHeaders = requiredHeaders.filter(([index]) => index < 0).map(([, label]) => label);
  if (missingHeaders.length) throw new Error(`Faltan encabezados requeridos: ${missingHeaders.join(", ")}.`);

  const parsedRows: RosterImportRow[] = [];
  for (const source of sourceRows) {
    if (source.rowNumber <= header.rowNumber || source.values.every((value) => !text(value))) continue;
    const valueAt = (index: number) => index < 0 ? "" : source.values[index] ?? "";
    const rowErrors: string[] = [];
    const warnings: string[] = [];
    const member = emptyMember();
    member.fullName = text(valueAt(nameIndex)).replace(/\s+/g, " ").trim();
    member.dni = dniValue(valueAt(memberDniIndex));
    member.birthDate = dateValue(valueAt(birthIndex)) ?? "";
    member.joinedAt = dateValue(valueAt(joinedIndex)) ?? "";
    member.swornAt = dateValue(valueAt(swornIndex)) ?? "";
    const rawCategory = valueAt(categoryIndex);
    member.category = categoryValue(rawCategory) ?? "postulante";
    member.nonResidentHuacho = normalized(rawCategory) === "activonoresidenteenhuacho";
    member.sex = sexValue(valueAt(sexIndex));
    member.address = text(valueAt(addressIndex));
    member.phone = text(valueAt(phoneIndex));
    member.maritalStatus = text(valueAt(maritalStatusIndex));
    member.occupation = text(valueAt(occupationIndex));

    if (!member.fullName || member.fullName.length < 5 || member.fullName.length > 160)
      rowErrors.push("El nombre completo debe tener entre 5 y 160 caracteres.");
    if (member.dni && !/^\d{8}$/.test(member.dni))
      rowErrors.push("El DNI del hermano debe tener ocho dígitos.");

    for (const [label, raw, parsed] of [
      ["nacimiento", valueAt(birthIndex), member.birthDate],
      ["ingreso", valueAt(joinedIndex), member.joinedAt],
      ["juramentación", valueAt(swornIndex), member.swornAt],
    ] as const) {
      if (text(raw) && text(raw) !== "-" && !parsed) rowErrors.push(`La fecha de ${label} no es válida.`);
      if (parsed && parsed > today) rowErrors.push(`La fecha de ${label} no puede ser futura.`);
    }
    if (!member.birthDate) rowErrors.push("Falta la fecha de nacimiento.");
    if (!member.joinedAt) rowErrors.push("Falta la fecha de ingreso.");
    if (member.birthDate && member.joinedAt && member.joinedAt < member.birthDate)
      rowErrors.push("La fecha de ingreso es anterior al nacimiento.");
    if (member.swornAt && member.joinedAt && member.swornAt < member.joinedAt)
      rowErrors.push("La juramentación es anterior a la fecha de ingreso.");
    if (!categoryValue(valueAt(categoryIndex)))
      rowErrors.push("El estatus debe ser Activo, Pasivo/Vitalicio, Postulante o Reingresante.");

    const rawSex = text(valueAt(sexIndex));
    if (rawSex && !member.sex) rowErrors.push("El género debe ser Varón o Dama.");
    const rawParent = valueAt(parentIndex);
    const parentValue = booleanValue(rawParent, true);
    if (parentValue === undefined) rowErrors.push("El valor de MADRE debe indicar sí o no.");
    else member.hasChildren = parentValue;
    if (!member.sex && normalized(rawParent) === "madre") member.sex = "dama";
    if (!member.sex && normalized(rawParent) === "padre") member.sex = "varon";

    const sacraments: Array<[number, string]> = [
      [baptismIndex, "Bautismo"],
      [communionIndex, "Primera Comunión"],
      [confirmationIndex, "Confirmación"],
      [marriageIndex, "Matrimonio"],
    ];
    for (const [index, label] of sacraments) {
      const raw = valueAt(index);
      if (!text(raw)) continue;
      const received = booleanValue(raw);
      if (received === undefined) rowErrors.push(`El sacramento «${label}» debe indicar sí o no.`);
      else if (received) member.sacraments.push(label);
    }

    const guardianName = text(valueAt(guardianNameIndex));
    const guardianDni = dniValue(valueAt(guardianDniIndex));
    const guardianAddress = text(valueAt(guardianAddressIndex));
    const guardianPhone = text(valueAt(guardianPhoneIndex));
    const hasGuardianData = [guardianName, guardianDni, guardianAddress, guardianPhone].some(Boolean);
    if (hasGuardianData && !guardianName)
      rowErrors.push("Hay datos de apoderado, pero falta su nombre.");
    else if (guardianName) {
      if (guardianName.length < 3 || guardianName.length > 160)
        rowErrors.push("El nombre del apoderado debe tener entre 3 y 160 caracteres.");
      if (guardianDni && !/^\d{8}$/.test(guardianDni))
        rowErrors.push("El DNI del apoderado debe tener ocho dígitos.");
      member.guardian = {
        fullName: guardianName,
        dni: guardianDni,
        education: "",
        address: guardianAddress,
        phone: guardianPhone,
        relationship: "",
        age: "",
        sacraments: [],
      };
    }

    if (member.address.length > 300) rowErrors.push("La dirección supera los 300 caracteres.");
    if (member.phone.length > 30) rowErrors.push("El teléfono supera los 30 caracteres.");
    if (member.occupation.length > 150) rowErrors.push("La profesión u ocupación supera los 150 caracteres.");
    if (member.maritalStatus.length > 80) rowErrors.push("El estado civil supera los 80 caracteres.");
    if (member.guardian?.address.length && member.guardian.address.length > 300)
      rowErrors.push("La dirección del apoderado supera los 300 caracteres.");
    if (member.guardian?.phone.length && member.guardian.phone.length > 30)
      rowErrors.push("El teléfono del apoderado supera los 30 caracteres.");

    if (member.sex === null) warnings.push("Género sin especificar.");
    const age = ageOnDate(member.birthDate, today);
    if (age !== null && age < 18 && !member.guardian)
      warnings.push("Menor de edad sin datos de apoderado.");
    if (!member.swornAt && member.category !== "postulante")
      warnings.push("Sin fecha de juramentación; podría ser Postulante/Aspirante. Revisa la categoría.");
    const identityKey = rosterImportIdentityKey(member.fullName, member.birthDate);
    parsedRows.push({
      sourceSheet,
      rowNumber: source.rowNumber,
      member,
      identityKey,
      tenure: tenureFrom(member.swornAt, today, member.category),
      errors: rowErrors,
      warnings,
    });
  }

  if (detectDuplicates) markRosterImportDuplicates(parsedRows);

  return parsedRows;
}
