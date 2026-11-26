import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteApp, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, doc, getFirestore, setDoc, terminate } from "firebase/firestore";
import { makeRosterIndex } from "../lib/roster-index.ts";
import type { RosterFilters, RosterMember } from "../lib/member-roster.ts";
import type { PortalIdentity } from "../lib/firebase/auth.ts";

test("backfills legacy records and paginates filtered Firestore results", async () => {
  const projectId = "demo-hcsmp";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo.invalid";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "demo";
  const app = initializeApp({projectId, apiKey:"demo", authDomain:"demo.invalid", appId:"demo"});
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080, {mockUserToken:{sub:"secretary"}});
  const adminApp = initializeApp({projectId}, "emulator-seed");
  const admin = getFirestore(adminApp);
  connectFirestoreEmulator(admin, "127.0.0.1", 8080, {mockUserToken:"owner"});
  const identity: PortalIdentity = {uid:"secretary", user:{hermanoId:"pilot", username:"secretary", role:"secretaria", activo:true, createdAt:"", updatedAt:""}};
  const legacy = {fullName:"Piloto Secretaría", birthDate:"", category:"activo" as const, status:"vigente" as const, sacraments:[]};
  try {
    await setDoc(doc(admin, "usuarios", "secretary"), identity.user);
    await setDoc(doc(admin, "hermanos", "pilot"), legacy);
    const records: RosterMember[] = Array.from({length:25}, (_, index) => ({
      fullName:`Jose ${String(index).padStart(2, "0")}`, dni:String(10000000 + index),
      birthDate: index < 21 ? "1990-11-26" : "2015-11-26",
      sex:"varon", hasChildren:true, category:"activo", status:"vigente", sacraments:["Bautizo"],
    }));
    await Promise.all(records.map((record, index) => setDoc(doc(admin, "hermanos", `member-${index}`), {
      ...record, joinedAt:"", swornAt:"", phone:"", rosterIndex:makeRosterIndex(record),
    })));
    const { backfillRosterIndex, readRosterPage, readFilteredRoster, rosterCoverage } = await import("../lib/firebase/roster.ts");
    assert.deepEqual(await rosterCoverage(identity), {total:26, indexed:25});
    await backfillRosterIndex(identity, () => {});
    assert.deepEqual(await rosterCoverage(identity), {total:26, indexed:26});
    const filters: RosterFilters = {search:"jos", sex:"varon", parent:"padre", ageGroup:"mayores", category:"activo", birthMonth:"11", sacrament:"Bautismo"};
    const first = await readRosterPage(identity, filters, null);
    assert.equal(first.count, 21);
    assert.equal(first.members.length, 10);
    assert.ok(first.last);
    const second = await readRosterPage(identity, filters, first.last);
    assert.equal(second.members.length, 10);
    assert.equal(new Set([...first.members, ...second.members].map((member) => member.id)).size, 20);
    const third = await readRosterPage(identity, filters, second.last);
    assert.equal(third.members.length, 1);
    assert.equal((await readFilteredRoster(identity, filters)).length, 21);
    const numeric = await readRosterPage(identity, {...filters, search:"1000000"}, null);
    assert.equal(numeric.count, 10);
    const {createInstitutionalMember, updateInstitutionalMemberContact, changeMemberCategory, changeMemberLifecycle} = await import("../lib/firebase/members.ts");
    const input = {
      fullName:"Hermano Prueba", dni:"87654321", birthDate:"1990-11-26", sex:"varon" as const, hasChildren:true,
      address:"", phone:"", email:"prueba@example.invalid", occupation:"", maritalStatus:"", joinedAt:"", swornAt:"",
      category:"activo" as const, sacraments:["Bautismo", "Primera Comunión", "Confirmación", "Matrimonio"], guardian:null,
    };
    await createInstitutionalMember(identity, input, "estandar");
    await updateInstitutionalMemberContact(identity, "dni-87654321", {...input, sex:"dama"});
    const motherFilters: RosterFilters = {...filters, search:"", sex:"dama", parent:"madre"};
    assert.equal((await readRosterPage(identity, motherFilters, null)).count, 1);
    await changeMemberCategory(identity, "dni-87654321", "vitalicio", "Cambio de prueba");
    assert.equal((await readRosterPage(identity, {...motherFilters, category:"vitalicio"}, null)).count, 1);
    await changeMemberLifecycle(identity, "dni-87654321", "retiro", "Retiro de prueba");
    await changeMemberLifecycle(identity, "dni-87654321", "reingreso", "Reingreso de prueba");
    assert.equal((await readRosterPage(identity, {...motherFilters, category:"reingresante"}, null)).count, 1);
  } finally {
    await terminate(db);
    await terminate(admin);
    await deleteApp(app);
    await deleteApp(adminApp);
  }
});
