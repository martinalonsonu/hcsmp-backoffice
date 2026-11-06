"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Archive,
  ArrowLeft,
  Download,
  Pencil,
  RotateCcw,
  Save,
  UserRound,
  X,
} from "lucide-react";
import { MemberEditor } from "@/components/members/member-editor";
import { usePortal } from "@/components/portal/portal-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ageOnDate,
  categoryLabels,
  roleLabels,
  statusLabels,
  type Member,
  type MembershipStatus,
} from "@/lib/portal";

const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("es-PE", { timeZone: "UTC" }).format(
        new Date(`${value}T12:00:00Z`),
      )
    : "Sin registrar";
type Confirmation = "close" | "cancel-edit" | "retire" | "readmit" | null;

type MemberDetailsProps = {
  member: Member;
  editable: boolean;
  onClose: () => void;
  onLifecycleComplete: (status: MembershipStatus, message: string) => void;
  onDownload: () => void;
  downloadBusy: boolean;
  downloadError: string;
};

function DetailList({ items }: { items: string[][] }) {
  return (
    <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="mt-1 break-words text-sm">
            {value || "Sin registrar"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MemberDetails({
  member,
  editable,
  onClose,
  onLifecycleComplete,
  onDownload,
  downloadBusy,
  downloadError,
}: MemberDetailsProps) {
  const { retireMember, readmitMember } = usePortal();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const previousControl = useRef<HTMLElement | null>(null);
  const formId = `member-editor-${member.id}`;
  const age = ageOnDate(member.birthDate);
  const readmissionCategory =
    age !== null && age < 18 ? "Postulante" : "Reingresante";

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    titleRef.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (confirmation) continueRef.current?.focus();
  }, [confirmation]);

  function ask(action: Exclude<Confirmation, null>) {
    previousControl.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setConfirmation(action);
    setError("");
  }

  function requestClose() {
    if (photoBusy) {
      setError(
        "Espera a que termine de cargar la fotografía antes de cerrar la ficha.",
      );
      return;
    }
    if (editing && dirty) ask("close");
    else onClose();
  }

  function resume() {
    setConfirmation(null);
    requestAnimationFrame(() =>
      (previousControl.current?.isConnected
        ? previousControl.current
        : titleRef.current
      )?.focus(),
    );
  }

  function cancelEdit() {
    if (photoBusy) return;
    if (dirty) ask("cancel-edit");
    else {
      setEditing(false);
      titleRef.current?.focus();
    }
  }

  function confirmAction() {
    if (confirmation === "close") {
      onClose();
      return;
    }
    if (confirmation === "cancel-edit") {
      setEditing(false);
      setDirty(false);
      setConfirmation(null);
      requestAnimationFrame(() => titleRef.current?.focus());
      return;
    }
    try {
      if (confirmation === "retire") {
        retireMember(member.id);
        onLifecycleComplete(
          "retirado",
          `${member.fullName} pasó al listado de retirados. Su ficha y movimientos se conservaron y su acceso quedó suspendido.`,
        );
      } else if (confirmation === "readmit") {
        readmitMember(member.id);
        onLifecycleComplete(
          "vigente",
          `Se registró el reingreso de ${member.fullName}. Conserva su usuario y movimientos, con categoría ${readmissionCategory} y perfil Estándar.`,
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar el estado del hermano.",
      );
      setConfirmation(null);
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }

  function saved() {
    setEditing(false);
    setDirty(false);
    setMessage("Ficha del hermano actualizada correctamente.");
    requestAnimationFrame(() => {
      titleRef.current?.focus();
      dialogRef.current
        ?.querySelector("[data-detail-scroll]")
        ?.scrollTo({ top: 0 });
    });
  }

  const confirmationText =
    confirmation === "retire"
      ? "¿Marcar al hermano como retirado? Su ficha y movimientos se conservarán en el listado de retirados. Su acceso al portal quedará suspendido hasta que Secretaría registre su reingreso."
      : confirmation === "readmit"
        ? `¿Registrar su reingreso? Se reactivará la misma cuenta y volverá al padrón como ${readmissionCategory}, con perfil Estándar durante el periodo de prueba. ${readmissionCategory === "Postulante" ? "Por ser menor de edad, no puede tener categoría Activo." : "Su categoría Activo no se recupera automáticamente."}`
        : "Hay cambios en la ficha que aún no se han guardado. ¿Deseas descartarlos?";
  const confirmLabel =
    confirmation === "retire"
      ? "Confirmar retiro"
      : confirmation === "readmit"
        ? "Confirmar reingreso"
        : confirmation === "close"
          ? "Descartar y cerrar"
          : "Descartar cambios";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="member-detail-title"
      aria-describedby="member-detail-description"
      onCancel={(event) => {
        event.preventDefault();
        if (confirmation) resume();
        else requestClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-paper p-0 text-ink backdrop:bg-ink/50"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-line bg-white-warm px-4 py-4 sm:px-8">
          <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
            <div>
              <p className="eyebrow">
                Padrón de hermanos · {editing ? "Edición" : "Vista detalle"}
              </p>
              <h2
                id="member-detail-title"
                ref={titleRef}
                tabIndex={-1}
                className="mt-2 font-display text-2xl sm:text-3xl"
              >
                {member.fullName}
              </h2>
              <p
                className="mt-2 text-sm text-muted"
                id="member-detail-description"
              >
                {editing
                  ? "Actualiza la ficha y guarda los cambios para aplicarlos."
                  : "Consulta la información registrada en su ficha de inscripción."}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={requestClose}
              aria-label="Cerrar ficha"
              disabled={photoBusy}
            >
              <X className="size-5" />
            </Button>
          </div>
        </header>
        {confirmation && (
          <section
            className="shrink-0 border-b border-clay bg-mist px-4 py-4 sm:px-8"
            role="alert"
            aria-label="Confirmar acción"
          >
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
              <p className="max-w-3xl text-sm leading-6">{confirmationText}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  ref={continueRef}
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={resume}
                >
                  {confirmation === "close" || confirmation === "cancel-edit"
                    ? "Continuar edición"
                    : "Cancelar"}
                </Button>
                <Button size="sm" type="button" onClick={confirmAction}>
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </section>
        )}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8"
          data-detail-scroll
        >
          <div className="mx-auto max-w-6xl space-y-6">
            {message && (
              <p
                className="rounded-sm border border-line bg-mist p-4 text-sm"
                role="status"
              >
                {message}
              </p>
            )}
            {(error || downloadError) && (
              <p
                className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                role="alert"
              >
                {error || downloadError}
              </p>
            )}
            {editing && editable ? (
              <MemberEditor
                key={member.id}
                member={member}
                formId={formId}
                onDirtyChange={setDirty}
                onSaved={saved}
                onBusyChange={(busy) => {
                  setPhotoBusy(busy);
                  if (!busy) setError("");
                }}
              />
            ) : (
              <>
                <section
                  className="rounded-sm border border-line bg-white-warm p-5 sm:p-7"
                  aria-labelledby="member-personal-title"
                >
                  <div className="mb-6 flex flex-wrap items-center gap-4">
                    <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-sm border border-line bg-paper text-clay-text">
                      {member.photo ? (
                        <Image
                          src={member.photo}
                          alt={`Fotografía de ${member.fullName}`}
                          width={80}
                          height={80}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound className="size-8" aria-hidden="true" />
                      )}
                    </span>
                    <div>
                      <p className="text-xs text-muted">
                        {age !== null && age < 18
                          ? "Ficha de menor de edad"
                          : "Ficha de mayor de edad"}
                        {age !== null ? ` · ${age} años` : ""}
                      </p>
                      <h3
                        id="member-personal-title"
                        className="mt-2 font-display text-xl"
                      >
                        Datos personales
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="accent">
                          {categoryLabels[member.category]}
                        </Badge>
                        <Badge>{roleLabels[member.role]}</Badge>
                        <Badge
                          variant={
                            member.status === "retirado" ? "muted" : "success"
                          }
                        >
                          {statusLabels[member.status]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <DetailList
                    items={[
                      ["Nombres y apellidos", member.fullName],
                      ["DNI", member.dni],
                      ["Fecha de nacimiento", dateLabel(member.birthDate)],
                      ["Dirección", member.address],
                      ["Celular", member.phone],
                      ["Correo electrónico", member.email || "Sin correo"],
                      ["Profesión u ocupación", member.occupation],
                      ["Estado civil", member.maritalStatus],
                      ["Sacramentos recibidos", member.sacraments.join(", ")],
                    ]}
                  />
                </section>
                {member.guardian && (
                  <section
                    className="rounded-sm border border-line bg-white-warm p-5 sm:p-7"
                    aria-labelledby="member-guardian-title"
                  >
                    <h3
                      id="member-guardian-title"
                      className="mb-5 font-display text-xl"
                    >
                      Datos del apoderado
                    </h3>
                    <DetailList
                      items={[
                        ["Nombres y apellidos", member.guardian.fullName],
                        ["DNI", member.guardian.dni],
                        ["Parentesco", member.guardian.relationship],
                        ["Edad", member.guardian.age],
                        ["Grado de instrucción", member.guardian.education],
                        ["Dirección", member.guardian.address],
                        ["Celular", member.guardian.phone],
                        [
                          "Sacramentos recibidos",
                          member.guardian.sacraments.join(", "),
                        ],
                      ]}
                    />
                  </section>
                )}
                <section
                  className="rounded-sm border border-line bg-white-warm p-5 sm:p-7"
                  aria-labelledby="member-institution-title"
                >
                  <h3
                    id="member-institution-title"
                    className="mb-5 font-display text-xl"
                  >
                    Información institucional y acceso
                  </h3>
                  <DetailList
                    items={[
                      ["Categoría", categoryLabels[member.category]],
                      ["Estado en el padrón", statusLabels[member.status]],
                      ["Fecha de ingreso", dateLabel(member.joinedAt)],
                      ["Fecha de juramentación", dateLabel(member.swornAt)],
                      ["Perfil de acceso", roleLabels[member.role]],
                      ["Usuario de acceso", member.username],
                      ["Último retiro", dateLabel(member.retiredAt)],
                      ["Último reingreso", dateLabel(member.rejoinedAt)],
                      [
                        "Acceso al portal",
                        member.status === "retirado"
                          ? "Suspendido mientras esté retirado"
                          : "Habilitado",
                      ],
                    ]}
                  />
                  {member.category === "reingresante" && (
                    <p className="mt-5 rounded-sm bg-paper p-4 text-sm leading-6 text-muted">
                      Está en periodo de prueba para recuperar su categoría
                      Activo. El cambio debe registrarlo Secretaría cuando
                      corresponda.
                    </p>
                  )}
                  <p className="mt-5 text-xs leading-5 text-muted">
                    Los 30 años para la categoría Vitalicio se cuentan desde la
                    juramentación.
                  </p>
                </section>
                {member.membershipHistory.length > 0 && (
                  <section
                    className="rounded-sm border border-line bg-white-warm p-5 sm:p-7"
                    aria-labelledby="member-history-title"
                  >
                    <h3
                      id="member-history-title"
                      className="font-display text-xl"
                    >
                      Historial de retiros y reingresos
                    </h3>
                    <ul className="mt-4 divide-y divide-line">
                      {member.membershipHistory.map((event, index) => (
                        <li
                          key={`${event.type}-${event.date}-${index}`}
                          className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                        >
                          <span>
                            {event.type === "retiro"
                              ? "Retiro registrado"
                              : "Reingreso registrado"}{" "}
                            · {categoryLabels[event.category]}
                          </span>
                          <span className="text-muted">
                            {dateLabel(event.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
        <footer className="shrink-0 border-t border-line bg-white-warm px-4 py-4 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            {editing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEdit}
                  disabled={photoBusy}
                >
                  <ArrowLeft className="size-4" />
                  Cancelar edición
                </Button>
                <Button
                  type="submit"
                  form={formId}
                  disabled={confirmation !== null || photoBusy}
                >
                  <Save className="size-4" />
                  {photoBusy ? "Cargando fotografía…" : "Guardar cambios"}
                </Button>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {editable && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        ask(member.status === "retirado" ? "readmit" : "retire")
                      }
                      disabled={confirmation !== null}
                    >
                      {member.status === "retirado" ? (
                        <RotateCcw className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}
                      {member.status === "retirado"
                        ? "Registrar reingreso"
                        : "Marcar como retirado"}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onDownload}
                    disabled={downloadBusy || confirmation !== null}
                  >
                    <Download className="size-4" />
                    {downloadBusy ? "Preparando PDF…" : "Descargar ficha (PDF)"}
                  </Button>
                  {editable && (
                    <Button
                      type="button"
                      disabled={confirmation !== null}
                      onClick={() => {
                        setEditing(true);
                        setDirty(false);
                        setMessage("");
                        setError("");
                        requestAnimationFrame(() => {
                          titleRef.current?.focus();
                          dialogRef.current
                            ?.querySelector("[data-detail-scroll]")
                            ?.scrollTo({ top: 0 });
                        });
                      }}
                    >
                      <Pencil className="size-4" />
                      Habilitar edición
                    </Button>
                  )}
                  <Button type="button" variant="ghost" onClick={requestClose}>
                    Cerrar
                  </Button>
                </div>
              </>
            )}
          </div>
        </footer>
      </div>
    </dialog>
  );
}

export { MemberDetails };
