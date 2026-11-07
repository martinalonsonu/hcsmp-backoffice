"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard, UsersRound, ChartNoAxesCombined, ClipboardList, Wallet, UserRound, LogOut, Menu, X, PanelLeftClose, PanelLeftOpen, CircleHelp, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { logoutFirebase, observePortalIdentity, type PortalIdentity } from "@/lib/firebase/auth";
import { readMyMember, readRoster, readRequests, readAccountMovements, readAllMovements, readUserDirectory } from "@/lib/firebase/queries";
import type { MemberRecord, MovementRecord, RequestRecord, UserRecord } from "@/lib/firebase/models";
import { HcsmpBrand } from "@/components/brand/hcsmp-brand";
import { createInstitutionalMember, updateInstitutionalMemberContact, changeMemberCategory, changeMemberLifecycle } from "@/lib/firebase/members";
import {updateAccountAccess} from "@/lib/firebase/user-access";
import type { Category, Guardian } from "@/lib/portal";
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = mobileMenuRef.current;
    if (!dialog) return;
    if (isMobileMenuOpen && !dialog.open) dialog.showModal();
    if (!isMobileMenuOpen && dialog.open) dialog.close();
  }, [isMobileMenuOpen]);
  useEffect(() => { setIsMobileMenuOpen(false); }, [view]);
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState<MemberRow | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<MemberRow | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [nextCategory, setNextCategory] = useState<Category>("activo");
  const [categoryReason, setCategoryReason] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [memberDraft, setMemberDraft] = useState({
    fullName:"",dni:"",birthDate:"",address:"",phone:"",email:"",
    occupation:"",maritalStatus:"",joinedAt:"",swornAt:"",
    category:"activo" as Category, sacraments:[] as string[], guardian:null as Guardian | null,
  });
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
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
              (role === "presidencia" || role === "secretaria") ? readUserDirectory(next) : Promise.resolve([]),
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
    ...(canRoster ? [{view:"users",label:"Usuarios y accesos"}] : []),
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

  async function changeAccount(uid:string, changes:{role?:UserRecord["role"];activo?:boolean}) {
    if (!identity || accountBusy) return;
    setAccountBusy(true);setAccountMessage("");
    try { await updateAccountAccess(identity,uid,changes);setReload((value)=>value+1); }
    catch(cause){setAccountMessage(cause instanceof Error?cause.message:"No se pudo actualizar la cuenta.");}
    finally{setAccountBusy(false);}
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

  async function submitCategoryChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identity || !categoryTarget || memberBusy) return;
    setMemberBusy(true); setMemberMessage("");
    try {
      await changeMemberCategory(identity,categoryTarget.id,nextCategory,categoryReason);
      setCategoryTarget(null); setCategoryReason("");
      setReload((value) => value + 1);
    } catch (cause) {
      setMemberMessage(cause instanceof Error ? cause.message : "No se pudo cambiar la categoría.");
    } finally { setMemberBusy(false); }
  }

  async function submitLifecycleChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identity || !lifecycleTarget || memberBusy) return;
    setMemberBusy(true); setMemberMessage("");
    try {
      await changeMemberLifecycle(identity,lifecycleTarget.id,
        lifecycleTarget.status === "vigente" ? "retiro" : "reingreso",lifecycleReason);
      setLifecycleTarget(null); setLifecycleReason("");
      setReload((value) => value + 1);
    } catch (cause) {
      setMemberMessage(cause instanceof Error ? cause.message : "No se pudo registrar el cambio de estado.");
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
      category:member.category, sacraments:member.sacraments ?? [], guardian:member.guardian ?? null,
    } : {
      fullName:"",dni:"",birthDate:"",address:"",phone:"",email:"",
      occupation:"",maritalStatus:"",joinedAt:"",swornAt:"",
      category:"activo",sacraments:[],guardian:null,
    });
    setMemberFormOpen(true);
  }

  async function signOut() {
    try { await logoutFirebase(); router.replace("/"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cerrar sesión."); }
  }

  const navIcons = {summary:LayoutDashboard,members:UsersRound,treasury:ChartNoAxesCombined,users:ShieldCheck,requests:ClipboardList,account:Wallet,profile:UserRound};
  const navItems = items.map(item=>({...item,Icon:navIcons[item.view as keyof typeof navIcons] ?? LayoutDashboard}));
  const navLink = (item:typeof navItems[number],mobile=false) => (
    <Link key={item.view} href={item.view==="summary"?"/dashboard":`/dashboard?view=${item.view}`}
      aria-current={view===item.view?"page":undefined} aria-label={item.label}
      title={!mobile&&isCollapsed?item.label:undefined}
      onClick={mobile?()=>setIsMobileMenuOpen(false):undefined}
      className={`flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm transition-colors ${view===item.view?"bg-mist font-semibold text-ink":"text-muted hover:bg-mist/70 hover:text-ink"} ${!mobile&&isCollapsed?"lg:justify-center lg:px-0":""}`}>
      <item.Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8}/>
      <span className={!mobile&&isCollapsed?"lg:sr-only":"truncate"}>{item.label}</span>
    </Link>
  );
  const help = <div className="rounded-sm border border-line bg-paper p-3 text-xs text-muted">
    <div className="flex items-center gap-2 font-semibold text-ink"><CircleHelp className="size-4"/>¿Necesitas ayuda?</div>
    <p className="mt-2">Comunícate con la junta directiva para consultas sobre el portal.</p>
  </div>;
  return (
    <div className={`min-h-screen bg-paper lg:grid ${isCollapsed?"lg:grid-cols-[5rem_minmax(0,1fr)]":"lg:grid-cols-[16rem_minmax(0,1fr)]"}`}>
      <aside className="hidden border-r border-line bg-white-warm lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className={`flex items-center justify-between p-5 ${isCollapsed?"lg:justify-center":""}`}>
          {!isCollapsed&&<Link href="/dashboard" aria-label="HCSMP, ir al resumen"><HcsmpBrand iconOnly/></Link>}
          <button type="button" aria-label={isCollapsed?"Expandir menú":"Contraer menú"}
            aria-expanded={!isCollapsed} aria-controls="firebase-dashboard-navigation"
            onClick={()=>setIsCollapsed(v=>!v)} className="grid size-10 place-items-center rounded-sm hover:bg-mist">
            {isCollapsed?<PanelLeftOpen className="size-5"/>:<PanelLeftClose className="size-5"/>}
          </button>
        </div>
        <nav id="firebase-dashboard-navigation" aria-label="Navegación principal" className="space-y-1 px-3 py-4">
          {!isCollapsed&&<p className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-muted">Espacio de trabajo</p>}
          {navItems.map(item=>navLink(item))}
        </nav>
        <div className="mt-auto space-y-3 p-3">
          {!isCollapsed&&help}
          <button type="button" onClick={()=>void signOut()} title="Cerrar sesión" aria-label="Cerrar sesión"
            className={`flex w-full items-center gap-3 rounded-sm p-3 text-sm hover:bg-mist ${isCollapsed?"justify-center":""}`}>
            <LogOut className="size-5"/>{!isCollapsed&&"Cerrar sesión"}
          </button>
        </div>
      </aside>
      <dialog ref={mobileMenuRef} id="firebase-mobile-navigation" aria-label="Menú de navegación"
        onCancel={e=>{e.preventDefault();setIsMobileMenuOpen(false);}}
        onClick={e=>{if(e.target===e.currentTarget)setIsMobileMenuOpen(false);}}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-ink/50 lg:hidden">
        <div className="flex h-full">
          <aside className="flex h-full w-[min(18rem,85vw)] flex-col border-r border-line bg-white-warm shadow-xl">
            <div className="flex items-center justify-between border-b border-line p-5">
              <Link href="/dashboard" onClick={()=>setIsMobileMenuOpen(false)} aria-label="HCSMP, ir al resumen"><HcsmpBrand iconOnly/></Link>
              <button type="button" aria-label="Cerrar menú" onClick={()=>setIsMobileMenuOpen(false)} className="grid size-10 place-items-center"><X className="size-5"/></button>
            </div>
            <nav aria-label="Navegación móvil" className="flex-1 space-y-1 overflow-y-auto p-3">
              <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-widest text-muted">Espacio de trabajo</p>
              {navItems.map(item=>navLink(item,true))}
            </nav>
            <div className="space-y-3 border-t border-line p-4">{help}
              <button type="button" onClick={()=>{setIsMobileMenuOpen(false);void signOut();}} className="flex items-center gap-3 p-2 text-sm">
                <LogOut className="size-5"/>Cerrar sesión
              </button>
            </div>
          </aside>
          <div className="min-w-0 flex-1" aria-hidden="true"/>
        </div>
      </dialog>
      <div className="min-w-0">
        <header className="flex min-h-18 items-center justify-between border-b border-line bg-white-warm/80 px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label="Abrir menú" aria-controls="firebase-mobile-navigation"
              aria-expanded={isMobileMenuOpen} onClick={()=>setIsMobileMenuOpen(true)}
              className="grid size-10 place-items-center rounded-sm hover:bg-mist lg:hidden"><Menu className="size-5"/></button>
            <p className="truncate text-xs text-muted sm:text-sm"><span className="sm:hidden">Portal HCSMP</span>
              <span className="hidden sm:inline">Hermandad de Cargadores de San Martín de Porres</span></p>
          </div>
          <div className="flex items-center gap-3">
            {data&&<span className="hidden text-right sm:block">
              <span className="block text-xs font-semibold">{data.member.fullName}</span>
              <span className="block text-xs text-muted">{role} · {data.member.category}</span>
            </span>}
            {data&&<span role="img" aria-label={data.member.fullName} className="grid size-9 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">
              {data.member.fullName.split(" ").slice(0,2).map(word=>word[0]).join("")}
            </span>}
          </div>
        </header>
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
          <label className="block space-y-2"><span className="text-sm">Buscar por nombre</span>
            <input type="search" className="block w-full rounded-sm border border-line bg-white p-3" value={filter}
              onChange={(event) => setFilter(event.target.value)} /></label>
          <p className="text-sm text-muted">{visible.length} de {data.roster.length} hermanos</p>
          <div className="overflow-x-auto rounded-sm border border-line"><table className="w-full text-left text-sm">
            <thead><tr className="bg-mist"><th className="p-3">Nombre</th><th className="p-3">Categoría</th><th className="p-3">Estado</th><th className="p-3">Acciones</th></tr></thead>
            <tbody>{visible.map((member) => <tr key={member.id} className="border-t border-line">
              <td className="p-3">{member.fullName}</td><td className="p-3">{member.category}</td>
              <td className="p-3">{member.status}</td><td className="p-3">
                <button type="button" className="underline" onClick={() => openMember(member)}>Editar ficha</button>
                {role === "secretaria" && member.status === "vigente" && <button type="button" className="ml-3 underline"
                  onClick={() => { setCategoryTarget(member); setNextCategory(member.category); setCategoryReason(""); setMemberMessage(""); }}>
                  Cambiar categoría
                </button>}
                {role === "secretaria" && <button type="button" className="ml-3 underline"
                  onClick={() => { setLifecycleTarget(member); setLifecycleReason(""); setMemberMessage(""); }}>
                  {member.status === "vigente" ? "Registrar retiro" : "Registrar reingreso"}
                </button>}
              </td></tr>)}</tbody>
          </table></div>
        </section>}
        {data && allowed && view === "users" && <section className="space-y-5">
          <h2 className="font-display text-2xl">Usuarios y accesos</h2>
          <p className="text-sm text-muted">Las cuentas se vinculan con las fichas institucionales por hermanoId.
            Secretaría administra roles y accesos; Presidencia consulta.</p>
          <p className="text-sm text-muted">Crear credenciales de Firebase Authentication requiere un proceso administrativo seguro.
            No se crean cuentas de acceso escribiendo solamente documentos en Firestore.</p>
          {accountMessage && <p role="alert" className="text-sm text-red-700">{accountMessage}</p>}
          <div className="overflow-x-auto rounded-sm border border-line"><table className="w-full text-left text-sm">
            <thead><tr className="bg-mist"><th className="p-3">Usuario</th><th className="p-3">Hermano vinculado</th>
              <th className="p-3">Rol</th><th className="p-3">Acceso</th></tr></thead>
            <tbody>{data.users.map((user) => <tr key={user.id} className="border-t border-line">
              <td className="p-3">{user.username}</td>
              <td className="p-3">{data.roster.find((member)=>member.id===user.hermanoId)?.fullName ?? user.hermanoId}</td>
              <td className="p-3">{role==="secretaria" && user.id!==identity?.uid ?
                <select aria-label={`Rol de ${user.username}`} className="border border-line p-2" disabled={accountBusy}
                  value={user.role} onChange={(event)=>void changeAccount(user.id,{role:event.target.value as UserRecord["role"]})}>
                  {(["estandar","tesoreria","secretaria","presidencia"] as const).map((item)=>
                    <option key={item} value={item}>{item}</option>)}
                </select> : user.role}</td>
              <td className="p-3">{role==="secretaria" && user.id!==identity?.uid ?
                <button type="button" disabled={accountBusy} className="underline"
                  onClick={()=>void changeAccount(user.id,{activo:!user.activo})}>
                  {user.activo?"Deshabilitar":"Habilitar"}
                </button> : user.activo?"Habilitado":"Deshabilitado"}</td>
            </tr>)}</tbody>
          </table></div>
          <h3 className="font-semibold">Hermanos sin cuenta vinculada</h3>
          <div className="space-y-2">{data.roster.filter((member)=>!data.users.some((user)=>user.hermanoId===member.id))
            .map((member)=><p key={member.id} className="text-sm">{member.fullName} · {member.dni || "Sin DNI"}</p>)}</div>
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
      {lifecycleTarget && role === "secretaria" && <div role="dialog" aria-modal="true" aria-labelledby="lifecycle-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <form onSubmit={(event) => void submitLifecycleChange(event)}
          className="w-full max-w-lg space-y-5 rounded-sm bg-white-warm p-6">
          <h2 id="lifecycle-title" className="font-display text-2xl">
            {lifecycleTarget.status === "vigente" ? "Registrar retiro" : "Registrar reingreso"}
          </h2>
          <p className="text-sm">{lifecycleTarget.fullName} · Estado actual: <strong>{lifecycleTarget.status}</strong></p>
          <p className="text-sm text-muted">{lifecycleTarget.status === "vigente"
            ? "El hermano pasará a retirado y perderá acceso al portal. Su ficha, historial y movimientos económicos se conservan."
            : "El hermano regresará como reingresante, sin recuperar automáticamente su categoría anterior. La admisión posterior como activo corresponde a Secretaría."}</p>
          <label className="block space-y-2 text-sm"><span>Motivo o referencia al acuerdo (obligatorio)</span>
            <textarea required minLength={10} maxLength={500} rows={4}
              className="w-full rounded-sm border border-line p-3"
              value={lifecycleReason} onChange={(event) => setLifecycleReason(event.target.value)}/>
          </label>
          {memberMessage && <p role="alert" className="text-sm text-red-700">{memberMessage}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={memberBusy} className="rounded-sm border border-line px-4 py-2"
              onClick={() => setLifecycleTarget(null)}>Cancelar</button>
            <button type="submit" disabled={memberBusy}
              className="rounded-sm bg-forest px-4 py-2 text-white disabled:opacity-50">
              {memberBusy ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </div>}
      {categoryTarget && role === "secretaria" && <div role="dialog" aria-modal="true" aria-labelledby="category-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <form onSubmit={(event) => void submitCategoryChange(event)} className="w-full max-w-lg space-y-5 rounded-sm bg-white-warm p-6">
          <h2 id="category-title" className="font-display text-2xl">Cambio de categoría</h2>
          <p className="text-sm">{categoryTarget.fullName} · Categoría actual: <strong>{categoryTarget.category}</strong></p>
          <label className="block space-y-2 text-sm"><span>Nueva categoría</span>
            <select className="w-full rounded-sm border border-line p-3" value={nextCategory}
              onChange={(event) => setNextCategory(event.target.value as Category)}>
              {(["postulante","reingresante","activo","vitalicio"] as const).map((category) =>
                <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="block space-y-2 text-sm"><span>Motivo del cambio (obligatorio)</span>
            <textarea className="w-full rounded-sm border border-line p-3" minLength={10} maxLength={500}
              required rows={4} value={categoryReason} onChange={(event) => setCategoryReason(event.target.value)}/>
          </label>
          <p className="text-xs text-muted">La operación registrará un evento permanente en el historial institucional.</p>
          {memberMessage && <p role="alert" className="text-sm text-red-700">{memberMessage}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={memberBusy} className="rounded-sm border border-line px-4 py-2"
              onClick={() => setCategoryTarget(null)}>Cancelar</button>
            <button type="submit" disabled={memberBusy || nextCategory === categoryTarget.category}
              className="rounded-sm bg-forest px-4 py-2 text-white disabled:opacity-50">
              {memberBusy ? "Guardando…" : "Confirmar cambio"}</button>
          </div>
        </form>
      </div>}
          {memberFormOpen && <div role="dialog" aria-modal="true" aria-labelledby="member-dialog-title"
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-paper">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-white-warm px-5 py-4 sm:px-10">
              <div><p className="eyebrow">Gestión institucional</p><h2 id="member-dialog-title" className="font-display text-xl sm:text-2xl">{editingMember ? "Editar hermano" : "Registrar nuevo hermano"}</h2></div>
              <button type="button" disabled={memberBusy} aria-label="Cerrar formulario" onClick={() => setMemberFormOpen(false)} className="rounded-sm border border-line px-4 py-2 text-sm hover:bg-mist disabled:opacity-50">Cerrar</button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-10">
            <form id="member-form" onSubmit={(event) => void saveMember(event)}
              className="mx-auto max-w-5xl space-y-6 pb-24">
            <h3 className="font-semibold">{editingMember ? "Editar información personal, sacramental y del apoderado" : "Datos de la ficha institucional"}</h3>
            <p className="text-sm text-muted">{editingMember ? "El DNI, la categoría, el estado y las fechas institucionales no pueden modificarse desde esta edición. Los cambios de categoría y estado corresponden exclusivamente a Secretaría." : "Registrar un hermano no crea una cuenta de acceso al portal."}</p>
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
            <>
              <section className="space-y-3 border-t border-line pt-6">
                <h3 className="font-semibold">Vida sacramental</h3>
                <p className="text-sm text-muted">Selecciona los sacramentos recibidos.</p>
                <div className="flex flex-wrap gap-4">
                  {["Bautismo","Primera Comunión","Confirmación","Matrimonio"].map((sacrament) =>
                    <label key={sacrament} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={memberDraft.sacraments.includes(sacrament)}
                        onChange={(event) => setMemberDraft((current) => ({
                          ...current, sacraments:event.target.checked
                            ? [...current.sacraments,sacrament]
                            : current.sacraments.filter((item) => item !== sacrament),
                        }))}/>{sacrament}
                    </label>)}
                </div>
              </section>
              <section className="space-y-3 border-t border-line pt-6">
                <label className="flex items-center gap-3 font-semibold">
                  <input type="checkbox" checked={memberDraft.guardian !== null}
                    onChange={(event) => setMemberDraft((current) => ({
                      ...current, guardian:event.target.checked
                        ? {fullName:"",dni:"",education:"",address:"",phone:"",relationship:"",age:"",sacraments:[]}
                        : null,
                    }))}/>
                  Registrar padre, madre o apoderado
                </label>
                {memberDraft.guardian && <div className="grid gap-4 sm:grid-cols-2">
                  {([
                    ["fullName","Nombres y apellidos"],["dni","DNI"],["relationship","Parentesco"],
                    ["age","Edad"],["education","Grado de instrucción"],
                    ["address","Dirección"],["phone","Teléfono"],
                  ] as const).map(([key,label]) => <label key={key} className="space-y-2 text-sm">
                    <span className="block">{label}</span>
                    <input className="w-full rounded-sm border border-line bg-white p-3"
                      required={key === "fullName"} value={memberDraft.guardian?.[key] ?? ""}
                      onChange={(event) => setMemberDraft((current) => ({
                        ...current, guardian:current.guardian
                          ? {...current.guardian,[key]:event.target.value} : null,
                      }))}/>
                  </label>)}
                  <fieldset className="space-y-2 sm:col-span-2">
                    <legend className="text-sm">Sacramentos del apoderado</legend>
                    <div className="flex flex-wrap gap-4">
                      {["Bautismo","Primera Comunión","Confirmación","Matrimonio"].map((sacrament) =>
                        <label key={sacrament} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={memberDraft.guardian?.sacraments.includes(sacrament) ?? false}
                            onChange={(event) => setMemberDraft((current) => ({
                              ...current, guardian:current.guardian
                                ? {...current.guardian,sacraments:event.target.checked
                                    ? [...current.guardian.sacraments,sacrament]
                                    : current.guardian.sacraments.filter((item) => item !== sacrament)}
                                : null,
                            }))}/>{sacrament}
                        </label>)}
                    </div>
                  </fieldset>
                </div>}
              </section>
            </>
            {memberMessage && <p role="alert" className="text-sm text-red-700">{memberMessage}</p>}
            <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
              <button type="button" disabled={memberBusy} onClick={() => setMemberFormOpen(false)} className="rounded-sm border border-line px-5 py-3">Cancelar</button>
              <button type="submit" disabled={memberBusy} className="rounded-sm bg-forest px-5 py-3 text-white disabled:opacity-50">
                {memberBusy ? "Guardando…" : editingMember ? "Guardar contacto" : "Registrar hermano"}
              </button>
            </div>
          </form>
          </div>
          </div>}

      </div>
    </div>
  );
}

function Metric({label,value}:{label:string;value:string}) {
  return <div className="rounded-sm border border-line bg-white-warm p-5">
    <p className="text-sm text-muted">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p>
  </div>;
}
