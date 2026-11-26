import assert from "node:assert/strict";
import { test } from "node:test";
import { filterRoster, type RosterFilters, type RosterMember } from "./member-roster.ts";
import { makeRosterIndex, normalizeRosterSearch, rosterDateBounds, rosterFilterKey } from "./roster-index.ts";

const member: RosterMember = {
  fullName: "José Pérez", dni: "12345678", birthDate: "2008-11-26", category: "activo",
  status: "vigente", sacraments: ["Bautizo", "Primera comunión", "Confirmación", "Matrimonio"],
  sex: "varon", hasChildren: true,
};
const empty: RosterFilters = { search:"", sex:"", parent:"", ageGroup:"", category:"", birthMonth:"", sacrament:"" };

test("indexed facets preserve every supported combination and unknown values", () => {
  const entries = [
    member, {...member, sex:"dama" as const, hasChildren:true}, {...member, hasChildren:false},
    {...member, sex:null, hasChildren:null, birthDate:""}, {...member, category:"postulante" as const, sacraments:[]},
  ];
  for (const sex of ["", "varon", "dama"] as const)
    for (const parent of ["", "padre", "madre"] as const)
      for (const category of ["", "activo", "postulante"] as const)
        for (const birthMonth of ["", "11", "03"])
          for (const sacrament of ["", "Bautismo", "Primera Comunión", "Confirmación", "Matrimonio"]) {
            const filters = {...empty, sex, parent, category, birthMonth, sacrament};
            const key = rosterFilterKey(filters);
            const indexed = entries.filter((entry) => key !== null && makeRosterIndex(entry).facets.includes(key));
            assert.deepEqual(indexed, filterRoster(entries, filters, "2026-11-26"));
          }
  assert.equal(makeRosterIndex(member).facets.length, 80);
  assert.equal(normalizeRosterSearch("  JOSÉ "), "jose");
});

test("date bounds match age at leap days and exclude missing or future dates", () => {
  for (const asOf of ["2026-02-28", "2024-02-29", "2026-11-26"]) {
    for (const ageGroup of ["mayores", "menores"] as const) {
      const filters = {...empty, ageGroup};
      const bounds = rosterDateBounds(filters, asOf)!;
      for (const birthDate of ["", "2008-02-28", "2008-02-29", "2006-02-28", "2008-11-26", "2008-11-27", "2027-01-01"]) {
        const candidate = {...member, birthDate};
        const indexedDate = makeRosterIndex(candidate).birthDate;
        const indexed = (bounds.minExclusive ? indexedDate > bounds.min : indexedDate >= bounds.min) && indexedDate <= bounds.max;
        assert.equal(indexed, filterRoster([candidate], filters, asOf).length === 1, `${asOf} ${ageGroup} ${birthDate}`);
      }
    }
  }
});

test("legacy members without DNI or birth date can be indexed without undefined values", () => {
  const legacy = {fullName:member.fullName, category:member.category, status:member.status, sacraments:member.sacraments};
  const indexed = makeRosterIndex(legacy);
  assert.equal(indexed.dni, "");
  assert.equal(indexed.birthDate, "");
  assert.ok(indexed.facets.includes("*"));
});
