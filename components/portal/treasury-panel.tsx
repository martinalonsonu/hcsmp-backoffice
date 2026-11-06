"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { usePortal } from "@/components/portal/portal-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayDate, type Movement } from "@/lib/portal";

const money = (amount: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    amount,
  );
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("es-PE");
const typeLabels: Record<Movement["type"], string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  cargo: "Cargo a hermano",
  pago: "Pago de hermano",
};
const selectClass =
  "h-12 w-full rounded-sm border border-line bg-white-warm px-3 text-sm focus-visible:outline-clay";

function TreasuryPanel({ debtsOnly = false }: { debtsOnly?: boolean }) {
  const { currentMember, members, movements, addMovement } = usePortal();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<Movement["type"]>("pago");
  const [memberId, setMemberId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayDate);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  if (!currentMember) return null;

  const canManage = currentMember.role === "tesoreria";
  const canRead =
    canManage ||
    currentMember.role === "presidencia" ||
    currentMember.role === "secretaria";
  if (!canRead)
    return (
      <p
        role="alert"
        className="rounded-sm border border-line bg-white-warm p-5 text-sm"
      >
        Tu perfil no tiene acceso a la tesorería institucional.
      </p>
    );
  const onlyDebts = debtsOnly || currentMember.role === "secretaria";
  const needsMember = type === "cargo" || type === "pago";
  const income = movements
    .filter(
      (movement) => movement.type === "ingreso" || movement.type === "pago",
    )
    .reduce((total, movement) => total + movement.amount, 0);
  const expenses = movements
    .filter((movement) => movement.type === "egreso")
    .reduce((total, movement) => total + movement.amount, 0);
  const debts = members.map((member) => {
    const own = movements.filter((movement) => movement.memberId === member.id);
    const charges = own
      .filter((movement) => movement.type === "cargo")
      .reduce((total, movement) => total + movement.amount, 0);
    const payments = own
      .filter((movement) => movement.type === "pago")
      .reduce((total, movement) => total + movement.amount, 0);
    return { member, charges, payments, balance: charges - payments };
  });
  const totalDebt = debts.reduce(
    (total, item) => total + Math.max(item.balance, 0),
    0,
  );
  const cashMovements = movements
    .filter((movement) => movement.type !== "cargo")
    .toSorted((a, b) => b.date.localeCompare(a.date));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Ingresa un importe mayor que cero.");
      return;
    }
    if (!description.trim()) {
      setError("Ingresa el concepto del movimiento.");
      return;
    }
    if (!date || date > todayDate()) {
      setError("La fecha no puede ser futura.");
      return;
    }
    if (needsMember && !memberId) {
      setError("Selecciona al hermano al que corresponde el cargo o pago.");
      return;
    }
    try {
      addMovement({
        date,
        description: description.trim(),
        memberId: needsMember ? memberId : "",
        type,
        amount: numericAmount,
      });
      setAmount("");
      setDescription("");
      setShowForm(false);
      setSuccess("Movimiento registrado correctamente.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo registrar el movimiento.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {onlyDebts ? "Consulta institucional" : "Gestión económica"}
          </p>
          <h1 className="mt-2 font-display text-3xl">
            {onlyDebts ? "Deudas generales" : "Tesorería"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {onlyDebts
              ? "Padrón asociado a los cargos y pagos de los hermanos."
              : "Ingresos, egresos y pagos de la Hermandad."}
          </p>
        </div>
        {canManage && !onlyDebts ? (
          <Button
            type="button"
            onClick={() => {
              setShowForm(!showForm);
              setError("");
              setSuccess("");
            }}
          >
            {showForm ? (
              <X aria-hidden="true" className="size-4" />
            ) : (
              <Plus aria-hidden="true" className="size-4" />
            )}
            {showForm ? "Cerrar formulario" : "Registrar movimiento"}
          </Button>
        ) : (
          <span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
            Solo consulta
          </span>
        )}
      </div>
      {success && (
        <p
          role="status"
          className="rounded-sm border border-line bg-mist p-3 text-sm"
        >
          {success}
        </p>
      )}
      {!onlyDebts && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Ingresos y pagos", income],
            ["Egresos", expenses],
            ["Saldo de caja", income - expenses],
          ].map(([label, value]) => (
            <div
              className="rounded-sm border border-line bg-white-warm p-5"
              key={String(label)}
            >
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-3 font-display text-2xl">
                {money(Number(value))}
              </p>
            </div>
          ))}
        </div>
      )}
      {showForm && canManage && !onlyDebts && (
        <form
          onSubmit={handleSubmit}
          className="rounded-sm border border-line bg-white-warm p-5 sm:p-6"
        >
          <h2 className="font-display text-xl">Nuevo movimiento</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="block">Tipo de movimiento</span>
              <select
                className={selectClass}
                value={type}
                onChange={(event) =>
                  setType(event.target.value as Movement["type"])
                }
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="block">Fecha</span>
              <Input
                type="date"
                required
                max={todayDate()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            {needsMember && (
              <label className="space-y-2 text-sm sm:col-span-2">
                <span className="block">Hermano</span>
                <select
                  className={selectClass}
                  required
                  value={memberId}
                  onChange={(event) => setMemberId(event.target.value)}
                >
                  <option value="">Selecciona un hermano</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName} · DNI {member.dni}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="space-y-2 text-sm">
              <span className="block">Concepto</span>
              <Input
                required
                maxLength={180}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ej.: cuota de noviembre"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="block">Importe (S/)</span>
              <Input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </label>
          </div>
          {error && (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="submit">Guardar movimiento</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
      <section
        className="rounded-sm border border-line bg-white-warm"
        aria-labelledby="debts-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <div>
            <h2 className="font-display text-xl" id="debts-heading">
              Deudas de los hermanos
            </h2>
            <p className="mt-1 text-xs text-muted">
              Los cargos generan deuda; los pagos reducen el saldo.
            </p>
          </div>
          <p className="text-sm">
            Pendiente total: <strong>{money(totalDebt)}</strong>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
            <caption className="sr-only">Padrón asociado a deudas</caption>
            <thead className="bg-paper text-xs text-muted">
              <tr>
                <th className="p-4" scope="col">
                  Hermano
                </th>
                <th className="p-4 text-right" scope="col">
                  Cargos
                </th>
                <th className="p-4 text-right" scope="col">
                  Pagos
                </th>
                <th className="p-4 text-right" scope="col">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {debts.map(({ member, charges, payments, balance }) => (
                <tr key={member.id}>
                  <th scope="row" className="p-4 font-medium">
                    <span className="block">{member.fullName}</span>
                    <span className="mt-1 block text-xs font-normal text-muted">
                      DNI {member.dni}
                    </span>
                  </th>
                  <td className="p-4 text-right whitespace-nowrap">
                    {money(charges)}
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    {money(payments)}
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    {balance < 0
                      ? `${money(-balance)} a favor`
                      : money(balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {!onlyDebts && (
        <section
          className="rounded-sm border border-line bg-white-warm"
          aria-labelledby="cash-heading"
        >
          <div className="border-b border-line p-5">
            <h2 className="font-display text-xl" id="cash-heading">
              Movimientos de caja
            </h2>
            <p className="mt-1 text-xs text-muted">
              Incluye ingresos, egresos y pagos; los cargos no representan
              dinero recibido.
            </p>
          </div>
          {cashMovements.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              No hay movimientos registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-160 text-left text-sm">
                <caption className="sr-only">
                  Ingresos, egresos y pagos institucionales
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
                  {cashMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="p-4 whitespace-nowrap">
                        {dateLabel(movement.date)}
                      </td>
                      <td className="p-4">
                        <span className="block">{movement.description}</span>
                        {movement.memberId && (
                          <span className="mt-1 block text-xs text-muted">
                            {members.find(
                              (member) => member.id === movement.memberId,
                            )?.fullName ?? "Hermano"}
                          </span>
                        )}
                      </td>
                      <td className="p-4">{typeLabels[movement.type]}</td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {movement.type === "egreso" ? "− " : "+ "}
                        {money(movement.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export { TreasuryPanel };
