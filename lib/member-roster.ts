import { ageOnDate, categoryLabels, todayDate, type Category, type MembershipStatus } from "./portal.ts";

export type MemberSex = "varon" | "dama";
export type RosterFilters = {
  search: string;
  sex: MemberSex | "";
  parent: "padre" | "madre" | "";
  ageGroup: "mayores" | "menores" | "";
  category: Category | "";
  birthMonth: string;
  sacrament: string;
};

export const rosterSacraments = ["Bautismo", "Primera Comunión", "Confirmación", "Matrimonio"] as const;
export const birthMonths = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type RosterMember = {
  fullName: string;
  dni: string;
  birthDate: string;
  category: Category;
  status: MembershipStatus;
  sacraments: string[];
  sex?: MemberSex | null;
  hasChildren?: boolean | null;
};

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function sacramentKey(value: string): string {
  const key = normalized(value);
  return key === "bautizo" ? "bautismo" : key;
}

export function hasSacrament(sacraments: string[], sacrament: string): boolean {
  return sacraments.some((value) => sacramentKey(value) === sacramentKey(sacrament));
}

/** Etiquetas legibles de los filtros con valor, en el orden en que se muestran. */
export function describeRosterFilters(filters: RosterFilters): Array<{ key: keyof RosterFilters; label: string }> {
  const chips: Array<{ key: keyof RosterFilters; label: string }> = [];
  const search = filters.search.trim();
  if (search) chips.push({ key: "search", label: `Búsqueda: ${search}` });
  if (filters.sex) chips.push({ key: "sex", label: filters.sex === "varon" ? "Varón" : "Dama" });
  if (filters.parent) chips.push({ key: "parent", label: filters.parent === "padre" ? "Padres" : "Madres" });
  if (filters.ageGroup) chips.push({ key: "ageGroup", label: filters.ageGroup === "mayores" ? "Mayores de edad" : "Menores de edad" });
  if (filters.category) chips.push({ key: "category", label: categoryLabels[filters.category] });
  if (filters.birthMonth) chips.push({ key: "birthMonth", label: `Cumpleaños: ${birthMonths[Number(filters.birthMonth) - 1] ?? filters.birthMonth}` });
  if (filters.sacrament) chips.push({ key: "sacrament", label: `Sacramento: ${filters.sacrament}` });
  return chips;
}

export function filterRoster<T extends RosterMember>(
  members: T[],
  filters: RosterFilters,
  asOf = todayDate(),
): T[] {
  return members.filter((member) => {
    const age = ageOnDate(member.birthDate, asOf);
    return (!filters.search.trim() || normalized(`${member.fullName} ${member.dni}`).includes(normalized(filters.search))) &&
      (!filters.sex || member.sex === filters.sex) &&
      (!filters.parent || (member.hasChildren === true && member.sex === (filters.parent === "padre" ? "varon" : "dama"))) &&
      (!filters.ageGroup || (age !== null && (filters.ageGroup === "mayores" ? age >= 18 : age < 18))) &&
      (!filters.category || member.category === filters.category) &&
      (!filters.birthMonth || (age !== null && member.birthDate.slice(5, 7) === filters.birthMonth)) &&
      (!filters.sacrament || hasSacrament(member.sacraments ?? [], filters.sacrament));
  });
}
