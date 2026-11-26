import { ageOnDate, todayDate } from "./portal.ts";
import { rosterSacraments, hasSacrament, type RosterFilters, type RosterMember } from "./member-roster.ts";

export function normalizeRosterSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function facet(parts: string[]): string {
  return parts.length ? parts.join("|") : "*";
}

export function rosterFilterKey(filters: RosterFilters): string | null {
  const parentSex = filters.parent === "padre" ? "varon" : filters.parent === "madre" ? "dama" : "";
  if (parentSex && filters.sex && parentSex !== filters.sex) return null;
  return facet([
    filters.sex && `s:${filters.sex}`,
    filters.parent && `p:${filters.parent}`,
    filters.category && `c:${filters.category}`,
    filters.birthMonth && `m:${filters.birthMonth}`,
    filters.sacrament && `r:${normalizeRosterSearch(filters.sacrament)}`,
  ].filter(Boolean) as string[]);
}

export function makeRosterIndex(member: Omit<RosterMember, "dni" | "birthDate"> & {dni?: string; birthDate?: string}) {
  const rawBirthDate = member.birthDate ?? "";
  const birthDate = ageOnDate(rawBirthDate, "9999-12-31") === null ? "" : rawBirthDate;
  const choices = [
    member.sex ? `s:${member.sex}` : "",
    member.hasChildren === true && member.sex ? `p:${member.sex === "varon" ? "padre" : "madre"}` : "",
    `c:${member.category}`,
    birthDate ? `m:${birthDate.slice(5, 7)}` : "",
  ].filter(Boolean);
  const sacraments = rosterSacraments
    .filter((name) => hasSacrament(member.sacraments ?? [], name))
    .map((name) => `r:${normalizeRosterSearch(name)}`);
  const facets: string[] = [];
  for (let mask = 0; mask < 2 ** choices.length; mask++) {
    const parts = choices.filter((_, index) => mask & (1 << index));
    facets.push(facet(parts));
    for (const sacrament of sacraments) facets.push(facet([...parts, sacrament]));
  }
  return { name: normalizeRosterSearch(member.fullName), dni: member.dni ?? "", birthDate, facets };
}

export function rosterDateBounds(filters: RosterFilters, asOf = todayDate()) {
  if (!filters.ageGroup && !filters.birthMonth) return null;
  const cutoff = `${String(Number(asOf.slice(0, 4)) - 18).padStart(4, "0")}${asOf.slice(4)}`;
  if (filters.ageGroup === "mayores") return { min: "0000-01-01", max: cutoff, minExclusive: false };
  if (filters.ageGroup === "menores") return { min: cutoff, max: asOf, minExclusive: true };
  return { min: "0000-01-01", max: asOf, minExclusive: false };
}
