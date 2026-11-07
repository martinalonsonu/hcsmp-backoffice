import assert from "node:assert/strict";
import { test } from "node:test";
import * as portal from "./portal.ts";
import type { Member, MemberDraft, Role } from "./portal";

function draft(patch: Partial<MemberDraft> = {}): MemberDraft {
  return {
    ...portal.emptyMemberDraft(),
    fullName: "Hermano de prueba",
    dni: "12345678",
    birthDate: "1990-01-01",
    joinedAt: "2020-01-01",
    ...patch,
  };
}
function member(role: Role = "estandar", patch: Partial<Member> = {}): Member {
  return {
    ...draft({ category: "activo", swornAt: "2021-01-01" }),
    id: "one",
    username: "hermano",
    passwordHash: "demo",
    status: "vigente",
    retiredAt: "",
    rejoinedAt: "",
    membershipHistory: [],
    role,
    ...patch,
  };
}

test("edad exacta: cumple 18 hoy y no el día anterior", () => {
  assert.equal(portal.ageOnDate("2008-11-06", "2026-11-06"), 18);
  assert.equal(portal.ageOnDate("2008-11-07", "2026-11-06"), 17);
  assert.equal(portal.ageOnDate("2026-02-30", "2026-11-06"), null);
  assert.equal(portal.ageOnDate("2027-01-01", "2026-11-06"), null);
});

test("vitalicio cuenta desde juramentación, nunca desde ingreso", () => {
  assert.equal(
    portal.isVitalicioEligible(
      { birthDate: "1980-01-01", swornAt: "1996-11-06" },
      "2026-11-06",
    ),
    true,
  );
  assert.equal(
    portal.isVitalicioEligible(
      { birthDate: "1980-01-01", swornAt: "1996-11-07" },
      "2026-11-06",
    ),
    false,
  );
  assert.equal(
    portal.isVitalicioEligible(
      { birthDate: "1961-11-06", swornAt: "2025-01-01" },
      "2026-11-06",
    ),
    true,
  );
  assert.equal(
    portal.isVitalicioEligible(
      { birthDate: "1961-11-07", swornAt: "2025-01-01" },
      "2026-11-06",
    ),
    false,
  );
});

test("postulante adulto sin email o juramentación es válido", () => {
  assert.deepEqual(portal.validateMember(draft()), {});
});

test("menor necesita apoderado y no puede ser activo", () => {
  const errors = portal.validateMember(
    draft({
      birthDate: "2015-01-01",
      joinedAt: "2025-01-01",
      category: "activo",
    }),
  );
  assert.ok(errors.category);
  assert.ok(errors["guardian.fullName"]);
  assert.ok(errors["guardian.dni"]);
  assert.ok(errors["guardian.phone"]);
  assert.ok(errors["guardian.relationship"]);
});

test("no admite DNI duplicado, email duplicado ni fechas incoherentes", () => {
  const existing = member("estandar", { email: "hermano@example.com" });
  const errors = portal.validateMember(
    draft({
      email: "Hermano@example.com",
      joinedAt: "1980-01-01",
      swornAt: "1979-01-01",
    }),
    [existing],
  );
  assert.ok(errors.dni);
  assert.ok(errors.email);
  assert.ok(errors.joinedAt);
  assert.ok(errors.swornAt);
});

test("activo requiere juramentación y vitalicio requiere elegibilidad", () => {
  assert.ok(portal.validateMember(draft({ category: "activo" })).swornAt);
  assert.ok(
    portal.validateMember(
      draft({
        category: "vitalicio",
        birthDate: "1950-01-01",
        swornAt: "",
      }),
    ).swornAt,
  );
  assert.ok(
    portal.validateMember(
      draft({ category: "vitalicio", swornAt: "2021-01-01" }),
    ).category,
  );
});

test("únicamente Secretaría puede editar el padrón", () => {
  for (const role of ["estandar", "tesoreria", "presidencia"] as Role[]) {
    assert.throws(
      () =>
        portal.updatedMember(
          member(role),
          member(),
          { category: "postulante" },
          [],
        ),
      /permiso/,
    );
  }
  const next = portal.updatedMember(
    member("secretaria"),
    member("tesoreria"),
    { category: "postulante" },
    [],
  );
  assert.equal(next.category, "postulante");
  assert.equal(next.role, "estandar");
  assert.throws(
    () =>
      portal.updatedMember(
        member("secretaria"),
        member(),
        { category: "postulante", role: "presidencia" },
        [],
      ),
    /Estándar/,
  );
});

test("editar perfil propio no modifica categoría, rol ni datos institucionales", () => {
  const own = member();
  const next = portal.ownProfilePatch(
    own,
    {
      category: "vitalicio",
      dni: "99999999",
      birthDate: "1950-01-01",
      swornAt: "1990-01-01",
      phone: "987654321",
    },
    [],
  );
  assert.equal(next.category, own.category);
  assert.equal(next.dni, own.dni);
  assert.equal(next.birthDate, own.birthDate);
  assert.equal(next.swornAt, own.swornAt);
  assert.equal(next.phone, "987654321");
  assert.equal(next.id, own.id);
});

test("movimientos solo Tesorería; validación del hermano, fecha e importe", () => {
  const movement = {
    date: "2026-01-01",
    description: "Cuota",
    memberId: "one",
    type: "pago" as const,
    amount: 20,
  };
  assert.throws(
    () => portal.validateMovement(member("presidencia"), movement, [member()]),
    /permiso/,
  );
  assert.throws(
    () => portal.validateMovement(member("secretaria"), movement, [member()]),
    /permiso/,
  );
  assert.doesNotThrow(() =>
    portal.validateMovement(member("tesoreria"), movement, [member()]),
  );
  assert.throws(
    () =>
      portal.validateMovement(
        member("tesoreria"),
        { ...movement, memberId: "missing" },
        [member()],
      ),
    /Selecciona/,
  );
  assert.throws(
    () =>
      portal.validateMovement(member("tesoreria"), { ...movement, amount: 0 }, [
        member(),
      ]),
    /importe/,
  );
});

test("usuario usa primer nombre y apellidos para resolver coincidencias", () => {
  const nameParts = {
    givenNames: "José María",
    firstSurname: "Pérez",
    secondSurname: "García",
  };
  assert.equal(portal.uniqueUsername(nameParts, []), "jose.perez");
  assert.equal(
    portal.uniqueUsername(nameParts, [
      member("estandar", { username: "jose.perez" }),
    ]),
    "jose.perez.garcia",
  );
  assert.equal(
    portal.uniqueUsername(nameParts, [
      member("estandar", { username: "jose.perez" }),
      member("estandar", { username: "jose.perez.garcia" }),
    ]),
    "jose.perez.garcia.2",
  );
});

test("contraseña inicial es única y verificable sin texto plano", async () => {
  const password = portal.generatePassword();
  const hash = await portal.hashPassword(password);
  assert.ok(password.length >= 12);
  assert.notEqual(hash, password);
  assert.equal(await portal.verifyPassword(password, hash), true);
  assert.equal(await portal.verifyPassword(`${password}!`, hash), false);
});

test("reingresante adulto está a prueba y no requiere una nueva juramentación", () => {
  assert.deepEqual(
    portal.validateMember(draft({ category: "reingresante", swornAt: "" })),
    {},
  );
  assert.equal(portal.isTrialCategory("reingresante"), true);
  assert.equal(portal.isTrialCategory("activo"), false);
  const minor = draft({
    category: "reingresante",
    birthDate: "2015-01-01",
    joinedAt: "2025-01-01",
  });
  assert.ok(portal.validateMember(minor).category);
  assert.throws(
    () =>
      portal.updatedMember(
        member("secretaria"),
        member(),
        { category: "reingresante", role: "presidencia" },
        [],
      ),
    /Estándar/,
  );
  const next = portal.updatedMember(
    member("secretaria"),
    member("tesoreria"),
    { category: "reingresante" },
    [],
  );
  assert.equal(next.role, "estandar");
  assert.equal(next.rejoinedAt, portal.todayDate());
});

test("migración añade estado vigente sin perder fichas, credenciales ni movimientos", () => {
  const oldMember = {
    ...member(),
    id: "legacy",
    passwordHash: "hash-conservado",
  } as Partial<Member>;
  delete oldMember.status;
  delete oldMember.retiredAt;
  delete oldMember.rejoinedAt;
  delete oldMember.membershipHistory;
  const movement = {
    id: "m",
    date: "2026-01-01",
    description: "Pago anterior",
    type: "pago" as const,
    amount: 42,
    memberId: "legacy",
  };
  const migrated = portal.migratePortalData({
    version: 1,
    members: [oldMember],
    movements: [movement],
  });
  assert.equal(migrated.members[0].status, "vigente");
  assert.equal(migrated.members[0].passwordHash, "hash-conservado");
  assert.equal(migrated.members[0].id, "legacy");
  assert.equal(migrated.members[0].username, oldMember.username);
  assert.deepEqual(migrated.members[0].membershipHistory, []);
  assert.deepEqual(migrated.movements, [movement]);
  assert.deepEqual(migrated.requests, []);
  assert.deepEqual(portal.migratePortalData(migrated), migrated);
});

test("solicitudes requieren título y detalle y validan estados permitidos", () => {
  assert.throws(() => portal.validateRequestInput("", "Detalle"), /título/);
  assert.throws(() => portal.validateRequestInput("Título", "  "), /detalle/);
  assert.throws(
    () => portal.validateRequestInput("x".repeat(121), "Detalle"),
    /120 caracteres/,
  );
  assert.doesNotThrow(() =>
    portal.validateRequestInput("Solicitud", "Detalle de prueba"),
  );
  assert.equal(portal.isRequestStatus("enviada"), true);
  assert.equal(portal.isRequestStatus("en_revision"), true);
  assert.equal(portal.isRequestStatus("derivada"), true);
  assert.equal(portal.isRequestStatus("resuelta"), true);
  assert.equal(portal.isRequestStatus("otro"), false);
  assert.throws(() => portal.validateRequestStatus("otro"), /estado/);
});

test("cuotas generan cargos al vencimiento, con exoneraciones, mitad aspirante y penalidad", () => {
  const memberWith = (id: string, category: Member["category"], patch = {}) =>
    member("estandar", {
      id,
      category,
      ...patch,
    });
  const data = {
    version: 1 as const,
    members: [
      memberWith("active", "activo"),
      memberWith("applicant", "postulante"),
      memberWith("returning", "reingresante", {
        rejoinedAt: "2026-11-02",
        membershipHistory: [
          { type: "retiro" as const, date: "2026-10-01", category: "activo" as const },
          { type: "reingreso" as const, date: "2026-11-02", category: "reingresante" as const },
        ],
      }),
      memberWith("life", "vitalicio"),
    ],
    movements: [],
    requests: [],
    ordinaryFees: [{ effectiveMonth: "2026-11", amount: 10 }],
    billingStartMonth: "2026-11",
  };
  const beforeMonthlyDue = portal.accrueScheduledDues(data, "2026-11-30");
  assert.deepEqual(
    beforeMonthlyDue.movements.filter((item) =>
      item.description.startsWith("Cuota ordinaria"),
    ),
    [],
  );
  assert.ok(
    beforeMonthlyDue.movements.some((item) =>
      item.description.includes("extraordinaria"),
    ),
  );
  const accrued = portal.accrueScheduledDues(data, "2026-12-01");
  const chargesFor = (id: string) =>
    accrued.movements.filter((item) => item.memberId === id);
  assert.deepEqual(
    chargesFor("active").map(({ description, amount }) => ({
      description,
      amount,
    })),
    [
      { description: "Cuota ordinaria · 2026-11", amount: 10 },
      {
        description: "Cuota extraordinaria · Noviembre 2026",
        amount: 20,
      },
    ],
  );
  assert.equal(chargesFor("applicant")[0]?.amount, 5);
  assert.equal(
    chargesFor("applicant").find((item) => item.description.includes("extraordinaria"))
      ?.amount,
    20,
  );
  assert.deepEqual(
    chargesFor("returning").map((item) => item.amount).toSorted(),
    [10, 20, 200],
  );
  assert.deepEqual(chargesFor("life"), []);
  assert.equal(
    portal.accrueScheduledDues(accrued, "2026-12-01").movements.length,
    accrued.movements.length,
  );
  assert.equal(portal.nextMonth("2026-12"), "2027-01");
});

test("retiro conserva la ficha y suspende acceso; reingreso conserva la cuenta y pasa a prueba", () => {
  const original = member("tesoreria", {
    id: "returning",
    passwordHash: "hash-original",
  });
  const secretary = member("secretaria", { id: "secretary" });
  const retired = portal.retiredMember(secretary, original, "2026-01-01");
  assert.equal(retired.status, "retirado");
  assert.equal(retired.category, original.category);
  assert.equal(retired.role, original.role);
  assert.equal(portal.canAccessPortal(retired), false);
  assert.equal(portal.canAccessPortal(null), false);
  assert.equal(retired.retiredAt, "2026-01-01");
  const returning = portal.readmittedMember(secretary, retired, "2026-02-01");
  assert.equal(returning.status, "vigente");
  assert.equal(returning.category, "reingresante");
  assert.equal(returning.role, "estandar");
  assert.equal(portal.canAccessPortal(returning), true);
  assert.equal(returning.rejoinedAt, "2026-02-01");
  for (const key of [
    "id",
    "username",
    "passwordHash",
    "joinedAt",
    "swornAt",
  ] as const)
    assert.equal(returning[key], original[key]);
  assert.deepEqual(returning.membershipHistory, [
    { type: "retiro", date: "2026-01-01", category: "activo" },
    { type: "reingreso", date: "2026-02-01", category: "reingresante" },
  ]);
  assert.equal(original.status, "vigente");
  assert.deepEqual(original.membershipHistory, []);
});

test("solo Secretaría puede retirar o reingresar y las transiciones no se repiten", () => {
  const secretary = member("secretaria");
  const active = member();
  const retired = portal.retiredMember(secretary, active, "2026-01-01");
  for (const role of ["estandar", "tesoreria", "presidencia"] as Role[]) {
    assert.throws(() => portal.retiredMember(member(role), active), /permiso/);
    assert.throws(
      () => portal.readmittedMember(member(role), retired),
      /permiso/,
    );
  }
  assert.throws(
    () => portal.retiredMember(secretary, retired),
    /ya está retirado/,
  );
  assert.throws(() => portal.readmittedMember(secretary, active), /retirado/);
  assert.throws(
    () => portal.readmittedMember(secretary, retired, "2025-12-31"),
    /posterior al retiro/,
  );
  assert.throws(
    () => portal.retiredMember(secretary, active, "2999-01-01"),
    /fecha/,
  );
  assert.throws(
    () =>
      portal.assertRole({ ...secretary, status: "retirado" }, ["secretaria"]),
    /permiso/,
  );
  assert.throws(
    () => portal.ownProfilePatch(retired, { phone: "999999999" }, []),
    /Inicia sesión/,
  );
});

test("DNI de retirado orienta al reingreso en lugar de crear una ficha duplicada", () => {
  const existing = member("estandar", { status: "retirado" });
  assert.match(
    portal.validateMember(draft({ category: "reingresante" }), [existing]).dni,
    /listado de retirados/,
  );
});

test("editar una ficha no permite cambiar su estado por un patch fuera del contrato", () => {
  const original = member("estandar", {
    status: "retirado",
    retiredAt: "2026-01-01",
    membershipHistory: [
      { type: "retiro", date: "2026-01-01", category: "activo" },
    ],
  });
  const patch = {
    fullName: "Nombre corregido",
    status: "vigente",
    retiredAt: "",
    membershipHistory: [],
  } as Partial<MemberDraft>;
  const next = portal.updatedMember(member("secretaria"), original, patch, []);
  assert.equal(next.status, "retirado");
  assert.equal(next.retiredAt, original.retiredAt);
  assert.deepEqual(next.membershipHistory, original.membershipHistory);
});

test("reingreso de menor conserva su cuenta y apoderado como Postulante", () => {
  const guardian = {
    fullName: "Apoderado de prueba",
    dni: "22222222",
    age: "40",
    education: "Superior",
    address: "Huacho",
    phone: "999999999",
    relationship: "Madre",
    sacraments: ["Bautizo"],
  };
  const minor = member("estandar", {
    birthDate: "2015-01-01",
    joinedAt: "2025-01-01",
    swornAt: "",
    category: "postulante",
    guardian,
  });
  const secretary = member("secretaria");
  const retired = portal.retiredMember(secretary, minor, "2026-01-01");
  const returning = portal.readmittedMember(secretary, retired, "2026-02-01");
  assert.equal(returning.status, "vigente");
  assert.equal(returning.category, "postulante");
  assert.equal(returning.role, "estandar");
  assert.equal(portal.canAccessPortal(returning), true);
  for (const key of [
    "id",
    "username",
    "passwordHash",
    "joinedAt",
    "swornAt",
  ] as const)
    assert.equal(returning[key], minor[key]);
  assert.deepEqual(returning.guardian, guardian);
  assert.deepEqual(returning.membershipHistory.at(-1), {
    type: "reingreso",
    date: "2026-02-01",
    category: "postulante",
  });
  assert.deepEqual(portal.validateMember(returning), {});
  assert.ok(
    portal.validateMember({ ...returning, category: "reingresante" }).category,
  );
});
