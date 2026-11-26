import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { stdin, stdout } from "node:process";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { deleteApp } from "firebase/app";
import { doc, getDoc, terminate } from "firebase/firestore";
import type { UserRecord } from "../lib/firebase/models.ts";

async function main() {
  if (!stdin.isTTY) throw new Error("Ejecuta la migración en una terminal interactiva.");
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (existsSync(".env")) process.loadEnvFile(".env");
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!project || process.argv[2] !== "--project" || process.argv[3] !== project)
    throw new Error("Indica explícitamente el proyecto configurado: node --experimental-strip-types scripts\\backfill-roster.ts --project ID_DEL_PROYECTO");
  const prompt = createInterface({input:stdin, output:stdout});
  const email = await prompt.question(`Proyecto ${project}. Correo de Secretaría: `);
  prompt.close();
  stdout.write("Contraseña: ");
  const hidden = new Writable({write(_chunk, _encoding, callback) { callback(); }});
  const passwordPrompt = createInterface({input:stdin, output:hidden, terminal:true});
  const password = await passwordPrompt.question("");
  passwordPrompt.close();
  stdout.write("\n");
  const { getFirebaseServices } = await import("../lib/firebase/client.ts");
  const { backfillRosterIndex, rosterCoverage } = await import("../lib/firebase/roster.ts");
  const { app, auth, db } = getFirebaseServices();
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const user = await getDoc(doc(db, "usuarios", credential.user.uid));
    if (!user.exists() || user.data().role !== "secretaria" || user.data().activo !== true)
      throw new Error("La cuenta debe ser una cuenta activa de Secretaría.");
    const identity = {uid:credential.user.uid, user:user.data() as UserRecord};
    const before = await rosterCoverage(identity);
    console.log(`Fichas pendientes: ${before.total - before.indexed}.`);
    await backfillRosterIndex(identity, (count) => {
      if (count % 100 === 0) console.log(`Fichas revisadas: ${count}.`);
    });
    const after = await rosterCoverage(identity);
    if (after.total !== after.indexed)
      throw new Error(`Quedan ${after.total - after.indexed} fichas sin indexar.`);
    console.log(`Migración completada: ${after.indexed} fichas indexadas.`);
  } finally {
    await signOut(auth);
    await terminate(db);
    await deleteApp(app);
  }
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : "No se pudo completar la migración.");
  process.exitCode = 1;
});
