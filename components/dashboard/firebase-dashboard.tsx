"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { logoutFirebase, observePortalIdentity, type PortalIdentity } from "@/lib/firebase/auth";
import { readMyMember, readRoster, readRequests, readAccountMovements, readAllMovements, readUserDirectory } from "@/lib/firebase/queries";
import type { MemberRecord, MovementRecord, RequestRecord, UserRecord } from "@/lib/firebase/models";
import { HcsmpBrand } from "@/components/brand/hcsmp-brand";
import { createInstitutionalMember, updateInstitutionalMemberContact } from "@/lib/firebase/members";
import type { Category } from "@/lib/portal";
import { submitInstitutionalRequest, setInstitutionalRequestStatus } from "@/lib/firebase/requests";
import type { RequestStatus } from "@/lib/portal";

type MemberRow = MemberRecord & { id: string };
type MovementRow = MovementRecord & { id: string };
type RequestRow = RequestRecord & { id: string };
type Snapshot = { member: MemberRow; roster: MemberRow[]; requests: RequestRow[]; movements: MovementRow[]; users: Array<UserRecord & {id:string}> };

export function FirebaseDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "summary";
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [memberMessage, setMemberMessage] = useState("");
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [memberDraft, setMemberDraft] = useState({
    fullName:"",dni:"",birthDate:"",address:"",phone:"",email:"",
    occupation:"",maritalStatus:"",joinedAt:"",swornAt:"",
    category:"activo" as Category, sacraments:[] as string[],
  });
  const [requestTitle, setRequestTitle] = useState("");
  const [requestContent, setRequestContent] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    let generation = 0;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = observePortalIdentity((next) => {
        if (!active) return;
        const version = ++generation;
        setIdentity(next);
        setData(null);
        setError("");
        if (!next) { setLoading(false); router.replace("/"); return; }
        setLoading(true);
        void (async () => {
          try {
            const member = await readMyMember(next);
            if (!member || member.status !== "vigente") throw new Error("Tu ficha institucional no está vigente.");
            const role = next.user.role;
            const [roster, requests, movements, users] = await Promise.all([
              role === "secretaria" || role === "presidencia" ? readRoster(next) : Promise.resolve([]),
              readRequests(next),
              role === "tesoreria" || role === "presidencia" ? readAllMovements(next) : readAccountMovements(next),
              role === "presidencia" ? readUserDirectory(next) : Promise.resolve([]),
            ]);
            if (active && version === generation) setData({member, roster, requests, movements, users});
          } catch (cause) {
            if (active && version === generation) setError(cause instanceof Error ? cause.message : "No se pudo cargar Firestore.");
          } finally {
            if (active && version === generation) setLoading(false);
          }
        })();
      }, (cause) => {
        if (active) { setError(cause.message); setLoading(false); }
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Firebase no está configurado.");
      setLoading(false);
    }
    return () => { active = false; generation++; unsubscribe?.(); };
  }, [router, reload]);

  const role = identity?.user.role;
  const canRoster = role === "secretaria" || role === "presidencia";
  const canTreasury = role === "tesoreria" || role === "presidencia";
  const items = [
    {view:"summary",label:"Resumen"},
    ...(canRoster ? [{view:"members",label:"Padrón de hermanos"}] : []),
    ...(canTreasury ? [{view:"treasury",label:"Tesorería"}] : []),
    ...(role === "presidencia" ? [{view:"users",label:"Usuarios y accesos"}] : []),
    {view:"requests",label:"Solicitudes"},
    {view:"account",label:"Mi estado de cuenta"},
    {view:"profile",label:"Mi perfil"},
  ];
  const visible = useMemo(() => data?.roster.filter((member) =>
    member.fullName.toLocaleLowerCase("es-PE").includes(filter.trim().toLocaleLowerCase("es-PE"))) ?? [], [data, filter]);
  const allowed = items.some((item) => item.view === view);
  const personal = data?.movements.filter((movement) => movement.memberId === identity?.user.hermanoId) ?? [];
  const money = (cents: number) => new Intl.NumberFormat("es-PE",{style:"currency",currency:"PEN"}).format(cents / 100);

  async function sendRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identity || requestBusy) return;
    setRequestBusy(true); setRequestMessage("");
    try {
      await submitInstitutionalRequest(identity, requestTitle, requestContent);
      setRequestTitle(""); setRequestContent("");
      setReload((value) => value + 1);
    } catch (cause) {
      setRequestMessage(cause instanceof Error ? cause.message : "No se pudo enviar la solicitud.");
    } finally { setRequestBusy(false); }
  }

  async function changeRequestStatus(requestId: string, status: RequestStatus) {
    if (!identity || requestBusy) return;
    setRequestBusy(true); setRequestMessage("");
    try {
      await setInstitutionalRequestStatus(identity, requestId, status);
      setReload((value) => value + 1);
    } catch (cause) {
      setRequestMessage(cause instanceof Error ? cause.message : "No se pudo actualizar la solicitud.");
    } finally { setRequestBusy(false); }
  }

  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identity || memberBusy) return;
    setMemberBusy(true); setMemberMessage("");
    try {
      if (editingMember) {
        await updateInstitutionalMemberContact(identity, editingMember.id, memberDraft);
      } else {
        await createInstitutionalMember(identity, memberDraft);
      }
      setMemberFormOpen(false); setEditingMember(null);
      setReload((value) => value + 1);
    } catch (cause) {
      setMemberMessage(cause instanceof Error ? cause.message : "No se pudo guardar la ficha.");
    } finally { setMemberBusy(false); }
  }

  function openMember(member: MemberRow | null) {
    setEditingMember(member);
    setMemberMessage("");
    setMemberDraft(member ? {
      fullName:member.fullName, dni:member.dni ?? "", birthDate:member.birthDate ?? "",
      address:member.address ?? "", phone:member.phone ?? "", email:member.email ?? "",
      occupation:member.occupation ?? "", maritalStatus:member.maritalStatus ?? "",
      joinedAt:member.joinedAt ?? "", swornAt:member.swornAt ?? "",
      category:member.category, sacraments:member.sacraments ?? [],
    } : {
      fullName:"",dni:"",birthDate:"",address:"",phone:"",email:"",
      occupation:"",maritalStatus:"",joinedAt:"",swornAt:"",
      category:"activo",sacraments:[],
    });
    setMemberFormOpen(true);
  }

  async function signOut() {
    try { await logoutFirebase(); router.replace("/"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cerrar sesión."); }
  }

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="border-b border-line bg-white-warm p-5 lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link href="/dashboard"><HcsmpBrand iconOnly /></Link>
        <nav aria-label="Navegación principal" className="mt-8 flex flex-wrap gap-2 lg:flex-col">
          {items.map((item) => <Link key={item.view} href={item.view === "summary" ? "/dashboard" : `/dashboard?view=${item.view}`}
            aria-current={view === item.view ? "page" : undefined}
            className={`rounded-sm px-3 py-2 text-sm ${view === item.view ? "bg-mist font-semibold" : "hover:bg-mist/70"}`}>{item.label}</Link>)}
        </nav>
        <button className="mt-8 rounded-sm border border-line px-3 py-2 text-sm" onClick={() => void signOut()}>Cerrar sesión</button>
      </aside>
      <main className="min-w-0 space-y-7 px-5 py-10 sm:px-8 lg:px-12">
        <header className="border-b border-line pb-6">
          <p className="eyebrow">Hermandad de Cargadores de San Martín de Porres</p>
          <h1 className="mt-3 font-display text-3xl">Portal de Gestión Interna</h1>
          {identity && <p className="mt-2 text-sm text-muted">{identity.user.username} · {role}</p>}
        </header>
        {loading && <p role="status">Cargando información institucional…</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {!loading && !data && !error && <p>Inicia sesión para acceder al portal.</p>}
        {data && !allowed && <p role="alert">No tienes acceso a este módulo.</p>}
        {data && allowed && view === "summary" && <section className="space-y-5">
          <h2 className="font-display text-2xl">Bienvenido, {data.member.fullName.split(" ")[0]}</h2>
          <p className="text-muted">Información institucional obtenida de Firestore.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Mi categoría" value={data.member.category} />
            <Metric label="Solicitudes visibles" value={String(data.requests.length)} />
            {canRoster ? <Metric label="Hermanos en el padrón" value={String(data.roster.length)} /> :
              <Metric label="Mi estado" value={data.member.status} />}
          </div>
        </section>}
        {data && allowed && view === "members" && <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Padrón de hermanos</h2>
            <button type="button" className="rounded-sm bg-forest px-4 py-2 text-white"
              onClick={() => { if (memberFormOpen) setMemberFormOpen(false); else openMember(null); }}>
              {memberFormOpen ? "Cancelar" : "Registrar hermano"}
            </button>
          </div>
          {memberMessage && <p role="alert" className="text-sm text-red-700">{memberMessage}</p>}
          {memberFormOpen && <form onSubmit={(event) => void saveMember(event)}
            className="space-y-4 rounded-sm border border-line bg-white-warm p-5">
            <h3 className="font-semibold">{editingMember ? "Editar datos de contacto" : "Nueva ficha institucional"}</h3>
            <p className="text-sm text-muted">Registrar un hermano no crea una cuenta de acceso al portal.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["fullName","Nombres y apellidos"],["dni","DNI"],["birthDate","Fecha de nacimiento"],
                ["joinedAt","Fecha de ingreso"],["swornAt","Fecha de juramentación"],
                ["address","Dirección"],["phone","Teléfono"],["email","Correo electrónico"],
                ["occupation","Ocupación"],["maritalStatus","Estado civil"],
              ] as const).map(([key,label]) => <label key={key} className="block space-y-2">
                <span className="text-sm">{label}</span>
                <input className="w-full rounded-sm border border-line bg-white p-3"
                  type={key === "birthDate" || key === "joinedAt" || key === "swornAt" ? "date" : "text"}
                  disabled={!!editingMember && !["address","phone","email","occupation","maritalStatus"].includes(key)}
                  required={key === "fullName"} value={memberDraft[key]}
                  onChange={(event) => setMemberDraft((current) => ({...current,[key]:event.target.value}))}/>
              </label>)}
              <label className="block space-y-2"><span className="text-sm">Categoría</span>
                <select className="w-full rounded-sm border border-line bg-white p-3"
                  disabled={!!editingMember} value={memberDraft.category}
                  onChange={(event) => setMemberDraft((current) => ({...current,category:event.target.value as Category}))}>
                  <option value="postulante">Postulante</option><option value="reingresante">Reingresante</option>
                  <option value="activo">Activo</option><option value="vitalicio">Vitalicio</option>
                </select>
              </label>
            </div>
            <button type="submit" disabled={memberBusy} className="rounded-sm bg-forest px-4 py-2 text-white disabled:opacity-50">
              {memberBusy ? "Guardando…" : editingMember ? "Guardar contacto" : "Registrar hermano"}
            </button>
          </form>}
          <label className="block space-y-2"><span className="text-sm">Buscar por nombre</span>
            <input type="search" className="block w-full rounded-sm border border-line bg-white p-3" value={filter}
              onChange={(event) => setFilter(event.target.value)} /></label>
          <p className="text-sm text-muted">{visible.length} de {data.roster.length} hermanos</p>
          <div className="overflow-x-auto rounded-sm border border-line"><table className="w-full text-left text-sm">
            <thead><tr className="bg-mist"><th className="p-3">Nombre</th><th className="p-3">Categoría</th><th className="p-3">Estado</th><th className="p-3">Acciones</th></tr></thead>
            <tbody>{visible.map((member) => <tr key={member.id} className="border-t border-line">
              <td className="p-3">{member.fullName}</td><td className="p-3">{member.category}</td>
              <td className="p-3">{member.status}</td><td className="p-3">
                <button type="button" className="underline" onClick={() => openMember(member)}>Editar contacto</button>
              </td></tr>)}</tbody>
          </table></div>
        </section>}
        {data && allowed && view === "users" && <section className="space-y-5">
          <h2 className="font-display text-2xl">Usuarios y accesos</h2>
          <p className="text-sm text-muted">Directorio de cuentas autorizadas. Crear cuentas o modificar roles requiere
            un servicio administrativo seguro; estas operaciones no se realizan desde el navegador.</p>
          <div className="overflow-x-auto rounded-sm border border-line"><table className="w-full text-left text-sm">
            <thead><tr className="bg-mist"><th className="p-3">Usuario</th><th className="p-3">Hermano vinculado</th>
              <th className="p-3">Rol</th><th className="p-3">Acceso</th></tr></thead>
            <tbody>{data.users.map((user) => <tr key={user.id} className="border-t border-line">
              <td className="p-3">{user.username}</td><td className="p-3">{user.hermanoId}</td>
              <td className="p-3">{user.role}</td><td className="p-3">{user.activo ? "Habilitado" : "Deshabilitado"}</td>
            </tr>)}</tbody>
          </table></div>
        </section>}
        {data && allowed && view === "requests" && <section className="space-y-5">
          <h2 className="font-display text-2xl">Solicitudes</h2>
          {requestMessage && <p role="alert" className="text-sm text-red-700">{requestMessage}</p>}
          {role !== "secretaria" && <form onSubmit={(event) => void sendRequest(event)}
            className="space-y-4 rounded-sm border border-line bg-white-warm p-5">
            <h3 className="font-semibold">Nueva solicitud a Secretaría</h3>
            <label className="block space-y-2"><span className="text-sm">Asunto</span>
              <input className="w-full rounded-sm border border-line p-3" required minLength={5} maxLength={120}
                value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} /></label>
            <label className="block space-y-2"><span className="text-sm">Contenido</span>
              <textarea className="w-full rounded-sm border border-line p-3" required minLength={10} maxLength={5000}
                rows={5} value={requestContent} onChange={(event) => setRequestContent(event.target.value)} /></label>
            <button type="submit" disabled={requestBusy}
              className="rounded-sm bg-forest px-4 py-2 text-white disabled:opacity-50">
              {requestBusy ? "Guardando…" : "Enviar solicitud"}</button>
          </form>}
          {data.requests.length === 0 ? <p>No hay solicitudes registradas.</p> :
            data.requests.map((request) => <article key={request.id} className="space-y-3 rounded-sm border border-line p-4">
              <h3 className="font-semibold">{request.title}</h3>
              <p className="text-sm text-muted">{request.status} · {request.submittedAt}</p>
              <p className="whitespace-pre-wrap text-sm">{request.content}</p>
              {role === "secretaria" && request.status !== "resuelta" && <label className="block space-y-2">
                <span className="text-sm">Actualizar seguimiento</span>
                <select className="rounded-sm border border-line bg-white p-2" disabled={requestBusy}
                  value={request.status} onChange={(event) => void changeRequestStatus(request.id, event.target.value as RequestStatus)}>
                  <option value={request.status}>{request.status}</option>
                  {(["en_revision", "derivada", "resuelta"] as const).filter((status) => status !== request.status)
                    .map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>}
            </article>)}
        </section>}
        {data && allowed && (view === "account" || view === "treasury") && <section className="space-y-4">
          <h2 className="font-display text-2xl">{view === "treasury" ? "Tesorería" : "Mi estado de cuenta"}</h2>
          <p className="text-sm text-muted">Movimientos registrados en Firestore, solo lectura.</p>
          {(view === "treasury" ? data.movements : personal).length === 0 ? <p>No hay movimientos registrados.</p> :
            <div className="overflow-x-auto rounded-sm border border-line"><table className="w-full text-left text-sm">
              <thead><tr className="bg-mist"><th className="p-3">Fecha</th><th className="p-3">Descripción</th><th className="p-3">Tipo</th><th className="p-3">Importe</th></tr></thead>
              <tbody>{(view === "treasury" ? data.movements : personal).map((movement) => <tr key={movement.id} className="border-t border-line">
                <td className="p-3">{movement.date}</td><td className="p-3">{movement.description}</td><td className="p-3">{movement.type}</td>
                <td className="p-3">{money(movement.amountCents)}</td></tr>)}</tbody></table></div>}
        </section>}
        {data && allowed && view === "profile" && <section className="space-y-3">
          <h2 className="font-display text-2xl">Mi perfil</h2>
          <p><strong>Nombre:</strong> {data.member.fullName}</p>
          <p><strong>Categoría:</strong> {data.member.category}</p>
          <p><strong>Estado:</strong> {data.member.status}</p>
        </section>}
        {data && <p className="border-t border-line pt-5 text-xs text-muted">
          Portal institucional. El registro de hermanos, las modificaciones de fichas y los cobros
          estarán disponibles cuando sus operaciones seguras estén implementadas.
        </p>}
      </main>
    </div>
  );
}

function Metric({label,value}:{label:string;value:string}) {
  return <div className="rounded-sm border border-line bg-white-warm p-5">
    <p className="text-sm text-muted">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p>
  </div>;
}
