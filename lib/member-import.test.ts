import assert from "node:assert/strict";
import { test } from "node:test";
import { markRosterImportDuplicates, parseRosterImportRows } from "./member-import.ts";

const headers = [
  "APELLLIDOS Y NOMBRES", "ESTATUS", "FECHA NACIMIENTO", "GENERO", "MADRE",
  "FECHA DE INGRESO", "FECHA DE JURAMENTACION", "TIEMPO EN LA HERMANDAD",
  "TIENE FICHA", "TIENE FOTO", "BAUTIZO", "PRIMERA COMUNIÓN", "CONFIRMACION",
  "MATRIMONIO", "ESTADO CIVIL", "PROFESION/OCUPACION", "TELÉFONO", "DIRECCIÓN",
  "APODERADO", "DNI", "DIRECCION", "TELEFONO",
];

test("maps the provided roster headers and calculates tenure from the oath date", () => {
  const [row] = parseRosterImportRows([
    { rowNumber: 1, values: ["HERMANDAD DE CARGADORES SAN MARTIN DE PORRES DAMAS"] },
    { rowNumber: 2, values: headers },
    {
      rowNumber: 3,
      values: [
        "Ana María Pérez", "Activo", "09/05/1990", "Dama", "Sí", "10/01/2010", "03/15/2011",
        "ignored", "Sí", "No", "Sí", "No", "X", "", "Casada", "Docente", "987654321",
        "Lima", "Rosa Pérez", "1234567", "Calle Uno", "912345678",
      ],
    },
  ], "2026-03-10");

  assert.ok(row);
  assert.deepEqual(row.errors, []);
  assert.equal(row.member.fullName, "Ana María Pérez");
  assert.equal(row.member.dni, "");
  assert.equal(row.member.category, "activo");
  assert.equal(row.member.birthDate, "1990-05-09");
  assert.equal(row.member.sex, "dama");
  assert.equal(row.member.hasChildren, true);
  assert.equal(row.member.nonResidentHuacho, false);
  assert.deepEqual(row.member.sacraments, ["Bautismo", "Confirmación"]);
  assert.equal(row.member.maritalStatus, "Casada");
  assert.equal(row.member.occupation, "Docente");
  assert.equal(row.member.phone, "987654321");
  assert.deepEqual(row.member.guardian, {
    fullName: "Rosa Pérez",
    dni: "01234567",
    education: "",
    address: "Calle Uno",
    phone: "912345678",
    relationship: "",
    age: "",
    sacraments: [],
  });
  assert.equal(row.member.status, "vigente");
  assert.equal(row.tenure, "14 años, 11 meses");
});

test("flags unknown category, malformed dates, and repeated name/date rows", () => {
  const row = {
    rowNumber: 2,
    values: [
      "Carlos Pérez", "Retirado", "31/02/1980", "Varón", "No", "01/10/2010", "",
    ],
  };
  const parsed = parseRosterImportRows([
    { rowNumber: 1, values: headers.slice(0, 7) },
    row,
    { ...row, rowNumber: 3 },
  ], "2026-03-10");

  assert.equal(parsed.length, 2);
  assert.ok(parsed[0].errors.some((error) => error.includes("nacimiento no es válida")));
  assert.ok(parsed[0].errors.some((error) => error.includes("estatus")));
  assert.ok(parsed[0].errors.some((error) => error.includes("Posible duplicado en Hoja 1, fila 3")));
  assert.ok(parsed[1].errors.some((error) => error.includes("Posible duplicado en Hoja 1, fila 2")));
});

test("accepts Excel serial dates and treats a blank parent flag as no children without inferring sex", () => {
  const row = parseRosterImportRows([
    { rowNumber: 1, values: headers.slice(0, 7) },
    {
      rowNumber: 2,
      values: ["María López", "Vitalicio", 25569, "Dama", "", 42005, ""],
    },
  ], "2026-03-10")[0];

  assert.ok(row);
  assert.equal(row.member.birthDate, "1970-01-01");
  assert.equal(row.member.hasChildren, false);
  assert.equal(row.member.sex, "dama");
  assert.equal(row.member.category, "vitalicio");
});

test("detects repeated names and birth dates across worksheets", () => {
  const [first] = parseRosterImportRows([
    { rowNumber: 1, values: headers.slice(0, 7) },
    { rowNumber: 2, values: ["María López", "Activo", "01/02/1990", "Dama", "No", "01/10/2010", ""] },
  ], "2026-03-10", "Damas", false);
  const [second] = parseRosterImportRows([
    { rowNumber: 1, values: headers.slice(0, 7) },
    { rowNumber: 2, values: ["Maria Lopez", "Activo", "01/02/1990", "Dama", "No", "01/10/2010", ""] },
  ], "2026-03-10", "Hermanos", false);

  assert.ok(first && second);
  markRosterImportDuplicates([first, second]);
  assert.ok(first.errors.some((error) => error.includes("Hermanos, fila 2")));
  assert.ok(second.errors.some((error) => error.includes("Damas, fila 2")));
});

test("maps the actual roster values and interprets ambiguous dates as day/month/year", () => {
  const row = parseRosterImportRows([
    { rowNumber: 1, values: headers },
    {
      rowNumber: 2,
      values: [
        "ALCANTARA LA ROSA, Henry", "PASIVO", "31/01/1960", "V", "PADRE",
        "04/12/1994", "04/12/1994", "31", "SI", "NO", "SI", "SI", "SI", "-",
        "SOLTERO", "EMPLEADO", "963562542", "AV. CRUZ BLANCA 2384 - SANTA MARÍA",
      ],
    },
  ], "2026-03-10")[0];

  assert.ok(row);
  assert.deepEqual(row.errors, []);
  assert.equal(row.member.category, "vitalicio");
  assert.equal(row.member.sex, "varon");
  assert.equal(row.member.hasChildren, true);
  assert.equal(row.member.birthDate, "1960-01-31");
  assert.equal(row.member.joinedAt, "1994-12-04");
  assert.equal(row.member.swornAt, "1994-12-04");
  assert.deepEqual(row.member.sacraments, ["Bautismo", "Primera Comunión", "Confirmación"]);
  assert.equal(row.member.maritalStatus, "SOLTERO");
  assert.equal(row.member.occupation, "EMPLEADO");
  assert.equal(row.member.phone, "963562542");
  assert.equal(row.member.address, "AV. CRUZ BLANCA 2384 - SANTA MARÍA");
  assert.equal(row.tenure, "31 años, 3 meses");
});

test("maps D to dama", () => {
  const row = parseRosterImportRows([
    { rowNumber: 1, values: headers.slice(0, 7) },
    { rowNumber: 2, values: ["María López", "Activo", "02/10/1995", "D", "MADRE", "04/12/2010", ""] },
  ], "2026-03-10")[0];

  assert.ok(row);
  assert.equal(row.errors.length, 0);
  assert.equal(row.member.sex, "dama");
  assert.equal(row.member.birthDate, "1995-10-02");
  assert.equal(row.member.joinedAt, "2010-12-04");
});

test("maps Aspirante to Postulante without treating the missing oath date as an issue", () => {
  const row = parseRosterImportRows([
    { rowNumber: 1, values: headers.slice(0, 7) },
    { rowNumber: 2, values: ["Ana Pérez", "ASPIRANTE", "02/10/1995", "D", "No", "04/12/2024", "-"] },
  ], "2026-03-10")[0];

  assert.ok(row);
  assert.deepEqual(row.errors, []);
  assert.deepEqual(row.warnings, []);
  assert.equal(row.member.category, "postulante");
  assert.equal(row.member.swornAt, "");
  assert.equal(row.tenure, "Aún no juramentó");
});

test("treats a missing oath date as possible postulante but does not change another category", () => {
  const row = parseRosterImportRows([
    { rowNumber: 1, values: headers.slice(0, 7) },
    { rowNumber: 2, values: ["Ana Pérez", "Activo", "02/10/1995", "D", "No", "04/12/2010", "-"] },
  ], "2026-03-10")[0];

  assert.ok(row);
  assert.equal(row.member.swornAt, "");
  assert.equal(row.member.category, "activo");
  assert.ok(row.warnings.some((warning) => warning.includes("podría ser Postulante/Aspirante")));
  assert.equal(row.tenure, "Revisar: posible postulante/aspirante");
});

test("accepts single-digit day and month with hyphen separators", () => {
  const row = parseRosterImportRows([
    { rowNumber: 1, values: headers.slice(0, 7) },
    { rowNumber: 2, values: ["Carlos Ruiz", "Activo", "31/01/1960", "V", "NO", "28-3-2025", "28-3-2025"] },
  ], "2026-03-10")[0];

  assert.ok(row);
  assert.deepEqual(row.errors, []);
  assert.equal(row.member.joinedAt, "2025-03-28");
  assert.equal(row.member.swornAt, "2025-03-28");
});

test("keeps active non-residents active and defaults other rows to Huacho residents", () => {
  const rows = parseRosterImportRows([
    { rowNumber: 1, values: headers.slice(0, 7) },
    { rowNumber: 2, values: ["Ana Pérez", "ACTIVO - NO RESIDENTE EN HUACHO", "02/10/1995", "D", "NO", "04/12/2010", "04/12/2010"] },
    { rowNumber: 3, values: ["Luis Pérez", "ACTIVO", "02/10/1995", "V", "NO", "04/12/2010", "04/12/2010"] },
  ], "2026-03-10");

  assert.equal(rows[0]?.member.category, "activo");
  assert.equal(rows[0]?.member.nonResidentHuacho, true);
  assert.equal(rows[1]?.member.category, "activo");
  assert.equal(rows[1]?.member.nonResidentHuacho, false);
});

test("infers sex only from MADRE/PADRE and treats NO, blank, and dash as no children", () => {
  const rows = parseRosterImportRows([
    { rowNumber: 1, values: headers.slice(0, 7) },
    { rowNumber: 2, values: ["Ana Pérez", "Activo", "02/10/1995", "", "MADRE", "04/12/2010", ""] },
    { rowNumber: 3, values: ["Luis Pérez", "Activo", "02/10/1995", "", "PADRE", "04/12/2010", ""] },
    { rowNumber: 4, values: ["No Pérez", "Activo", "02/10/1995", "", "NO", "04/12/2010", ""] },
    { rowNumber: 5, values: ["Sin Pérez", "Activo", "02/10/1995", "", "", "04/12/2010", ""] },
    { rowNumber: 6, values: ["Guion Pérez", "Activo", "02/10/1995", "", "-", "04/12/2010", ""] },
  ], "2026-03-10");

  assert.deepEqual(rows.map((row) => [row.member.sex, row.member.hasChildren]), [
    ["dama", true],
    ["varon", true],
    [null, false],
    [null, false],
    [null, false],
  ]);
});
