"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  Archive,
  Download,
  Eye,
  FileDown,
  Plus,
  RotateCcw,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { MemberRegistration } from "@/components/members/member-registration";
import { MemberDetails } from "@/components/members/member-details";
import { usePortal } from "@/components/portal/portal-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ageOnDate,
  categoryLabels,
  isTrialCategory,
  roleLabels,
  type Category,
  type Member,
  type MembershipStatus,
} from "@/lib/portal";

const selectClass =
  "h-12 w-full rounded-sm border border-line bg-white-warm px-3 text-sm disabled:opacity-60";

function MembersPanel() {
  const { currentMember, members } = usePortal();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [ageGroup, setAgeGroup] = useState<"mayores" | "menores" | "">("");
  const [status, setStatus] = useState<MembershipStatus>("vigente");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingRoster, setDownloadingRoster] = useState<
    "completo" | "filtrado" | null
  >(null);
  const [downloadError, setDownloadError] = useState("");
  const [notice, setNotice] = useState("");
  const downloadLock = useRef(false);
  const editable = currentMember?.role === "secretaria";
  if (!editable && currentMember?.role !== "presidencia") return null;

  const selected = members.find((member) => member.id === selectedId);
  const visibleMembers = members.filter((member) => member.status === status);
  const filtered = visibleMembers.filter((member) => {
    const age = ageOnDate(member.birthDate);
    return (
      (!category || member.category === category) &&
      (!ageGroup ||
        (ageGroup === "mayores"
          ? age !== null && age >= 18
          : age !== null && age < 18)) &&
      `${member.fullName} ${member.dni}`
        .toLocaleLowerCase("es")
        .includes(query.toLocaleLowerCase("es"))
    );
  });
  const hasFilters = Boolean(query.trim() || category || ageGroup);

  function clearFilters() {
    setQuery("");
    setCategory("");
    setAgeGroup("");
    setDownloadError("");
  }

  async function download(member: Member) {
    if (downloadLock.current) return;
    downloadLock.current = true;
    setDownloadingId(member.id);
    setDownloadError("");
    try {
      const { downloadMemberDocument } = await import("@/lib/member-document");
      await downloadMemberDocument(member);
    } catch (cause) {
      setDownloadError(
        cause instanceof Error
          ? cause.message
          : "No se pudo preparar la ficha para descargar. Inténtalo nuevamente.",
      );
    } finally {
      downloadLock.current = false;
      setDownloadingId(null);
    }
  }

  async function downloadRoster(mode: "completo" | "filtrado") {
    const roster = mode === "completo" ? visibleMembers : filtered;
    if (downloadLock.current || !roster.length) return;
    downloadLock.current = true;
    setDownloadingRoster(mode);
    setDownloadError("");
    try {
      const { downloadMemberRoster } = await import("@/lib/member-document");
      await downloadMemberRoster(
        roster,
        mode === "completo"
          ? { status }
          : {
              status,
              category: category || undefined,
              ageGroup: ageGroup || undefined,
              search: query,
            },
      );
    } catch (cause) {
      setDownloadError(
        cause instanceof Error
          ? cause.message
          : "No se pudo preparar el padrón para descargar. Inténtalo nuevamente.",
      );
    } finally {
      downloadLock.current = false;
      setDownloadingRoster(null);
    }
  }

  function lifecycleComplete(nextStatus: MembershipStatus, message: string) {
    setSelectedId(null);
    setStatus(nextStatus);
    setCategory("");
    setAgeGroup("");
    setQuery("");
    setNotice(message);
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">
            {editable ? "Secretaría" : "Presidencia · Solo consulta"}
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">
            Padrón de hermanos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {editable
              ? "Encuentra, consulta y administra las fichas de los hermanos."
              : "Consulta las fichas y la información institucional de los hermanos."}
          </p>
        </div>
        {editable && (
          <Button className="w-full sm:w-auto" onClick={() => setRegistering(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Registrar hermano
          </Button>
        )}
      </div>
      {notice && (
        <p
          className="mb-5 rounded-sm border border-line bg-mist p-4 text-sm leading-6"
          role="status"
        >
          {notice}
        </p>
      )}
      {downloadError && !selected && (
        <p
          className="mb-5 rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {downloadError}
        </p>
      )}
      <section
        className="overflow-hidden rounded-md border border-line bg-white-warm shadow-sm"
        aria-labelledby="member-list-title"
      >
        <div className="flex flex-col gap-5 border-b border-line px-4 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Directorio
            </p>
            <h2 id="member-list-title" className="mt-1 font-display text-2xl">
              {status === "retirado" ? "Hermanos retirados" : "Hermanos vigentes"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {status === "retirado"
                ? "Consulta sus fichas e historial. Secretaría puede registrar el reingreso desde Ver ficha."
                : "Busca por nombre o DNI, aplica filtros y accede a cada ficha."}
            </p>
          </div>
          <div
            className="grid grid-cols-2 rounded-sm border border-line bg-paper p-1"
            role="group"
            aria-label="Listados del padrón"
          >
            {(
              [
                ["vigente", "Vigentes", UsersRound],
                ["retirado", "Retirados", Archive],
              ] as const
            ).map(([value, label, Icon]) => {
              const active = status === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setStatus(value);
                    clearFilters();
                  }}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay ${
                    active
                      ? "bg-white-warm text-ink shadow-sm"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{label}</span>
                  <span className="rounded-full bg-mist px-2 py-0.5 text-xs tabular-nums">
                    {members.filter((member) => member.status === value).length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-b border-line bg-white-warm px-4 py-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.5fr)_repeat(2,minmax(12rem,1fr))]">
            <label>
              <span className="mb-2 block text-xs font-medium text-ink">
                Buscar hermano
              </span>
              <span className="relative block">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                />
                <Input
                  className="pl-10"
                  type="search"
                  value={query}
                  placeholder="Nombre o número de DNI"
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Buscar por nombre o DNI"
                />
              </span>
            </label>
            <label>
              <span className="mb-2 block text-xs font-medium text-ink">
                Categoría
              </span>
              <select
                className={selectClass}
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as Category | "")
                }
              >
                <option value="">Todas las categorías</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-xs font-medium text-ink">
                Grupo de edad
              </span>
              <select
                className={selectClass}
                value={ageGroup}
                onChange={(event) =>
                  setAgeGroup(event.target.value as typeof ageGroup)
                }
              >
                <option value="">Todas las edades</option>
                <option value="mayores">Mayores de edad</option>
                <option value="menores">Menores de edad</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <p aria-live="polite" className="font-medium tabular-nums text-ink">
                {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
                <span className="font-normal text-muted"> de {visibleMembers.length}</span>
              </p>
              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-9 px-2"
                  onClick={clearFilters}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Limpiar filtros
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={!visibleMembers.length || downloadingRoster !== null || downloadingId !== null}
                onClick={() => void downloadRoster("completo")}
              >
                <FileDown className="size-4" aria-hidden="true" />
                {downloadingRoster === "completo"
                  ? "Preparando padrón…"
                  : `Exportar listado (${visibleMembers.length})`}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={!filtered.length || downloadingRoster !== null || downloadingId !== null}
                onClick={() => void downloadRoster("filtrado")}
              >
                <Download className="size-4" aria-hidden="true" />
                {downloadingRoster === "filtrado"
                  ? "Preparando resultados…"
                  : `Exportar resultados (${filtered.length})`}
              </Button>
            </div>
          </div>
        </div>
        <div>
          <ul className="divide-y divide-line md:hidden">
            {filtered.map((member) => {
              const age = ageOnDate(member.birthDate);
              return (
                <li key={member.id} className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-mist text-clay-text">
                      {member.photo ? (
                        <Image
                          src={member.photo}
                          alt=""
                          width={44}
                          height={44}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound className="size-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-5">{member.fullName}</p>
                      <p className="mt-1 text-xs text-muted">
                        DNI {member.dni} <span aria-hidden="true">·</span>{" "}
                        {age === null ? "Edad sin registrar" : `${age} años`}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            isTrialCategory(member.category) ? "muted" : "accent"
                          }
                        >
                          {categoryLabels[member.category]}
                        </Badge>
                        <span className="text-xs text-muted">
                          {roleLabels[member.role]}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedId(member.id);
                        setDownloadError("");
                      }}
                      aria-label={`Ver ficha de ${member.fullName}`}
                    >
                      <Eye className="size-4" aria-hidden="true" />
                      Ver ficha
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={downloadingId !== null || downloadingRoster !== null}
                      onClick={() => void download(member)}
                      aria-label={`Descargar ficha PDF de ${member.fullName}`}
                    >
                      <Download className="size-4" aria-hidden="true" />
                      {downloadingId === member.id ? "Preparando…" : "Ficha PDF"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">
              {status === "retirado" ? "Retirados" : "Padrón de hermanos"}:{" "}
              {filtered.length} resultados
            </caption>
            <thead className="bg-paper/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                {["Hermano", "Categoría", "Perfil", "Acciones"].map((title) => (
                  <th key={title} className="px-5 py-3.5 font-semibold" scope="col">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((member) => {
                const age = ageOnDate(member.birthDate);
                return (
                <tr key={member.id} className="transition-colors hover:bg-paper/40">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-mist text-clay-text">
                        {member.photo ? (
                          <Image
                            src={member.photo}
                            alt=""
                            width={36}
                            height={36}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <UserRound className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <span className="block font-medium">
                          {member.fullName}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          DNI {member.dni} · {age === null ? "Edad sin registrar" : `${age} años`}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      variant={
                        isTrialCategory(member.category) ? "muted" : "accent"
                      }
                    >
                      {categoryLabels[member.category]}
                    </Badge>
                    {member.category === "reingresante" && (
                      <span className="mt-1 block text-xs text-muted">
                        Periodo de prueba
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {roleLabels[member.role]}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSelectedId(member.id);
                          setDownloadError("");
                        }}
                        aria-label={`Ver ficha de ${member.fullName}`}
                        title="Ver ficha"
                      >
                        <Eye className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={downloadingId !== null || downloadingRoster !== null}
                        onClick={() => void download(member)}
                        aria-label={`Descargar ficha PDF de ${member.fullName}`}
                        title="Descargar ficha PDF"
                      >
                        {downloadingId === member.id ? (
                          <span className="text-[0.625rem]" aria-hidden="true">…</span>
                        ) : (
                          <Download className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {!filtered.length && (
            <div className="px-5 py-14 text-center" role="status">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-paper text-muted">
                <UsersRound className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-4 font-medium text-ink">
                {visibleMembers.length
                  ? "No encontramos coincidencias"
                  : status === "retirado"
                    ? "Aún no hay hermanos retirados"
                    : "Aún no hay hermanos en el padrón"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {visibleMembers.length
                  ? "Prueba con otro nombre, DNI o ajusta los filtros."
                  : "Cuando se registren hermanos, aparecerán en este listado."}
              </p>
              {visibleMembers.length > 0 && hasFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={clearFilters}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
      {selected && (
        <MemberDetails
          key={selected.id}
          member={selected}
          editable={editable}
          onClose={() => {
            setSelectedId(null);
            setDownloadError("");
          }}
          onLifecycleComplete={lifecycleComplete}
          onDownload={() => void download(selected)}
          downloadBusy={downloadingId !== null}
          downloadError={downloadError}
        />
      )}
      {registering && editable && (
        <MemberRegistration onClose={() => setRegistering(false)} />
      )}
    </>
  );
}

export { MembersPanel };
