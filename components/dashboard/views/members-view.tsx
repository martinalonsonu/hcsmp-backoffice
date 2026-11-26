"use client";

import { useState } from "react";
import {
  ArrowLeftRight, FileDown, FileSpreadsheet, LoaderCircle, Pencil, RotateCcw, Search, SlidersHorizontal, UserMinus, UserPlus, UsersRound, X,
} from "lucide-react";
import { ActionIcon } from "@/components/dashboard/action-icon";
import { useLoadedPortal, type MemberRow } from "@/components/dashboard/portal-session";
import { MemberRosterImport } from "@/components/members/member-roster-import";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select, Textarea } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  categoryLabels, isTrialCategory, roleLabels, statusLabels, type Category, type Role,
} from "@/lib/portal";
import {
  birthMonths, hasSacrament, rosterSacraments, type MemberSex, type RosterFilters,
} from "@/lib/member-roster";
import { emptyRosterFilters, useRoster } from "@/hooks/use-roster";
import { useMemberManagement } from "@/hooks/use-member-management";

const checkOptionClass = "inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border border-line bg-white-warm px-3.5 text-sm transition-colors hover:bg-paper has-[:checked]:border-clay has-[:checked]:bg-paper";
export function MembersView() {
  const { role, reload } = useLoadedPortal();
  const [importOpen, setImportOpen] = useState(false);
  const {
    draftFilters, setDraftFilters, filtersOpen, setFiltersOpen, rosterPage,
    rosterResult, rosterError, rosterDownloadBusy, rosterDownloadError,
    coverage, coverageReady, pageCount, pageMembers, appliedChips, draftEmpty,
    searching, openFilters, setDraftFilter, applyFilters, removeFilter,
    clearAppliedFilters, previousPage, nextPage, exportRoster,
  } = useRoster();
  const {
    memberBusy, categoryTarget, categoryOpen, setCategoryOpen, lifecycleTarget,
    lifecycleOpen, setLifecycleOpen, lifecycleReason, setLifecycleReason,
    nextCategory, setNextCategory, categoryReason, setCategoryReason, memberMessage,
    memberFormOpen, setMemberFormOpen, newMemberRole, setNewMemberRole,
    editingMember, memberDraft, setMemberDraft, saveMember, submitCategoryChange,
    submitLifecycleChange, openMember, openCategory, openLifecycle,
  } = useMemberManagement();

  function renderMemberActions(member: MemberRow) {
    return <>
      <ActionIcon label={`Editar ficha de ${member.fullName}`} onClick={() => openMember(member)}>
        <Pencil className="size-4"/>
      </ActionIcon>
      {role === "secretaria" && member.status === "vigente" && <ActionIcon
        label={`Cambiar categoría de ${member.fullName}`}
        onClick={() => openCategory(member)}>
        <ArrowLeftRight className="size-4"/>
      </ActionIcon>}
      {role === "secretaria" && <ActionIcon
        label={`${member.status === "vigente" ? "Registrar retiro" : "Registrar reingreso"} de ${member.fullName}`}
        onClick={() => openLifecycle(member)}>
        {member.status === "vigente" ? <UserMinus className="size-4"/> : <UserPlus className="size-4"/>}
      </ActionIcon>}
    </>;
  }

  return (
    <>
      <PageHeader eyebrow={`${role === "secretaria" ? "Secretaría" : "Presidencia · Solo consulta"} · Directorio institucional`}
        title="Padrón de hermanos"
        description="Consulta las fichas y usa Filtros para buscar por nombre, DNI, categoría y más."
        actions={<div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="flex-1 px-4 sm:flex-none sm:px-5" aria-haspopup="dialog" onClick={openFilters}>
            <SlidersHorizontal aria-hidden="true" className="size-4"/> Filtros
            {appliedChips.length > 0 && <span aria-label={`${appliedChips.length} aplicados`}
              className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold tabular-nums text-paper">{appliedChips.length}</span>}
          </Button>
          {role === "secretaria" && <Button className="flex-1 px-4 sm:flex-none sm:px-5" onClick={() => openMember(null)}>
            <UserPlus aria-hidden="true" className="size-4"/> Registrar hermano
          </Button>}
          {role === "secretaria" && <Button type="button" variant="outline" className="flex-1 px-4 sm:flex-none sm:px-5"
            onClick={() => setImportOpen(true)}>
            <FileSpreadsheet aria-hidden="true" className="size-4"/> Importar Excel
          </Button>}
        </div>} />
      {rosterDownloadError && <Alert variant="error">{rosterDownloadError}</Alert>}
      {coverage && !coverageReady && <Alert variant="error">
        El padrón está en preparación. Contacta al administrador del sistema.
      </Alert>}
      {rosterError && <Alert variant="error">{rosterError}</Alert>}
      <Panel aria-labelledby="roster-results-title">
        <PanelHeader id="roster-results-title" title="Resultados"
          aside={<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {rosterResult && <span aria-live="polite"><span className="font-semibold tabular-nums text-ink">{rosterResult.count}</span> {rosterResult.count === 1 ? "resultado" : "resultados"} de {coverage?.total ?? 0} {coverage?.total === 1 ? "hermano" : "hermanos"}</span>}
            <Button type="button" variant="outline" size="sm" disabled={!rosterResult?.count || rosterDownloadBusy}
              onClick={() => void exportRoster()}>
              {rosterDownloadBusy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin"/> : <FileDown aria-hidden="true" className="size-4"/>}
              {rosterDownloadBusy ? "Preparando PDF…" : "Exportar resultados (PDF)"}
            </Button>
          </div>} />
        <PanelBody className="space-y-5">
          {appliedChips.length > 0 && <div role="group" aria-label="Filtros aplicados" className="flex flex-wrap items-center gap-2">
            {appliedChips.map((chip) => <span key={chip.key}
              className="inline-flex items-center gap-1 rounded-full bg-mist py-1 pl-3 pr-1 text-xs font-medium text-ink">
              {chip.label}
              <button type="button" aria-label={`Quitar filtro: ${chip.label}`} disabled={searching} onClick={() => removeFilter(chip.key)}
                className="grid size-5 place-items-center rounded-full transition-colors hover:bg-line focus-visible:ring-2 focus-visible:ring-clay disabled:opacity-50">
                <X aria-hidden="true" className="size-3"/>
              </button>
            </span>)}
            <Button type="button" variant="ghost" size="sm" disabled={searching} onClick={clearAppliedFilters}>Limpiar filtros</Button>
          </div>}
          {!rosterResult && !rosterError && coverageReady &&
            <Alert variant="loading">Consultando padrón…</Alert>}
          {rosterResult?.count ? <DataTable caption="Resultados del padrón de hermanos" rows={pageMembers} rowKey={(member) => member.id}
            columns={[
              {header:"Hermano", kind:"primary", cell:(member) => <>
                <span className="block font-medium text-ink">{member.fullName}</span>
                <span className="mt-1 block text-xs text-muted">DNI {member.dni || "Sin registrar"}</span>
              </>},
              {header:"Categoría", cell:(member) => <div>
                <Badge variant={isTrialCategory(member.category) ? "muted" : "accent"}>{categoryLabels[member.category]}</Badge>
                {member.nonResidentHuacho && <span className="mt-1 block text-xs text-muted">No residente en Huacho</span>}
              </div>},
              {header:"Estado", cell:(member) => <Badge variant={member.status === "vigente" ? "success" : "muted"}>{statusLabels[member.status]}</Badge>},
              {header:"Acciones", kind:"actions", cell:(member) => renderMemberActions(member)},
            ]} /> : rosterResult && <EmptyState icon={UsersRound} title="No encontramos coincidencias"
              description="Prueba con otro nombre, DNI o ajusta los filtros.">
              {appliedChips.length > 0 && <Button type="button" variant="outline" size="sm" onClick={clearAppliedFilters}>
                <RotateCcw aria-hidden="true" className="size-4"/> Limpiar filtros
              </Button>}
            </EmptyState>}
          {rosterResult && <nav aria-label="Paginación del padrón" className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <Button type="button" variant="outline" size="sm" disabled={rosterPage === 1}
              onClick={previousPage}>Anterior</Button>
            <span className="text-muted">Página <span className="font-medium text-ink">{rosterPage}</span> de <span className="font-medium text-ink">{pageCount}</span></span>
            <Button type="button" variant="outline" size="sm" disabled={!rosterResult.last || rosterPage >= pageCount}
              onClick={nextPage}>Siguiente</Button>
          </nav>}
        </PanelBody>
      </Panel>
      <Modal open={filtersOpen} size="drawer" title="Filtros"
        description="Combina los campos y presiona Buscar para actualizar la lista."
        onClose={() => setFiltersOpen(false)} onSubmit={applyFilters}
        footer={<>
          <Button type="button" variant="outline" disabled={draftEmpty} onClick={() => setDraftFilters({...emptyRosterFilters})}>
            <RotateCcw aria-hidden="true" className="size-4"/> Limpiar
          </Button>
          <Button type="submit" disabled={!coverageReady || searching}>
            {searching ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin"/> : <Search aria-hidden="true" className="size-4"/>}
            {searching ? "Buscando…" : "Buscar"}
          </Button>
        </>}>
        <div className="grid gap-4">
          <Field label="Nombre o DNI">
            <span className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"/>
              <Input type="search" maxLength={120} autoComplete="off" className="pl-10"
                aria-label="Buscar por inicio de nombre o DNI"
                placeholder="Inicio del nombre o número de DNI"
                value={draftFilters.search}
                onChange={(event) => setDraftFilter("search", event.target.value)}/>
            </span>
          </Field>
          <Field label="Sexo">
            <Select value={draftFilters.sex}
              onChange={(event) => setDraftFilter("sex", event.target.value as RosterFilters["sex"])}>
              <option value="">Todos</option><option value="varon">Varón</option><option value="dama">Dama</option>
            </Select></Field>
          <Field label="Padre o madre">
            <Select value={draftFilters.parent}
              onChange={(event) => setDraftFilter("parent", event.target.value as RosterFilters["parent"])}>
              <option value="">Todos</option><option value="padre">Padres</option><option value="madre">Madres</option>
            </Select></Field>
          <Field label="Edad">
            <Select value={draftFilters.ageGroup}
              onChange={(event) => setDraftFilter("ageGroup", event.target.value as RosterFilters["ageGroup"])}>
              <option value="">Todas las edades</option><option value="mayores">Mayores de edad</option><option value="menores">Menores de edad</option>
            </Select></Field>
          <Field label="Categoría">
            <Select value={draftFilters.category}
              onChange={(event) => setDraftFilter("category", event.target.value as RosterFilters["category"])}>
              <option value="">Todas las categorías</option>{Object.entries(categoryLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </Select></Field>
          <Field label="Mes de cumpleaños">
            <Select value={draftFilters.birthMonth}
              onChange={(event) => setDraftFilter("birthMonth", event.target.value)}>
              <option value="">Todos los meses</option>{birthMonths.map((month,index) => <option key={month} value={String(index + 1).padStart(2,"0")}>{month}</option>)}
            </Select></Field>
          <Field label="Sacramento recibido">
            <Select value={draftFilters.sacrament}
              onChange={(event) => setDraftFilter("sacrament", event.target.value)}>
              <option value="">Todos los sacramentos</option>{rosterSacraments.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select></Field>
        </div>
        <p className="text-xs leading-5 text-muted">
          Los filtros se combinan. Las fichas sin sexo, hijos o fecha registrados no aparecen en los filtros correspondientes.
        </p>
      </Modal>
      {lifecycleTarget && role === "secretaria" && <Modal open={lifecycleOpen} eyebrow="Gestión institucional"
        title={lifecycleTarget.status === "vigente" ? "Registrar retiro" : "Registrar reingreso"}
        busy={memberBusy} onClose={() => setLifecycleOpen(false)} onSubmit={(event) => void submitLifecycleChange(event)}
        footer={<>
          <Button type="button" variant="outline" disabled={memberBusy} onClick={() => setLifecycleOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={memberBusy}>
            {memberBusy ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin"/> Guardando…</> : "Confirmar"}
          </Button>
        </>}>
        <div className="flex items-center justify-between gap-3 rounded-sm bg-paper p-4 text-sm">
          <span className="min-w-0 font-medium text-ink">{lifecycleTarget.fullName}</span>
          <Badge variant={lifecycleTarget.status === "vigente" ? "success" : "muted"}>{statusLabels[lifecycleTarget.status]}</Badge>
        </div>
        <p className="text-sm leading-6 text-muted">{lifecycleTarget.status === "vigente"
          ? "El hermano pasará a retirado y perderá acceso al portal. Su ficha, historial y movimientos económicos se conservan."
          : "El hermano regresará como reingresante, sin recuperar automáticamente su categoría anterior. La admisión posterior como activo corresponde a Secretaría."}</p>
        <Field label="Motivo o referencia al acuerdo (obligatorio)" hint="Entre 10 y 500 caracteres.">
          <Textarea required minLength={10} maxLength={500} rows={4}
            value={lifecycleReason} onChange={(event) => setLifecycleReason(event.target.value)}/>
        </Field>
        {memberMessage && <Alert variant="error">{memberMessage}</Alert>}
      </Modal>}
      {categoryTarget && role === "secretaria" && <Modal open={categoryOpen} eyebrow="Gestión institucional" title="Cambio de categoría"
        busy={memberBusy} onClose={() => setCategoryOpen(false)} onSubmit={(event) => void submitCategoryChange(event)}
        footer={<>
          <Button type="button" variant="outline" disabled={memberBusy} onClick={() => setCategoryOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={memberBusy || nextCategory === categoryTarget.category}>
            {memberBusy ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin"/> Guardando…</> : "Confirmar cambio"}
          </Button>
        </>}>
        <div className="flex items-center justify-between gap-3 rounded-sm bg-paper p-4 text-sm">
          <span className="min-w-0 font-medium text-ink">{categoryTarget.fullName}</span>
          <Badge variant="accent">{categoryLabels[categoryTarget.category]}</Badge>
        </div>
        <Field label="Nueva categoría">
          <Select value={nextCategory} onChange={(event) => setNextCategory(event.target.value as Category)}>
            {(["postulante","reingresante","activo","vitalicio"] as const).map((category) =>
              <option key={category} value={category}>{categoryLabels[category]}</option>)}
          </Select>
        </Field>
        <Field label="Motivo del cambio (obligatorio)" hint="Entre 10 y 500 caracteres.">
          <Textarea minLength={10} maxLength={500} required rows={4}
            value={categoryReason} onChange={(event) => setCategoryReason(event.target.value)}/>
        </Field>
        <p className="text-xs leading-5 text-muted">La operación registrará un evento permanente en el historial institucional.</p>
        {memberMessage && <Alert variant="error">{memberMessage}</Alert>}
      </Modal>}
      <Modal open={memberFormOpen} size="full" eyebrow="Gestión institucional"
        title={editingMember ? "Editar hermano" : "Registrar nuevo hermano"}
        description={editingMember ? "El DNI, la categoría, el estado y las fechas institucionales no pueden modificarse desde esta edición. El correo de inicio de sesión de una cuenta activada no cambia al editar la ficha." : "El hermano activará su cuenta verificando el correo registrado."}
        busy={memberBusy} onClose={() => setMemberFormOpen(false)} onSubmit={(event) => void saveMember(event)}
        footer={<>
          <Button type="button" variant="outline" disabled={memberBusy} onClick={() => setMemberFormOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={memberBusy}>
            {memberBusy ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin"/> Guardando…</> : editingMember ? "Guardar contacto" : "Registrar hermano"}
          </Button>
        </>}>
        <Panel aria-labelledby="member-data-title">
          <PanelHeader id="member-data-title" title={editingMember ? "Información personal y de contacto" : "Datos de la ficha institucional"} />
          <PanelBody>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["fullName","Nombres y apellidos"],["dni","DNI"],["birthDate","Fecha de nacimiento"],
                ["joinedAt","Fecha de ingreso"],["swornAt","Fecha de juramentación"],
                ["address","Dirección"],["phone","Teléfono"],["email","Correo electrónico"],
                ["occupation","Ocupación"],["maritalStatus","Estado civil"],
              ] as const).map(([key,label]) => <Field key={key} label={label}>
                <Input
                  type={key === "birthDate" || key === "joinedAt" || key === "swornAt" ? "date" : key === "email" ? "email" : "text"}
                  disabled={!!editingMember && !["address","phone","email","occupation","maritalStatus"].includes(key)}
                  required={key === "fullName" || (key === "email" && !editingMember)} value={memberDraft[key]}
                  onChange={(event) => setMemberDraft((current) => ({...current,[key]:event.target.value}))}/>
              </Field>)}
              <Field label="Sexo">
                <Select value={memberDraft.sex ?? ""}
                  onChange={(event) => setMemberDraft((current) => ({...current,sex:event.target.value ? event.target.value as MemberSex : null}))}>
                  <option value="">Sin registrar</option><option value="varon">Varón</option><option value="dama">Dama</option>
                </Select>
              </Field>
              <Field label="¿Tiene hijos?">
                <Select value={memberDraft.hasChildren === null ? "" : memberDraft.hasChildren ? "si" : "no"}
                  onChange={(event) => setMemberDraft((current) => ({...current,hasChildren:event.target.value === "" ? null : event.target.value === "si"}))}>
                  <option value="">Sin registrar</option><option value="si">Sí</option><option value="no">No</option>
                </Select>
              </Field>
              <label className={`${checkOptionClass} sm:col-span-2`}>
                <input type="checkbox" className="size-4 accent-clay"
                  checked={memberDraft.nonResidentHuacho ?? false}
                  onChange={(event) => setMemberDraft((current) => ({...current,nonResidentHuacho:event.target.checked}))}/>
                <span>
                  Se acoge a la condición de no residente en Huacho
                  <span className="block text-xs text-muted">Por defecto, se considera residente en Huacho.</span>
                </span>
              </label>
              <Field label="Categoría">
                <Select disabled={!!editingMember} value={memberDraft.category}
                  onChange={(event) => setMemberDraft((current) => ({...current,category:event.target.value as Category}))}>
                  <option value="postulante">Postulante</option><option value="reingresante">Reingresante</option>
                  <option value="activo">Activo</option><option value="vitalicio">Vitalicio</option>
                </Select>
              </Field>
              {!editingMember && <Field label="Perfil de acceso">
                <Select value={newMemberRole}
                  onChange={(event) => setNewMemberRole(event.target.value as Role)}>
                  {(["estandar","tesoreria","secretaria","presidencia"] as const).map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
                </Select>
              </Field>}
            </div>
          </PanelBody>
        </Panel>
        <Panel aria-labelledby="member-sacraments-title">
          <PanelHeader id="member-sacraments-title" title="Vida sacramental" description="Selecciona los sacramentos recibidos." />
          <PanelBody>
            <div className="flex flex-wrap gap-3">
              {rosterSacraments.map((sacrament) =>
                <label key={sacrament} className={checkOptionClass}>
                  <input type="checkbox" className="size-4 accent-clay" checked={hasSacrament(memberDraft.sacraments, sacrament)}
                    onChange={(event) => setMemberDraft((current) => ({
                      ...current, sacraments:event.target.checked
                        ? [...current.sacraments,sacrament]
                        : current.sacraments.filter((item) => !hasSacrament([item], sacrament)),
                    }))}/>{sacrament}
                </label>)}
            </div>
          </PanelBody>
        </Panel>
        <Panel aria-labelledby="member-guardian-title">
          <PanelHeader id="member-guardian-title" title="Padre, madre o apoderado" description="Registra sus datos de contacto, si corresponde." />
          <PanelBody className="space-y-5">
            <label className={checkOptionClass}>
              <input type="checkbox" className="size-4 accent-clay" checked={memberDraft.guardian !== null}
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
              ] as const).map(([key,label]) => <Field key={key} label={label}>
                <Input required={key === "fullName"} value={memberDraft.guardian?.[key] ?? ""}
                  onChange={(event) => setMemberDraft((current) => ({
                    ...current, guardian:current.guardian
                      ? {...current.guardian,[key]:event.target.value} : null,
                  }))}/>
              </Field>)}
              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="text-xs font-semibold text-ink">Sacramentos del apoderado</legend>
                <div className="flex flex-wrap gap-3 pt-2">
                  {rosterSacraments.map((sacrament) =>
                    <label key={sacrament} className={checkOptionClass}>
                      <input type="checkbox" className="size-4 accent-clay" checked={memberDraft.guardian?.sacraments.includes(sacrament) ?? false}
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
          </PanelBody>
        </Panel>
        {memberMessage && <Alert variant="error">{memberMessage}</Alert>}
      </Modal>
      {role === "secretaria" && <MemberRosterImport open={importOpen} coverageReady={coverageReady}
        onClose={() => setImportOpen(false)} onImported={reload}/>}
    </>
  );
}
