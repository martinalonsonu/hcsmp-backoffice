"use client";

import { useEffect, useState } from "react";
import { Inbox, LoaderCircle, LockKeyhole, LockKeyholeOpen, ShieldCheck, UsersRound } from "lucide-react";
import { ActionIcon } from "@/components/dashboard/action-icon";
import { useLoadedPortal, type MemberRow } from "@/components/dashboard/portal-session";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { roleLabels, type Role } from "@/lib/portal";
import type { UserRecord } from "@/lib/firebase/models";
import { authorizeExistingMember } from "@/lib/firebase/members";
import { readRoster } from "@/lib/firebase/queries";
import { updateAccountAccess, updatePendingAccess } from "@/lib/firebase/user-access";

const roleOptions = ["estandar", "tesoreria", "secretaria", "presidencia"] as const;

export function UsersView() {
  const { data, identity, role, reload } = useLoadedPortal();
  const [roster, setRoster] = useState<MemberRow[] | null>(null);
  const [rosterError, setRosterError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void readRoster(identity)
      .then((rows) => { if (active) { setRoster(rows); setRosterError(""); } })
      .catch((cause) => { if (active) setRosterError(cause instanceof Error ? cause.message : "No se pudo consultar el padrón."); });
    return () => { active = false; };
  }, [identity, data]);

  const pendingEnrollments = data.enrollments.filter((entry) => entry.uid === null);
  const unlinkedMembers = (roster ?? []).filter((member) => !data.users.some((user) => user.hermanoId === member.id) &&
    !data.enrollments.some((entry) => entry.hermanoId === member.id));
  const nameOf = (memberId: string) => roster?.find((member) => member.id === memberId)?.fullName ?? memberId;

  async function run(id: string, action: () => Promise<unknown>, fallback: string) {
    if (busy) return;
    setBusy(true); setBusyId(id); setMessage("");
    try { await action(); reload(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : fallback); }
    finally { setBusy(false); setBusyId(null); }
  }
  const changeAccount = (uid: string, changes: { role?: UserRecord["role"]; activo?: boolean }) =>
    run(uid, () => updateAccountAccess(identity, uid, changes), "No se pudo actualizar la cuenta.");
  const changePending = (email: string, changes: { role?: Role; activo?: boolean }) =>
    run(email, () => updatePendingAccess(identity, email, changes), "No se pudo actualizar el acceso pendiente.");
  const authorizeMember = (memberId: string) =>
    run(memberId, () => authorizeExistingMember(identity, memberId, "estandar"), "No se pudo autorizar el acceso.");

  return (
    <>
      <PageHeader eyebrow={`${role === "secretaria" ? "Secretaría" : "Presidencia · Solo consulta"} · Seguridad`}
        title="Usuarios y accesos"
        description="Las cuentas se vinculan con las fichas institucionales. Secretaría administra roles y accesos; Presidencia consulta. Los hermanos activan su cuenta con el correo autorizado por Secretaría." />
      {message && <Alert variant="error">{message}</Alert>}
      {rosterError && <Alert variant="error">{rosterError}</Alert>}
      {!roster && !rosterError && <Alert variant="loading">Cargando fichas de los hermanos…</Alert>}
      {roster && <>
        <Panel aria-labelledby="accounts-title">
          <PanelHeader id="accounts-title" title="Cuentas activas" description="Usuarios con acceso al portal."
            aside={<><span className="font-semibold tabular-nums text-ink">{data.users.length}</span> {data.users.length === 1 ? "cuenta" : "cuentas"}</>} />
          <PanelBody>
            {data.users.length ? <DataTable caption="Cuentas de usuario" rows={data.users} rowKey={(user) => user.id}
              columns={[
                {header:"Usuario", kind:"primary", cell:(user) => <span className="font-medium text-ink">{user.username}</span>},
                {header:"Hermano vinculado", cell:(user) => nameOf(user.hermanoId)},
                {header:"Rol", cell:(user) => role === "secretaria" && user.id !== identity.uid ?
                  <Select aria-label={`Rol de ${user.username}`} className="h-10 min-w-40" disabled={busy}
                    value={user.role} onChange={(event) => void changeAccount(user.id, {role: event.target.value as UserRecord["role"]})}>
                    {roleOptions.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
                  </Select> : <Badge variant="accent">{roleLabels[user.role]}</Badge>},
                {header:"Acceso", cell:(user) => <div className="flex items-center gap-2">
                  <Badge variant={user.activo ? "success" : "muted"}>{user.activo ? "Habilitado" : "Deshabilitado"}</Badge>
                  {role === "secretaria" && user.id !== identity.uid && <ActionIcon disabled={busy}
                    label={`${user.activo ? "Deshabilitar" : "Habilitar"} acceso de ${user.username}`}
                    onClick={() => void changeAccount(user.id, {activo: !user.activo})}>
                    {busyId === user.id ? <LoaderCircle className="size-4 animate-spin"/> :
                      user.activo ? <LockKeyhole className="size-4"/> : <LockKeyholeOpen className="size-4"/>}
                  </ActionIcon>}
                </div>},
              ]} /> : <EmptyState icon={ShieldCheck} title="No hay cuentas registradas" />}
          </PanelBody>
        </Panel>
        <Panel aria-labelledby="pending-title">
          <PanelHeader id="pending-title" title="Accesos pendientes de activación" description="Autorizados por Secretaría, aún sin activar su cuenta."
            aside={<><span className="font-semibold tabular-nums text-ink">{pendingEnrollments.length}</span> {pendingEnrollments.length === 1 ? "pendiente" : "pendientes"}</>} />
          <PanelBody>
            {pendingEnrollments.length ? <DataTable caption="Accesos pendientes de activación" rows={pendingEnrollments} rowKey={(entry) => entry.id}
              columns={[
                {header:"Hermano", kind:"primary", cell:(entry) => <>
                  <span className="block font-medium text-ink">{nameOf(entry.hermanoId)}</span>
                  <span className="mt-1 block break-all text-xs text-muted">{entry.id}</span>
                </>},
                {header:"Perfil", cell:(entry) => role === "secretaria" ?
                  <Select aria-label={`Perfil pendiente de ${entry.id}`} className="h-10 min-w-40" disabled={busy}
                    value={entry.role} onChange={(event) => void changePending(entry.id, {role: event.target.value as Role})}>
                    {roleOptions.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
                  </Select> : <Badge variant="accent">{roleLabels[entry.role]}</Badge>},
                {header:"Estado", cell:(entry) => <Badge variant={entry.activo ? "success" : "muted"}>{entry.activo ? "Habilitado" : "Deshabilitado"}</Badge>},
                ...(role === "secretaria" ? [{header:"Acciones", kind:"actions" as const, cell:(entry: typeof pendingEnrollments[number]) =>
                  <Button type="button" variant="outline" size="sm" disabled={busy}
                    onClick={() => void changePending(entry.id, {activo: !entry.activo})}>
                    {busyId === entry.id ? "Guardando…" : entry.activo ? "Deshabilitar" : "Habilitar"}
                  </Button>}] : []),
              ]} /> : <EmptyState icon={Inbox} title="No hay accesos pendientes" description="Todos los accesos autorizados ya fueron activados." />}
          </PanelBody>
        </Panel>
        <Panel aria-labelledby="unlinked-title">
          <PanelHeader id="unlinked-title" title="Hermanos sin cuenta vinculada" description="Fichas que todavía no tienen acceso al portal."
            aside={<><span className="font-semibold tabular-nums text-ink">{unlinkedMembers.length}</span> {unlinkedMembers.length === 1 ? "hermano" : "hermanos"}</>} />
          <PanelBody>
            {unlinkedMembers.length ? <DataTable caption="Hermanos sin cuenta vinculada" rows={unlinkedMembers} rowKey={(member) => member.id}
              columns={[
                {header:"Hermano", kind:"primary", cell:(member) => <>
                  <span className="block font-medium text-ink">{member.fullName}</span>
                  <span className="mt-1 block break-all text-xs text-muted">{member.email || "Sin correo"}</span>
                </>},
                ...(role === "secretaria" ? [{header:"Acciones", kind:"actions" as const, cell:(member: typeof unlinkedMembers[number]) =>
                  member.status === "vigente" ? <Button type="button" variant="outline" size="sm" disabled={busy}
                    onClick={() => void authorizeMember(member.id)}>
                    {busyId === member.id ? "Guardando…" : "Autorizar acceso Estándar"}
                  </Button> : <span className="text-xs text-muted">Hermano retirado</span>}] : []),
              ]} /> : <EmptyState icon={UsersRound} title="Todos los hermanos tienen acceso" description="No hay fichas sin cuenta vinculada o pendiente." />}
          </PanelBody>
        </Panel>
      </>}
    </>
  );
}
