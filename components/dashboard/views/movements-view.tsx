"use client";

import { ReceiptText } from "lucide-react";
import { useLoadedPortal } from "@/components/dashboard/portal-session";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { movementTypeLabels } from "@/lib/portal";
import { formatDate } from "@/lib/utils";

const money = (cents: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(cents / 100);

/** `institution` es la caja de Tesorería; `personal` es el estado de cuenta del propio hermano. */
export function MovementsView({ scope }: { scope: "institution" | "personal" }) {
  const { data, identity } = useLoadedPortal();
  const institution = scope === "institution";
  const movements = institution
    ? data.movements
    : data.movements.filter((movement) => movement.memberId === identity.user.hermanoId);

  return (
    <>
      <PageHeader eyebrow={institution ? "Tesorería · Consulta" : "Consulta personal"}
        title={institution ? "Tesorería" : "Mi estado de cuenta"}
        description={institution ? "Movimientos registrados de la institución. Solo lectura." : "Tus cuotas, pagos y movimientos registrados. Solo lectura."} />
      <Panel aria-labelledby="movements-title">
        <PanelHeader id="movements-title" title="Movimientos"
          aside={<><span className="font-semibold tabular-nums text-ink">{movements.length}</span> {movements.length === 1 ? "registro" : "registros"}</>} />
        <PanelBody>
          {movements.length === 0 ? <EmptyState icon={ReceiptText} title="No hay movimientos registrados"
            description="Los movimientos aparecerán aquí cuando se registren." /> :
            <DataTable caption={institution ? "Movimientos de tesorería" : "Movimientos de mi estado de cuenta"}
              rows={movements} rowKey={(movement) => movement.id}
              columns={[
                {header:"Fecha", cell:(movement) => <span className="tabular-nums">{formatDate(movement.date)}</span>},
                {header:"Descripción", kind:"primary", cell:(movement) => <span className="font-medium text-ink">{movement.description}</span>},
                {header:"Tipo", cell:(movement) => <Badge variant={movement.type === "ingreso" || movement.type === "pago" ? "success" : "accent"}>{movementTypeLabels[movement.type]}</Badge>},
                {header:"Importe", className:"text-right tabular-nums", cell:(movement) => <span className="whitespace-nowrap font-medium tabular-nums">{money(movement.amountCents)}</span>},
              ]} />}
        </PanelBody>
      </Panel>
    </>
  );
}
