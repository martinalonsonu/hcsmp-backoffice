"use client";

import { useState, type FormEvent } from "react";
import { Inbox, LoaderCircle, Send } from "lucide-react";
import { useLoadedPortal } from "@/components/dashboard/portal-session";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select, Textarea } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { requestStatusLabels, type RequestStatus } from "@/lib/portal";
import { setInstitutionalRequestStatus, submitInstitutionalRequest } from "@/lib/firebase/requests";
import { formatDate } from "@/lib/utils";

export function RequestsView() {
  const { data, identity, role, reload } = useLoadedPortal();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await submitInstitutionalRequest(identity, title, content);
      setTitle(""); setContent("");
      reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo enviar la solicitud.");
    } finally { setBusy(false); }
  }

  async function changeStatus(requestId: string, status: RequestStatus) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await setInstitutionalRequestStatus(identity, requestId, status);
      reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No se pudo actualizar la solicitud.");
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader eyebrow={role === "secretaria" ? "Secretaría · Seguimiento" : "Mi espacio"} title="Solicitudes"
        description={role === "secretaria" ? "Revisa las solicitudes recibidas y actualiza su seguimiento." : "Envía solicitudes a Secretaría y consulta su estado."} />
      {message && <Alert variant="error">{message}</Alert>}
      {role !== "secretaria" && <Panel aria-labelledby="new-request-title">
        <PanelHeader id="new-request-title" title="Nueva solicitud a Secretaría" description="Describe tu pedido con claridad para agilizar la respuesta." />
        <form onSubmit={(event) => void sendRequest(event)}>
          <PanelBody className="space-y-4">
            <Field label="Asunto" hint="Entre 5 y 120 caracteres.">
              <Input required minLength={5} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Contenido" hint="Mínimo 10 caracteres.">
              <Textarea required minLength={10} maxLength={5000} rows={5} value={content} onChange={(event) => setContent(event.target.value)} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                {busy ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin"/> Enviando…</> : <><Send aria-hidden="true" className="size-4"/> Enviar solicitud</>}
              </Button>
            </div>
          </PanelBody>
        </form>
      </Panel>}
      <Panel aria-labelledby="requests-list-title">
        <PanelHeader id="requests-list-title" title={role === "secretaria" ? "Solicitudes recibidas" : "Mis solicitudes"}
          aside={<><span className="font-semibold tabular-nums text-ink">{data.requests.length}</span> {data.requests.length === 1 ? "solicitud" : "solicitudes"}</>} />
        <PanelBody>
          {data.requests.length === 0 ? <EmptyState icon={Inbox} title="No hay solicitudes registradas"
            description={role === "secretaria" ? "Cuando los hermanos envíen solicitudes, aparecerán aquí." : "Tus solicitudes enviadas aparecerán aquí."} /> :
            <ul className="space-y-4">{data.requests.map((request) => <li key={request.id}>
              <article className="space-y-3 rounded-sm border border-line p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-ink">{request.title}</h3>
                    <p className="mt-1 text-xs text-muted">Enviada el {formatDate(request.submittedAt)}</p>
                  </div>
                  <Badge variant={request.status === "resuelta" ? "success" : request.status === "enviada" ? "default" : "accent"}>{requestStatusLabels[request.status]}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">{request.content}</p>
                {role === "secretaria" && request.status !== "resuelta" && <Field label="Actualizar seguimiento" className="sm:max-w-xs">
                  <Select className="h-10" disabled={busy} value={request.status}
                    onChange={(event) => void changeStatus(request.id, event.target.value as RequestStatus)}>
                    <option value={request.status}>{requestStatusLabels[request.status]}</option>
                    {(["en_revision", "derivada", "resuelta"] as const).filter((status) => status !== request.status)
                      .map((status) => <option key={status} value={status}>{requestStatusLabels[status]}</option>)}
                  </Select>
                </Field>}
              </article>
            </li>)}</ul>}
        </PanelBody>
      </Panel>
    </>
  );
}
