"use client";

import { usePortal } from "@/components/portal/portal-provider";

const money = (amount: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    amount,
  );
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("es-PE");

function AccountPanel() {
  const { currentMember, movements } = usePortal();
  if (!currentMember) return null;

  const ownMovements = movements
    .filter(
      (movement) =>
        movement.memberId === currentMember.id &&
        (movement.type === "cargo" || movement.type === "pago"),
    )
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const charges = ownMovements
    .filter((movement) => movement.type === "cargo")
    .reduce((total, movement) => total + movement.amount, 0);
  const payments = ownMovements
    .filter((movement) => movement.type === "pago")
    .reduce((total, movement) => total + movement.amount, 0);
  const balance = charges - payments;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Consulta personal</p>
        <h1 className="mt-2 font-display text-3xl">Mi estado de cuenta</h1>
        <p className="mt-2 text-sm text-muted">
          Cuotas y pagos registrados a nombre de {currentMember.fullName}.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Cargos acumulados", charges],
          ["Pagos registrados", payments],
          [
            balance < 0 ? "Saldo a favor" : "Saldo pendiente",
            Math.abs(balance),
          ],
        ].map(([label, amount]) => (
          <div
            className="rounded-sm border border-line bg-white-warm p-5"
            key={String(label)}
          >
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-3 font-display text-2xl">
              {money(Number(amount))}
            </p>
          </div>
        ))}
      </div>
      <section
        className="rounded-sm border border-line bg-white-warm"
        aria-labelledby="own-movements-title"
      >
        <div className="border-b border-line p-5">
          <h2 id="own-movements-title" className="font-display text-xl">
            Mis movimientos
          </h2>
          <p className="mt-1 text-xs text-muted">
            Si necesitas revisar un pago, comunícate con Tesorería.
          </p>
        </div>
        {ownMovements.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            Todavía no tienes cargos ni pagos registrados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-140 text-left text-sm">
              <caption className="sr-only">
                Cargos y pagos de mi cuenta personal
              </caption>
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th className="p-4" scope="col">
                    Fecha
                  </th>
                  <th className="p-4" scope="col">
                    Concepto
                  </th>
                  <th className="p-4" scope="col">
                    Tipo
                  </th>
                  <th className="p-4 text-right" scope="col">
                    Importe
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ownMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="p-4 whitespace-nowrap">
                      {dateLabel(movement.date)}
                    </td>
                    <td className="p-4">{movement.description}</td>
                    <td className="p-4">
                      {movement.type === "cargo" ? "Cargo" : "Pago"}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {money(movement.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export { AccountPanel };
