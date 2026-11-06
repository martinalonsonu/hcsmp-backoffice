"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Plus, Search, UserRound, X } from "lucide-react";
import { MemberRegistration } from "@/components/members/member-registration";
import { usePortal } from "@/components/portal/portal-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ageOnDate,
  categoryLabels,
  isVitalicioEligible,
  roleLabels,
  todayDate,
  type Category,
  type Guardian,
  type Member,
  type MemberDraft,
  type Role,
} from "@/lib/portal";

const selectClass =
  "h-12 w-full rounded-sm border border-line bg-white-warm px-3 text-sm disabled:opacity-60";
const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("es-PE", { timeZone: "UTC" }).format(
        new Date(`${value}T12:00:00Z`),
      )
    : "Sin registrar";

function InstitutionalEditor({ member }: { member: Member }) {
  const { updateMember } = usePortal();
  const [draft, setDraft] = useState<MemberDraft>({ ...member });
  const [role, setRole] = useState<Role>(member.role);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isMinor = (ageOnDate(draft.birthDate) ?? 18) < 18;
  const eligible = isVitalicioEligible(draft);
  const guardian = draft.guardian ?? {
    fullName: "",
    dni: "",
    age: "",
    education: "",
    address: "",
    phone: "",
    relationship: "",
    sacraments: [],
  };
  const sacraments = [
    "Bautizo",
    "Primera comunión",
    "Confirmación",
    "Matrimonio",
  ];
  function patch(
    key: keyof MemberDraft,
    value: MemberDraft[keyof MemberDraft],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function patchGuardian(key: keyof Guardian, value: string | string[]) {
    setDraft((current) => ({
      ...current,
      guardian: { ...guardian, [key]: value },
    }));
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      updateMember(member.id, {
        ...draft,
        role: draft.category === "postulante" ? "estandar" : role,
      });
      setMessage("Ficha del hermano actualizada.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudieron actualizar los datos.",
      );
    }
  }

  return (
    <form className="mt-6 border-t border-line pt-6" onSubmit={save}>
      <h3 className="font-display text-lg">Gestión de Secretaría</h3>
      <p className="mt-2 text-xs leading-5 text-muted">
        Corrige la ficha del hermano y administra sus datos institucionales.
      </p>
      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Datos del hermano</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm sm:col-span-2">
            Nombres y apellidos
            <Input
              required
              minLength={3}
              value={draft.fullName}
              onChange={(event) => patch("fullName", event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            DNI
            <Input
              required
              inputMode="numeric"
              pattern="[0-9]{8}"
              maxLength={8}
              value={draft.dni}
              onChange={(event) => patch("dni", event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Fecha de nacimiento
            <Input
              required
              type="date"
              max={todayDate()}
              value={draft.birthDate}
              onChange={(event) => {
                const birthDate = event.target.value;
                const minor = (ageOnDate(birthDate) ?? 18) < 18;
                setDraft((current) => ({
                  ...current,
                  birthDate,
                  category: minor ? "postulante" : current.category,
                }));
                if (minor) setRole("estandar");
              }}
            />
          </label>
          <label className="grid gap-2 text-sm sm:col-span-2">
            Dirección
            <Input
              value={draft.address}
              onChange={(event) => patch("address", event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Celular
            <Input
              type="tel"
              value={draft.phone}
              onChange={(event) => patch("phone", event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Correo electrónico (opcional)
            <Input
              type="email"
              value={draft.email}
              onChange={(event) => patch("email", event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Profesión u ocupación
            <Input
              value={draft.occupation}
              onChange={(event) => patch("occupation", event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Estado civil
            <select
              className={selectClass}
              value={draft.maritalStatus}
              onChange={(event) => patch("maritalStatus", event.target.value)}
            >
              <option value="">Sin especificar</option>
              {[
                "Soltero/a",
                "Casado/a",
                "Conviviente",
                "Divorciado/a",
                "Viudo/a",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4">
          <p className="text-sm">Sacramentos recibidos</p>
          <div className="mt-3 flex flex-wrap gap-4">
            {sacraments.map((item) => (
              <label className="flex items-center gap-2 text-sm" key={item}>
                <input
                  type="checkbox"
                  className="size-4 accent-clay"
                  checked={draft.sacraments.includes(item)}
                  onChange={(event) =>
                    patch(
                      "sacraments",
                      event.target.checked
                        ? [...draft.sacraments, item]
                        : draft.sacraments.filter((value) => value !== item),
                    )
                  }
                />
                {item}
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      {(isMinor || draft.guardian) && (
        <fieldset className="mt-6 border-t border-line pt-5">
          <legend className="px-1 text-sm font-medium">
            Datos del apoderado
            {isMinor ? " · Requeridos para el menor" : " · Registro conservado"}
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["fullName", "Nombres y apellidos"],
                ["dni", "DNI"],
                ["relationship", "Parentesco"],
                ["phone", "Celular"],
                ["age", "Edad"],
                ["education", "Grado de instrucción"],
                ["address", "Dirección"],
              ] as const
            ).map(([key, label]) => (
              <label className="grid gap-2 text-sm" key={key}>
                {label}
                <Input
                  value={guardian[key]}
                  required={
                    isMinor &&
                    ["fullName", "dni", "phone", "relationship"].includes(key)
                  }
                  type={
                    key === "age" ? "number" : key === "phone" ? "tel" : "text"
                  }
                  min={key === "age" ? 0 : undefined}
                  maxLength={key === "dni" ? 8 : undefined}
                  pattern={key === "dni" ? "[0-9]{8}" : undefined}
                  onChange={(event) => patchGuardian(key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="mt-4">
            <p className="text-sm">Sacramentos del apoderado</p>
            <div className="mt-3 flex flex-wrap gap-4">
              {sacraments
                .filter((item) => item !== "Matrimonio")
                .map((item) => (
                  <label className="flex items-center gap-2 text-sm" key={item}>
                    <input
                      type="checkbox"
                      className="size-4 accent-clay"
                      checked={guardian.sacraments.includes(item)}
                      onChange={(event) =>
                        patchGuardian(
                          "sacraments",
                          event.target.checked
                            ? [...guardian.sacraments, item]
                            : guardian.sacraments.filter(
                                (value) => value !== item,
                              ),
                        )
                      }
                    />
                    {item}
                  </label>
                ))}
            </div>
          </div>
        </fieldset>
      )}
      <fieldset className="mt-6 border-t border-line pt-5">
        <legend className="px-1 text-sm font-medium">
          Datos institucionales
        </legend>
        <p className="mt-2 text-xs leading-5 text-muted">
          Los cambios de categoría son manuales. Para ser vitalicio se requieren
          65 años de edad o 30 años desde la juramentación.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm">
            Categoría
            <select
              className={selectClass}
              value={draft.category}
              onChange={(event) => {
                const value = event.target.value as Category;
                patch("category", value);
                if (value === "postulante") setRole("estandar");
              }}
            >
              <option value="postulante">Postulante</option>
              <option value="activo" disabled={isMinor}>
                Activo
              </option>
              <option value="vitalicio" disabled={isMinor || !eligible}>
                Vitalicio{!eligible ? " · Aún no cumple las condiciones" : ""}
              </option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Perfil de acceso
            <select
              className={selectClass}
              value={draft.category === "postulante" ? "estandar" : role}
              disabled={draft.category === "postulante"}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Fecha de ingreso
            <Input
              type="date"
              value={draft.joinedAt}
              required
              min={draft.birthDate || undefined}
              max={todayDate()}
              onChange={(event) => patch("joinedAt", event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Fecha de juramentación
            <Input
              type="date"
              value={draft.swornAt}
              required={draft.category !== "postulante"}
              min={draft.joinedAt || undefined}
              max={todayDate()}
              onChange={(event) => patch("swornAt", event.target.value)}
            />
          </label>
        </div>
      </fieldset>
      {draft.category === "postulante" && (
        <p className="mt-3 text-xs text-clay-text">
          Un postulante solo puede tener perfil Estándar. Al guardar se aplicará
          ese perfil.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-green-800">
          {message}
        </p>
      )}
      <Button type="submit" className="mt-5">
        Guardar cambios en la ficha
      </Button>
    </form>
  );
}

function MemberDetails({
  member,
  editable,
  onClose,
}: {
  member: Member;
  editable: boolean;
  onClose: () => void;
}) {
  const details = [
    ["DNI", member.dni],
    ["Fecha de nacimiento", dateLabel(member.birthDate)],
    ["Edad", `${ageOnDate(member.birthDate) ?? "—"} años`],
    ["Dirección", member.address],
    ["Celular", member.phone],
    ["Correo", member.email || "Sin correo"],
    ["Profesión u ocupación", member.occupation],
    ["Estado civil", member.maritalStatus],
    ["Fecha de ingreso", dateLabel(member.joinedAt)],
    ["Fecha de juramentación", dateLabel(member.swornAt)],
    ["Sacramentos", member.sacraments.join(", ") || "Sin registrar"],
    ["Usuario de acceso", member.username],
  ];
  return (
    <section
      aria-labelledby="member-detail-title"
      className="mt-6 rounded-sm border border-line bg-white-warm p-5 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {(ageOnDate(member.birthDate) ?? 18) < 18
              ? "Ficha de menor de edad"
              : "Ficha de mayor de edad"}
          </p>
          <div className="mt-3 flex items-center gap-3">
            {member.photo && (
              <Image
                src={member.photo}
                alt={`Fotografía de ${member.fullName}`}
                width={64}
                height={64}
                unoptimized
                className="size-16 rounded-full object-cover"
              />
            )}
            <h2 id="member-detail-title" className="font-display text-2xl">
              {member.fullName}
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="accent">{categoryLabels[member.category]}</Badge>
            <Badge>{roleLabels[member.role]}</Badge>
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Cerrar ficha"
          onClick={onClose}
        >
          <X className="size-5" />
        </Button>
      </div>
      <dl className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 break-words text-sm">
              {value || "Sin registrar"}
            </dd>
          </div>
        ))}
      </dl>
      {member.guardian && (
        <div className="mt-6 border-t border-line pt-6">
          <h3 className="font-display text-lg">Datos del apoderado</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Nombres y apellidos", member.guardian.fullName],
              ["DNI", member.guardian.dni],
              ["Parentesco", member.guardian.relationship],
              ["Edad", member.guardian.age],
              ["Grado de instrucción", member.guardian.education],
              ["Dirección", member.guardian.address],
              ["Celular", member.guardian.phone],
              ["Sacramentos", member.guardian.sacraments.join(", ")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 text-sm">{value || "Sin registrar"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {editable && <InstitutionalEditor key={member.id} member={member} />}
    </section>
  );
}

function MembersPanel() {
  const { currentMember, members } = usePortal();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const editable = currentMember?.role === "secretaria";
  if (!editable && currentMember?.role !== "presidencia") return null;
  const selected = members.find((member) => member.id === selectedId);
  const filtered = members.filter(
    (member) =>
      (!category || member.category === category) &&
      `${member.fullName} ${member.dni}`
        .toLocaleLowerCase("es")
        .includes(query.toLocaleLowerCase("es")),
  );

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
      <section
        className="rounded-sm border border-line bg-white-warm"
        aria-label="Listado de hermanos"
      >
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
          <table className="w-full min-w-[650px] text-left text-sm">
            <caption className="sr-only">
              Padrón de hermanos: {filtered.length} resultados
            </caption>
            <thead className="bg-paper/60 text-xs text-muted">
              <tr>
                {["Hermano", "Categoría", "Perfil", "Ficha"].map((title) => (
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
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mist text-clay-text">
                        <UserRound className="size-4" aria-hidden="true" />
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
                        member.category === "postulante" ? "muted" : "accent"
                      }
                    >
                      {categoryLabels[member.category]}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {roleLabels[member.role]}
                  </td>
                  <td className="px-5 py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedId(member.id)}
                      aria-label={`Ver ficha de ${member.fullName}`}
                    >
                      Ver ficha
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="p-8 text-center text-sm text-muted" role="status">
              No se encontraron hermanos con esos filtros.
            </p>
          )}
        </div>
        <p className="border-t border-line px-5 py-4 text-xs text-muted">
          {filtered.length} de {members.length} hermanos
        </p>
      </section>
      {selected && (
        <MemberDetails
          member={selected}
          editable={editable}
          onClose={() => setSelectedId(null)}
        />
      )}
      {registering && editable && (
        <MemberRegistration onClose={() => setRegistering(false)} />
      )}
    </>
  );
}

export { MembersPanel };
