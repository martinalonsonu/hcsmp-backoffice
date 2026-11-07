"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  loginWithUsername,
  logoutFirebase,
  observePortalIdentity,
  type PortalIdentity,
} from "@/lib/firebase/auth";
import { readMyMember } from "@/lib/firebase/queries";

type Status = "checking" | "signed-out" | "signed-in" | "error";

/**
 * Isolated read-only smoke test. Does not alter the demo PortalProvider,
 * create accounts, write Firestore documents or expose sensitive member data.
 */
export function FirebaseConnectionCheck() {
  const [status, setStatus] = useState<Status>("checking");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [message, setMessage] = useState("");
  const [memberFound, setMemberFound] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = observePortalIdentity(
        (next) => {
          setIdentity(next);
          setStatus(next ? "signed-in" : "signed-out");
        },
        (error) => {
          setMessage(error.message);
          setStatus("error");
        },
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar Firebase.");
      setStatus("error");
    }
    return () => unsubscribe?.();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setMemberFound(null);
    try {
      const result = await loginWithUsername(username, password);
      setIdentity(result);
      setStatus("signed-in");
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error de autenticación.");
    } finally {
      setPending(false);
    }
  }

  async function verifyRead() {
    if (!identity) return;
    setPending(true);
    setMessage("");
    try {
      const member = await readMyMember(identity);
      setMemberFound(member !== null);
      if (!member) setMessage("No existe la ficha vinculada al usuario.");
    } catch (error) {
      setMemberFound(null);
      setMessage(error instanceof Error ? error.message : "No se pudo consultar Firestore.");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    try {
      await logoutFirebase();
      setIdentity(null);
      setMemberFound(null);
      setStatus("signed-out");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cerrar sesión.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-5 px-5 py-12">
      <h1 className="text-2xl font-semibold">Verificación de Firebase</h1>
      <p className="text-sm">
        Diagnóstico de solo lectura. Esta página no modifica el padrón ni la
        demostración local. No utilices credenciales de las cuentas demo.
      </p>
      <p role="status" className="text-sm">
        Estado: {status === "checking" ? "Comprobando sesión…" :
          status === "signed-in" ? "Autenticado y autorizado" :
          status === "signed-out" ? "Sin sesión" : "Error de configuración"}
      </p>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      {identity ? (
        <section className="space-y-4 rounded-md border p-4">
          <p>Usuario: <strong>{identity.user.username}</strong></p>
          <p>Perfil: <strong>{identity.user.role}</strong></p>
          <button className="rounded-md border px-4 py-2 disabled:opacity-50"
            disabled={pending} onClick={() => void verifyRead()}>
            Verificar acceso a mi ficha
          </button>
          {memberFound !== null && (
            <p role="status">{memberFound ? "Ficha encontrada y accesible." : "Ficha no encontrada."}</p>
          )}
          <button className="block rounded-md border px-4 py-2 disabled:opacity-50"
            disabled={pending} onClick={() => void logout()}>
            Cerrar sesión de Firebase
          </button>
        </section>
      ) : (
        <form onSubmit={(event) => void login(event)} className="space-y-4">
          <label className="block space-y-1">
            <span>Usuario Firebase de prueba</span>
            <input className="w-full rounded-md border p-2" required autoComplete="username"
              value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="block space-y-1">
            <span>Contraseña</span>
            <input className="w-full rounded-md border p-2" type="password" required
              autoComplete="current-password" value={password}
              onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="rounded-md border px-4 py-2 disabled:opacity-50"
            disabled={pending || status === "checking"} type="submit">
            {pending ? "Comprobando…" : "Probar autenticación"}
          </button>
        </form>
      )}
      <p className="text-xs">
        No habilita altas, cambios de perfiles, cobros ni solicitudes. El
        backoffice principal continúa en modo demostración.
      </p>
    </main>
  );
}
