import assert from "node:assert/strict";
import { test } from "node:test";
import { describeRosterFilters, filterRoster, type RosterFilters, type RosterMember } from "./member-roster.ts";

const filters: RosterFilters = { search:"", sex:"", parent:"", ageGroup:"", category:"", birthMonth:"", sacrament:"" };
const person: RosterMember = {
  fullName: "José Pérez", dni: "12345678", birthDate: "2008-11-26",
  category: "activo", status: "vigente", sacraments: ["Bautizo", "Primera comunión"],
  sex: "varon", hasChildren: true,
};

test("combines all filters and matches legacy sacrament spelling", () => {
  const members: RosterMember[] = [
    person,
    {...person, fullName:"Otra persona", sex:"dama"},
    {...person, hasChildren:false},
    {...person, category:"postulante"},
    {...person, birthDate:"2008-11-27"},
    {...person, sacraments:[]},
  ];
  assert.deepEqual(filterRoster(members, {
    search:"jose", sex:"varon", parent:"padre", ageGroup:"mayores",
    category:"activo", birthMonth:"11", sacrament:"Bautismo",
  }, "2026-11-26"), [person]);
  assert.equal(filterRoster([person], {...filters, sacrament:"Primera Comunión"}, "2026-11-26").length, 1);
});

test("parent, sex and age filters do not infer missing data", () => {
  const unknown = {...person, sex:null, hasChildren:null, birthDate:""};
  const mother: RosterMember = {...person, sex:"dama", birthDate:"2010-03-01"};
  const members = [unknown, person, mother];
  assert.deepEqual(filterRoster(members, {...filters, parent:"madre"}, "2026-11-26"), [mother]);
  assert.deepEqual(filterRoster(members, {...filters, parent:"padre"}, "2026-11-26"), [person]);
  assert.deepEqual(filterRoster(members, {...filters, sex:"dama", ageGroup:"menores", birthMonth:"03"}, "2026-11-26"), [mother]);
  assert.deepEqual(filterRoster(members, {...filters, parent:"padre", sex:"dama"}, "2026-11-26"), []);
  assert.equal(filterRoster(members, filters, "2026-11-26").length, 3);
});

test("describeRosterFilters lista solo los filtros con valor y ordena sus etiquetas", () => {
  assert.deepEqual(describeRosterFilters(filters), []);
  assert.deepEqual(describeRosterFilters({...filters, search:"   "}), []);
  assert.deepEqual(describeRosterFilters({
    search:" ana ", sex:"dama", parent:"madre", ageGroup:"menores",
    category:"activo", birthMonth:"03", sacrament:"Bautismo",
  }), [
    { key:"search", label:"Búsqueda: ana" },
    { key:"sex", label:"Dama" },
    { key:"parent", label:"Madres" },
    { key:"ageGroup", label:"Menores de edad" },
    { key:"category", label:"Activo" },
    { key:"birthMonth", label:"Cumpleaños: Marzo" },
    { key:"sacrament", label:"Sacramento: Bautismo" },
  ]);
});
