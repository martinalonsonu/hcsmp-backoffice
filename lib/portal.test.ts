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

test("usuario automático único y contraseña inicial verificable sin texto plano", async () => {
  assert.equal(portal.uniqueUsername(draft(), []), "h12345678");
  assert.equal(
    portal.uniqueUsername(draft(), [
      member("estandar", { username: "h12345678" }),
    ]),
    "h12345678.2",
  );
  const password = portal.generatePassword();
  const hash = await portal.hashPassword(password);
  assert.ok(password.length >= 12);
  assert.notEqual(hash, password);
  assert.equal(await portal.verifyPassword(password, hash), true);
  assert.equal(await portal.verifyPassword(`${password}!`, hash), false);
});
