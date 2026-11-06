"use client";

import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, KeyRound, Save, UserRound } from "lucide-react";
import { usePortal } from "@/components/portal/portal-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ageOnDate,
  categoryLabels,
  roleLabels,
  type Member,
} from "@/lib/portal";

const sacraments = [
  "Bautizo",
  "Primera comunión",
  "Confirmación",
  "Matrimonio",
];
const selectClass =
  "h-12 w-full rounded-sm border border-line bg-white-warm px-3 text-sm focus-visible:outline-2 focus-visible:outline-clay";

function ProfilePanel() {
  const { currentMember } = usePortal();
  if (!currentMember) return null;
  return <ProfileEditor key={currentMember.id} member={currentMember} />;
}

function ProfileEditor({ member }: { member: Member }) {
  const { updateOwnProfile, changePassword } = usePortal();
  const [photo, setPhoto] = useState(member.photo);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const age = ageOnDate(member.birthDate);

  function readPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setProfileMessage("");
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      setProfileError(true);
      setProfileMessage("Selecciona una imagen JPG, PNG o WebP de hasta 1 MB.");
      event.target.value = "";
      return;
    }
    setPhotoBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setPhotoBusy(false);
    };
    reader.onerror = () => {
      setProfileError(true);
      setProfileMessage(
        "No se pudo leer la imagen. Intenta con otra fotografía.",
      );
      setPhotoBusy(false);
    };
    reader.readAsDataURL(file);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      updateOwnProfile({
        address: String(data.get("address") ?? "").trim(),
        phone: String(data.get("phone") ?? "").trim(),
        email: String(data.get("email") ?? "").trim(),
        occupation: String(data.get("occupation") ?? "").trim(),
        maritalStatus: String(data.get("maritalStatus") ?? ""),
        sacraments: data.getAll("sacraments").map(String),
        photo,
      });
      setProfileError(false);
      setProfileMessage("Tu información se actualizó correctamente.");
    } catch (error) {
      setProfileError(true);
      setProfileMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar tu información.",
      );
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordBusy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const next = String(data.get("newPassword") ?? "");
    if (next !== data.get("confirmPassword")) {
      setPasswordError(true);
      setPasswordMessage(
        "La confirmación no coincide con la nueva contraseña.",
      );
      return;
    }
    setPasswordBusy(true);
    setPasswordMessage("");
    try {
      await changePassword(String(data.get("currentPassword") ?? ""), next);
      form.reset();
      setPasswordError(false);
      setPasswordMessage(
        "Contraseña actualizada. Utilízala en tu próximo ingreso.",
      );
    } catch (error) {
      setPasswordError(true);
      setPasswordMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar tu contraseña.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Mi información</p>
        <h1 className="mt-2 font-display text-3xl">Mi perfil</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Mantén actualizados tus datos de contacto y tu contraseña de acceso.
        </p>
      </div>

      <section
        aria-label="Información institucional"
        className="rounded-sm border border-line bg-white-warm p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-mist text-clay-text">
            {member.photo ? (
              <Image
                src={member.photo}
                alt={`Fotografía de ${member.fullName}`}
                width={64}
                height={64}
                unoptimized
                className="size-full object-cover"
              />
            ) : (
              <UserRound aria-hidden="true" className="size-7" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl">{member.fullName}</h2>
            <p className="mt-1 text-sm text-muted">
              Usuario:{" "}
              <strong className="font-medium text-ink">
                {member.username}
              </strong>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="accent">{categoryLabels[member.category]}</Badge>
              <Badge>{roleLabels[member.role]}</Badge>
            </div>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">DNI</dt>
            <dd className="mt-1">{member.dni}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Fecha de nacimiento</dt>
            <dd className="mt-1">
              {formatDate(member.birthDate)}
              {age !== null ? ` · ${age} años` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Ingreso a la hermandad</dt>
            <dd className="mt-1">{formatDate(member.joinedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Juramentación</dt>
            <dd className="mt-1">{formatDate(member.swornAt)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-5 text-muted">
          Para corregir tu identidad o información institucional, comunícate con
          Secretaría.
        </p>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <form
          className="rounded-sm border border-line bg-white-warm p-5 sm:p-6"
          onSubmit={saveProfile}
        >
          <h2 className="font-display text-xl">
            Datos de contacto y personales
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field
              label="Dirección"
              htmlFor="profile-address"
              className="sm:col-span-2"
            >
              <Input
                id="profile-address"
                name="address"
                autoComplete="street-address"
                defaultValue={member.address}
                maxLength={250}
              />
            </Field>
            <Field label="Celular" htmlFor="profile-phone">
              <Input
                id="profile-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                defaultValue={member.phone}
                maxLength={25}
              />
            </Field>
            <Field
              label="Correo electrónico (opcional)"
              htmlFor="profile-email"
            >
              <Input
                id="profile-email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={member.email}
                maxLength={150}
              />
            </Field>
            <Field label="Profesión u ocupación" htmlFor="profile-occupation">
              <Input
                id="profile-occupation"
                name="occupation"
                defaultValue={member.occupation}
                maxLength={120}
              />
            </Field>
            <Field label="Estado civil" htmlFor="profile-marital-status">
              <select
                id="profile-marital-status"
                name="maritalStatus"
                defaultValue={member.maritalStatus}
                className={selectClass}
              >
                <option value="">Sin especificar</option>
                {[
                  "Soltero/a",
                  "Casado/a",
                  "Conviviente",
                  "Divorciado/a",
                  "Viudo/a",
                ].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset className="mt-5">
            <legend className="text-sm font-medium">
              Sacramentos recibidos
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {sacraments.map((sacrament) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={sacrament}
                >
                  <input
                    className="size-4 accent-clay"
                    type="checkbox"
                    name="sacraments"
                    value={sacrament}
                    defaultChecked={member.sacraments.includes(sacrament)}
                  />
                  {sacrament}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 border-t border-line pt-5">
            <label
              className="flex items-center gap-2 text-sm font-medium"
              htmlFor="profile-photo"
            >
              <Camera aria-hidden="true" className="size-4" />
              Fotografía
            </label>
            <p
              className="mt-1 text-xs leading-5 text-muted"
              id="profile-photo-help"
            >
              JPG, PNG o WebP. Máximo 1 MB.
            </p>
            <input
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby="profile-photo-help"
              onChange={readPhoto}
              className="mt-3 block w-full text-xs file:mr-3 file:rounded-sm file:border file:border-line file:bg-mist file:px-3 file:py-2 file:text-xs"
            />
            {photo && (
              <div className="mt-3 flex items-center gap-3">
                <Image
                  src={photo}
                  alt="Vista previa de la fotografía"
                  width={56}
                  height={56}
                  unoptimized
                  className="size-14 rounded-full object-cover"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPhoto("")}
                >
                  Quitar fotografía
                </Button>
              </div>
            )}
          </div>
          {profileMessage && (
            <p
              role={profileError ? "alert" : "status"}
              className={`mt-4 text-sm leading-6 ${profileError ? "text-red-700" : "text-green-800"}`}
            >
              {profileMessage}
            </p>
          )}
          <Button
            className="mt-6 w-full sm:w-auto"
            disabled={photoBusy}
            type="submit"
          >
            <Save aria-hidden="true" className="size-4" />
            {photoBusy ? "Cargando fotografía…" : "Guardar mi información"}
          </Button>
        </form>

        <form
          className="rounded-sm border border-line bg-white-warm p-5 sm:p-6"
          onSubmit={savePassword}
        >
          <div className="flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-5 text-clay-text" />
            <h2 className="font-display text-xl">Cambiar contraseña</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            Puedes reemplazar aquí la contraseña inicial que te entregó
            Secretaría.
          </p>
          <div className="mt-5 space-y-5">
            <Field label="Contraseña actual" htmlFor="profile-current-password">
              <Input
                id="profile-current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="Nueva contraseña" htmlFor="profile-new-password">
              <Input
                id="profile-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                aria-describedby="password-help"
              />
            </Field>
            <p id="password-help" className="text-xs text-muted">
              Utiliza al menos 8 caracteres.
            </p>
            <Field
              label="Confirmar nueva contraseña"
              htmlFor="profile-confirm-password"
            >
              <Input
                id="profile-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
          </div>
          {passwordMessage && (
            <p
              role={passwordError ? "alert" : "status"}
              className={`mt-4 text-sm leading-6 ${passwordError ? "text-red-700" : "text-green-800"}`}
            >
              {passwordMessage}
            </p>
          )}
          <Button type="submit" disabled={passwordBusy} className="mt-6 w-full">
            {passwordBusy ? "Actualizando…" : "Actualizar contraseña"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "No registrada";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export { ProfilePanel };
