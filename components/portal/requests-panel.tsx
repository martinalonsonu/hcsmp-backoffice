"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { usePortal } from "@/components/portal/portal-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isRequestStatus, type RequestStatus } from "@/lib/portal";

const requestStatuses: Array<{ value: RequestStatus; label: string }> = [
  { value: "enviada", label: "Enviada" },
  { value: "en_revision", label: "En revisión" },
  { value: "derivada", label: "Derivada" },
  { value: "resuelta", label: "Resuelta" },
];
const statusLabels = Object.fromEntries(
  requestStatuses.map(({ value, label }) => [value, label]),
) as Record<RequestStatus, string>;
const selectClass =
  "h-11 rounded-sm border border-line bg-white-warm px-3 text-sm focus-visible:outline-clay";
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("es-PE");

function RequestsPanel() {
  const {
    currentMember,
    members,
    requests,
    submitRequest,
    updateRequestStatus,
  } = usePortal();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusError, setStatusError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!showForm || !dialog || dialog.open) return;
    dialog.showModal();
    return () => dialog.close();
  }, [showForm]);

  if (!currentMember) return null;
  const isSecretary = currentMember.role === "secretaria";
  const visibleRequests = requests
    .filter((request) =>
      isSecretary ? true : request.requesterId === currentMember.id,
    )
    .toSorted((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  function closeForm() {
    setShowForm(false);
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      submitRequest(title, content);
      setTitle("");
      setContent("");
      setShowForm(false);
      setSuccess("Tu solicitud fue enviada a Secretaría.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo enviar la solicitud.",
      );
    }
  }

  function changeStatus(id: string, value: string) {
    setStatusError("");
    try {
      if (!isRequestStatus(value))
        throw new Error("Selecciona un estado válido.");
      updateRequestStatus(id, value);
    } catch (cause) {
      setStatusError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar el estado de la solicitud.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {isSecretary ? "Atención y seguimiento" : "Comunicación institucional"}
          </p>
          <h1 className="mt-2 font-display text-3xl">Solicitudes</h1>
          <p className="mt-2 text-sm text-muted">
            {isSecretary
              ? "Revisa las solicitudes recibidas y actualiza su estado."
              : "Envía solicitudes a Secretaría y consulta su seguimiento."}
          </p>
        </div>
        {!isSecretary && (
          <Button
            type="button"
            onClick={() => {
              setShowForm(true);
              setError("");
              setSuccess("");
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Nueva solicitud
          </Button>
        )}
      </header>

      {success && (
        <p
          role="status"
          className="rounded-sm border border-line bg-mist p-3 text-sm"
        >
          {success}
        </p>
      )}
      {statusError && (
        <p role="alert" className="text-sm text-red-700">
          {statusError}
        </p>
      )}
      <section
        className="rounded-sm border border-line bg-white-warm"
        aria-labelledby="requests-list-heading"
      >
        <div className="border-b border-line p-5">
          <h2 className="font-display text-xl" id="requests-list-heading">
            {isSecretary ? "Todas las solicitudes" : "Mis solicitudes"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {visibleRequests.length}{" "}
            {visibleRequests.length === 1 ? "solicitud" : "solicitudes"}
          </p>
        </div>
        {visibleRequests.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            {isSecretary
              ? "Todavía no se han recibido solicitudes."
              : "Aún no has enviado solicitudes."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {visibleRequests.map((request) => {
              const requester = members.find(
                (member) => member.id === request.requesterId,
              );
              return (
                <li className="space-y-4 p-5 sm:p-6" key={request.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg">{request.title}</h3>
                      <p className="mt-1 text-xs text-muted">
                        {isSecretary && requester
                          ? `${requester.fullName} · `
                          : ""}
                        Enviada el {dateLabel(request.submittedAt)}
                        {request.updatedAt !== request.submittedAt &&
                          ` · Actualizada el ${dateLabel(request.updatedAt)}`}
                      </p>
                    </div>
                    {isSecretary ? (
                      <label className="grid gap-1 text-xs text-muted">
                        Estado
                        <select
                          aria-label={`Estado de: ${request.title}`}
                          className={selectClass}
                          value={request.status}
                          onChange={(event) =>
                            changeStatus(request.id, event.target.value)
                          }
                        >
                          {requestStatuses.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <span className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium">
                        {statusLabels[request.status]}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted">
                    {request.content}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!isSecretary && (
        <dialog
          ref={dialogRef}
          aria-labelledby="new-request-title"
          aria-describedby="new-request-description"
          onCancel={(event) => {
            event.preventDefault();
            closeForm();
          }}
          className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-paper p-0 text-ink backdrop:bg-ink/50"
        >
          <form
            className="flex h-full min-h-0 flex-col"
            onSubmit={handleSubmit}
          >
            <header className="shrink-0 border-b border-line bg-white-warm px-4 py-4 sm:px-8">
              <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Solicitudes · Secretaría</p>
                  <h2
                    className="mt-2 font-display text-2xl sm:text-3xl"
                    id="new-request-title"
                  >
                    Nueva solicitud
                  </h2>
                  <p
                    className="mt-2 text-sm text-muted"
                    id="new-request-description"
                  >
                    Describe lo que necesitas para que Secretaría pueda darle
                    seguimiento.
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Cerrar solicitud"
                  onClick={closeForm}
                >
                  <X aria-hidden="true" className="size-5" />
                </Button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-9">
              <div className="mx-auto grid max-w-4xl gap-5 rounded-sm border border-line bg-white-warm p-5 sm:p-7">
                <label className="grid gap-2 text-sm font-medium">
                  Título
                  <Input
                    autoFocus
                    required
                    maxLength={120}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Resume el motivo de tu solicitud"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Detalle de la solicitud
                  <textarea
                    className="min-h-56 w-full resize-y rounded-sm border border-line bg-white-warm p-4 text-sm leading-6 focus-visible:outline-clay"
                    required
                    maxLength={5000}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Escribe aquí tu solicitud..."
                  />
                  <span className="text-right text-xs font-normal text-muted">
                    {content.length}/5000
                  </span>
                </label>
                {error && (
                  <p className="text-sm text-red-700" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </div>
            <footer className="shrink-0 border-t border-line bg-white-warm px-4 py-4 sm:px-8">
              <div className="mx-auto flex max-w-5xl flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForm}
                >
                  Cancelar
                </Button>
                <Button type="submit">Enviar solicitud</Button>
              </div>
            </footer>
          </form>
        </dialog>
      )}
    </div>
  );
}

export { RequestsPanel };
