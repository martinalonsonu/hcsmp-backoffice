"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { observePortalIdentity, type PortalIdentity } from "@/lib/firebase/auth";
import { readRoster } from "@/lib/firebase/queries";
import type { MemberRecord } from "@/lib/firebase/models";

type RosterEntry = MemberRecord & { id: string };

export function FirebaseRoster() {
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [members, setMembers] = useState<RosterEntry[]>([]);
  const [filter, setFilter] = useState("");
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
          setMembers([]);
          setError("");
          if (!next) {
            setLoading(false);
            return;
          }
          if (next.user.role !== "secretaria" && next.user.role !== "presidencia") {
            setError("No tienes permiso para consultar el padrón.");
            setLoading(false);
            return;
          }
          setLoading(true);
          void readRoster(next).then((result) => {
            if (active && generation === current) setMembers(result);
          }).catch((failure: unknown) => {
            if (active && generation === current) {
              setError(failure instanceof Error ? failure.message : "No se pudo consultar el padrón.");
            }
          }).finally(() => {
            if (active && generation === current) setLoading(false);
          });
        },
        (failure) => {
          if (active) {
            setError(failure.message);
            setLoading(false);
          }
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

  const visible = useMemo(() => {
    const search = filter.trim().toLocaleLowerCase("es-PE");
    return members.filter((member) =>
      member.fullName.toLocaleLowerCase("es-PE").includes(search),
    ).sort((a, b) => a.fullName.localeCompare(b.fullName, "es-PE"));
  }, [members, filter]);

  const allowed = identity?.user.role === "secretaria" || identity?.user.role === "presidencia";

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-12">
      <Link href="/firebase-workspace" className="text-sm underline">Volver al espacio institucional</Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Padrón institucional</h1>
        <p className="text-sm text-muted">
          Lectura de Firestore para Secretaría y Presidencia. No permite modificar registros.
          Se muestran únicamente nombre, categoría y estado.
        </p>
      </header>
      {loading && <p role="status">Cargando padrón…</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!loading && !identity && !error && (
        <p>Inicia sesión en <Link className="underline" href="/firebase-check">la prueba de Firebase</Link>.</p>
      )}
      {!loading && allowed && !error && (
        <section className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Buscar por nombre</span>
            <input className="w-full rounded-md border p-3" value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Nombre del hermano" type="search" />
          </label>
          <p role="status" className="text-sm text-muted">
            {visible.length} de {members.length} hermanos
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-white/60">
                <tr>
                  <th scope="col" className="p-3">Hermano</th>
                  <th scope="col" className="p-3">Categoría</th>
                  <th scope="col" className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((member) => (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{member.fullName}</td>
                    <td className="p-3">{member.category}</td>
                    <td className="p-3">{member.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length === 0 && <p className="text-sm text-muted">No se encontraron hermanos.</p>}
        </section>
      )}
    </main>
  );
}
