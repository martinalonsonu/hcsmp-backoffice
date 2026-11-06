"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  Archive,
  Download,
  Plus,
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
  type Member,
  type MembershipStatus,
} from "@/lib/portal";

const selectClass =
  "h-12 w-full rounded-sm border border-line bg-white-warm px-3 text-sm disabled:opacity-60";

function MembersPanel() {
  const { currentMember, members } = usePortal();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<MembershipStatus>("vigente");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [notice, setNotice] = useState("");
  const downloadLock = useRef(false);
  const editable = currentMember?.role === "secretaria";
  if (!editable && currentMember?.role !== "presidencia") return null;

  const selected = members.find((member) => member.id === selectedId);
  const visibleMembers = members.filter((member) => member.status === status);
  const filtered = visibleMembers.filter(
    (member) =>
      (!category || member.category === category) &&
      `${member.fullName} ${member.dni}`
        .toLocaleLowerCase("es")
        .includes(query.toLocaleLowerCase("es")),
  );

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

  function lifecycleComplete(nextStatus: MembershipStatus, message: string) {
    setSelectedId(null);
    setStatus(nextStatus);
    setCategory("");
    setQuery("");
    setNotice(message);
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {editable ? "Secretaría" : "Presidencia · Solo consulta"}
          </p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">
            Padrón de hermanos
          </h1>
          <p className="mt-3 text-sm text-muted">
            {editable
              ? "Administra las fichas, categorías y accesos de la Hermandad."
              : "Consulta la información institucional de los hermanos."}
          </p>
        </div>
        {editable && (
          <Button onClick={() => setRegistering(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo hermano
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
      <div
        className="mb-5 flex flex-wrap gap-2"
        role="group"
        aria-label="Listados del padrón"
      >
        {(
          [
            ["vigente", "Padrón", UsersRound],
            ["retirado", "Retirados", Archive],
          ] as const
        ).map(([value, label, Icon]) => (
          <Button
            key={value}
            type="button"
            variant={status === value ? "default" : "outline"}
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setQuery("");
              setCategory("");
              setDownloadError("");
            }}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            <span className="ml-1 rounded-full bg-current/10 px-2 py-0.5 text-xs">
              {members.filter((member) => member.status === value).length}
            </span>
          </Button>
        ))}
      </div>
      <section
        className="rounded-sm border border-line bg-white-warm"
        aria-labelledby="member-list-title"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="member-list-title" className="font-display text-xl">
            {status === "retirado"
              ? "Hermanos retirados"
              : "Hermanos en el padrón"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            {status === "retirado"
              ? "Conservan su ficha e historial. Secretaría puede registrar su reingreso desde Ver ficha."
              : "Este listado muestra únicamente a los hermanos vigentes. Los retirados se consultan en su listado separado."}
          </p>
        </div>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[minmax(0,1fr)_15rem] sm:p-5">
          <label className="relative">
            <span className="sr-only">Buscar por nombre o DNI</span>
            <Search
              aria-hidden="true"
              className="absolute left-3 top-4 size-4 text-muted"
            />
            <Input
              className="pl-10"
              value={query}
              placeholder="Buscar por nombre o DNI"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Filtrar categoría</span>
            <select
              className={selectClass}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Todas las categorías</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">
              {status === "retirado" ? "Retirados" : "Padrón de hermanos"}:{" "}
              {filtered.length} resultados
            </caption>
            <thead className="bg-paper/60 text-xs text-muted">
              <tr>
                {["Hermano", "Categoría", "Perfil", "Acciones"].map((title) => (
                  <th key={title} className="px-5 py-4 font-medium" scope="col">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((member) => (
                <tr key={member.id}>
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
                          DNI {member.dni} · {ageOnDate(member.birthDate)} años
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
                        size="sm"
                        onClick={() => {
                          setSelectedId(member.id);
                          setDownloadError("");
                        }}
                        aria-label={`Ver ficha de ${member.fullName}`}
                      >
                        Ver ficha
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingId !== null}
                        onClick={() => void download(member)}
                        aria-label={`Descargar ficha PDF de ${member.fullName}`}
                      >
                        <Download className="size-3.5" aria-hidden="true" />
                        {downloadingId === member.id
                          ? "Preparando…"
                          : "Descargar ficha (PDF)"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="p-8 text-center text-sm text-muted" role="status">
              {visibleMembers.length
                ? "No se encontraron hermanos con esos filtros."
                : status === "retirado"
                  ? "No hay hermanos retirados registrados."
                  : "No hay hermanos vigentes registrados."}
            </p>
          )}
        </div>
        <p className="border-t border-line px-5 py-4 text-xs text-muted">
          {filtered.length} de {visibleMembers.length} hermanos{" "}
          {status === "retirado" ? "retirados" : "vigentes"}
        </p>
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
