"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  logoutFirebase,
  observePortalIdentity,
  type PortalIdentity,
} from "@/lib/firebase/auth";
import {
  readMyMember,
  readRoster,
  readRequests,
  readAccountMovements,
  readAllMovements,
} from "@/lib/firebase/queries";

type Summary = {
  memberName: string;
  memberStatus: string;
  rosterCount?: number;
  requestCount: number;
  movementCount: number;
};

/** Separate Firebase-only, read-only workspace. Never falls back to demo data. */
export function FirebaseWorkspace() {
  const router = useRouter();
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let generation = 0;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = observePortalIdentity(
        (next) => {
          if (!active) return;
          const current = ++generation;
          setIdentity(next);
          setSummary(null);
          setError("");
          if (!next) {
            setLoading(false);
            return;
          }
          setLoading(true);
          void (async () => {
            try {
              const member = await readMyMember(next);
              if (!member || member.status !== "vigente") {
                throw new Error("Tu ficha no existe o tu acceso institucional está suspendido.");
              }
              const role = next.user.role;
              const [requests, movements, roster] = await Promise.all([
                readRequests(next),
                role === "tesoreria" || role === "presidencia"
                  ? readAllMovements(next)
                  : readAccountMovements(next),
                role === "secretaria" || role === "presidencia"
                  ? readRoster(next)
                  : Promise.resolve(null),
              ]);
              if (!active || generation !== current) return;
              setSummary({
                memberName: member.fullName,
                memberStatus: member.status,
                requestCount: requests.length,
                movementCount: movements.length,
                ...(roster ? { rosterCount: roster.length } : {}),
              });
            } catch (failure) {
              if (!active || generation !== current) return;
              setError(failure instanceof Error ? failure.message : "Error al consultar Firestore.");
            } finally {
              if (active && generation === current) setLoading(false);
            }
          })();
        },
        (failure) => {
          if (!active) return;
          setError(failure.message);
          setLoading(false);
        },
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Firebase no está configurado.");
      setLoading(false);
    }
    return () => {
      active = false;
      generation++;
      unsubscribe?.();
    };
  }, []);

  async function signOut() {
    try {
      await logoutFirebase();
      router.replace("/firebase-check");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo cerrar sesión.");
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium">HCSMP · Firebase</p>
        <h1 className="text-3xl font-semibold">Espacio institucional</h1>
        <p className="text-sm text-muted">
          Vista piloto de solo lectura. Los datos provienen de Firestore;
          no se mezclan con la demostración local.
        </p>
      </header>
      {loading && <p role="status">Consultando Firebase…</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!loading && !identity && (
        <p>Sin sesión autorizada. <a className="underline" href="/firebase-check">Iniciar sesión de prueba</a></p>
      )}
      {identity && (
        <section className="space-y-4 rounded-md border p-5">
          <div>
            <p className="text-sm text-muted">Cuenta autenticada</p>
            <p className="font-semibold">{identity.user.username} · {identity.user.role}</p>
          </div>
          {summary && (
            <>
              <p className="text-lg font-medium">{summary.memberName}</p>
              <p className="text-sm">Estado: {summary.memberStatus}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {summary.rosterCount !== undefined && (
                  <div className="rounded-md border p-4">
                    <p className="text-2xl font-semibold">{summary.rosterCount}</p>
                    <p className="text-sm">Hermanos registrados</p>
                  </div>
                )}
                <div className="rounded-md border p-4">
                  <p className="text-2xl font-semibold">{summary.requestCount}</p>
                  <p className="text-sm">Solicitudes visibles</p>
                </div>
                <div className="rounded-md border p-4">
                  <p className="text-2xl font-semibold">{summary.movementCount}</p>
                  <p className="text-sm">Movimientos visibles</p>
                </div>
              </div>
            </>
          )}
          <button type="button" className="rounded-md border px-4 py-2"
            onClick={() => void signOut()}>Cerrar sesión Firebase</button>
        </section>
      )}
      <p className="text-xs text-muted">
        Este piloto no permite editar fichas, gestionar solicitudes ni realizar
        cobros. El portal principal sigue en modo demostración.
      </p>
    </main>
  );
}
