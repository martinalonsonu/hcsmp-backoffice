"use client";

import { useLoadedPortal } from "@/components/dashboard/portal-session";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { categoryLabels, statusLabels } from "@/lib/portal";

export function ProfileView() {
  const { data } = useLoadedPortal();
  const { member } = data;
  const fields: Array<[string, React.ReactNode]> = [
    ["Nombre", member.fullName],
    ["DNI", member.dni || "Sin registrar"],
    ["Categoría", <Badge key="categoria" variant="accent">{categoryLabels[member.category]}</Badge>],
    ["Estado", <Badge key="estado" variant={member.status === "vigente" ? "success" : "muted"}>{statusLabels[member.status]}</Badge>],
    ["Correo electrónico", member.email || "Sin registrar"],
    ["Teléfono", member.phone || "Sin registrar"],
  ];

  return (
    <>
      <PageHeader eyebrow="Mi información" title="Mi perfil"
        description="Datos de tu ficha institucional. Para corregirlos, comunícate con Secretaría." />
      <Panel aria-labelledby="profile-title">
        <PanelHeader id="profile-title" title="Datos de la ficha" />
        <PanelBody>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {fields.map(([label, value]) => <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold text-muted">{label}</dt>
              <dd className="mt-1 break-words text-sm text-ink">{value}</dd>
            </div>)}
          </dl>
        </PanelBody>
      </Panel>
    </>
  );
}
