"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortal } from "@/components/portal/portal-provider";
import { Input } from "@/components/ui/input";
import {
  ageOnDate,
  isVitalicioEligible,
  isTrialCategory,
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

function MemberEditor({
  member,
  onDirtyChange,
  onSaved,
  onBusyChange,
  formId,
}: {
  member: Member;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
  formId: string;
}) {
  const { updateMember } = usePortal();
  const [draft, setDraft] = useState<MemberDraft>({
    fullName: member.fullName,
    dni: member.dni,
    birthDate: member.birthDate,
    address: member.address,
    phone: member.phone,
    email: member.email,
    occupation: member.occupation,
    maritalStatus: member.maritalStatus,
    joinedAt: member.joinedAt,
    swornAt: member.swornAt,
    category: member.category,
    sacraments: [...member.sacraments],
    photo: member.photo,
    guardian: member.guardian
      ? { ...member.guardian, sacraments: [...member.guardian.sacraments] }
      : null,
  });
  const [role, setRole] = useState<Role>(member.role);
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
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
  function readPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      setError("Selecciona una fotografía JPG, PNG o WebP de hasta 1 MB.");
      event.target.value = "";
      return;
    }
    setPhotoBusy(true);
    onBusyChange(true);
    const reader = new FileReader();
    function finish() {
      setPhotoBusy(false);
      onBusyChange(false);
    }
    reader.onload = () => {
      patch("photo", String(reader.result));
      onDirtyChange(true);
      finish();
    };
    reader.onerror = () => {
      setError("No se pudo leer la fotografía. Intenta con otra imagen.");
      finish();
    };
    reader.onabort = () => {
      setError("Se interrumpió la carga de la fotografía.");
      finish();
    };
    reader.readAsDataURL(file);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (photoBusy) return;
    setError("");
    try {
      updateMember(member.id, {
        ...draft,
        role: isTrialCategory(draft.category) ? "estandar" : role,
      });
      onDirtyChange(false);
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudieron actualizar los datos.",
      );
    }
  }

  return (
    <form
      id={formId}
      className="rounded-sm border border-line bg-white-warm p-5 sm:p-7"
      onChange={() => onDirtyChange(true)}
      onSubmit={save}
    >
      <h3 className="font-display text-lg">Gestión de Secretaría</h3>
      <p className="mt-2 text-xs leading-5 text-muted">
        Corrige la ficha del hermano y administra sus datos institucionales.
      </p>
      <section
        className="mt-5 rounded-sm border border-line bg-paper p-4"
        aria-label="Fotografía del hermano"
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-sm border border-line bg-white-warm text-clay-text">
            {draft.photo ? (
              <Image
                src={draft.photo}
                alt="Vista previa de la fotografía del hermano"
                width={80}
                height={80}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="size-8" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <label
              className="block text-sm font-medium"
              htmlFor={`${formId}-photo`}
            >
              Foto del hermano (opcional)
            </label>
            <p className="mt-1 text-xs text-muted" id={`${formId}-photo-help`}>
              JPG, PNG o WebP. Máximo 1 MB.
            </p>
            <input
              id={`${formId}-photo`}
              aria-describedby={`${formId}-photo-help`}
              className="mt-3 block w-full text-xs file:mr-3 file:rounded-sm file:border file:border-line file:bg-mist file:px-3 file:py-2 file:text-xs"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={readPhoto}
              disabled={photoBusy}
            />
          </div>
          {draft.photo && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={photoBusy}
              onClick={() => {
                patch("photo", "");
                onDirtyChange(true);
              }}
            >
              Quitar foto
            </Button>
          )}
        </div>
        {photoBusy && (
          <p role="status" className="mt-3 text-xs text-muted">
            Cargando fotografía. Espera antes de guardar o cerrar la ficha.
          </p>
        )}
      </section>
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
                if (isTrialCategory(value)) setRole("estandar");
              }}
            >
              <option value="postulante">Postulante</option>
              <option value="reingresante" disabled={isMinor}>
                Reingresante · Periodo de prueba
              </option>
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
              value={isTrialCategory(draft.category) ? "estandar" : role}
              disabled={isTrialCategory(draft.category)}
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
            {!isTrialCategory(draft.category) && " *"}
            <Input
              type="date"
              value={draft.swornAt}
              required={!isTrialCategory(draft.category)}
              min={draft.joinedAt || undefined}
              max={todayDate()}
              onChange={(event) => patch("swornAt", event.target.value)}
            />
          </label>
        </div>
      </fieldset>
      {isTrialCategory(draft.category) && (
        <p className="mt-3 text-xs text-clay-text">
          Los postulantes y reingresantes tienen perfil Estándar durante su
          periodo de prueba. Al guardar se aplicará ese perfil.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

export { MemberEditor };
