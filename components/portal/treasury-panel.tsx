"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { usePortal } from "@/components/portal/portal-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  nextMonth,
  statusLabels,
  type Movement,
} from "@/lib/portal";

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

const treasurySections = [
  { id: "overview", label: "Resumen" },
  { id: "movements", label: "Movimientos" },
  { id: "fees", label: "Cuotas y cobranzas" },
  { id: "reports", label: "Reportes" },
] as const;
type TreasurySection = (typeof treasurySections)[number]["id"];

function TreasuryPanel({ debtsOnly = false }: { debtsOnly?: boolean }) {
  const searchParams = useSearchParams();
  const {
    currentMember,
    currentDate,
    members,
    movements,
    ordinaryFees,
    billingStartMonth,
    addMovement,
    updateOrdinaryFee,
  } = usePortal();
  const [showForm, setShowForm] = useState(false);
  const movementDialogRef = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<Movement["type"]>("pago");
  const [memberId, setMemberId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reportMonth, setReportMonth] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeError, setFeeError] = useState("");
  const [feeSuccess, setFeeSuccess] = useState("");
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    const dialog = movementDialogRef.current;
    if (!showForm || !dialog || dialog.open) return;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, [showForm]);

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
  const requestedSection = searchParams.get("section");
  const section: TreasurySection = treasurySections.some(
    (item) => item.id === requestedSection,
  )
    ? (requestedSection as TreasurySection)
    : "overview";
  const sectionTitle = onlyDebts
    ? "Deudas generales"
    : (treasurySections.find((item) => item.id === section)?.label ??
      "Tesorería");
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
  const selectedReportMonth = reportMonth || currentDate.slice(0, 7);
  const selectedDate = date || currentDate;
  const reportingMovements = movements.filter(
    (movement) =>
      movement.date.startsWith(`${selectedReportMonth}-`) &&
      movement.type !== "cargo",
  );
  const monthlyIncome = reportingMovements
    .filter((movement) => movement.type === "ingreso" || movement.type === "pago")
    .reduce((total, movement) => total + movement.amount, 0);
  const monthlyExpenses = reportingMovements
    .filter((movement) => movement.type === "egreso")
    .reduce((total, movement) => total + movement.amount, 0);
  const currentOrdinaryFee =
    ordinaryFees
      .filter((rate) => rate.effectiveMonth <= currentDate.slice(0, 7))
      .toSorted((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
      .at(-1)?.amount ?? 10;

  async function downloadCashReport() {
    setReportError("");
    try {
      const { downloadMonthlyCashReport } = await import("@/lib/cash-report");
      await downloadMonthlyCashReport(
        reportingMovements,
        members,
        selectedReportMonth,
      );
    } catch (cause) {
      setReportError(
        cause instanceof Error
          ? cause.message
          : "No se pudo generar el resumen de caja.",
      );
    }
  }

  function saveOrdinaryFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeeError("");
    setFeeSuccess("");
    const amount = Number(feeAmount);
    try {
      updateOrdinaryFee(amount);
      setFeeAmount("");
      const effectiveMonth = nextMonth(currentDate.slice(0, 7));
      setFeeSuccess(
        `La nueva cuota ordinaria regirá desde el ${dateLabel(`${effectiveMonth}-01`)}.`,
      );
    } catch (cause) {
      setFeeError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar la cuota.",
      );
    }
  }

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
    if (!selectedDate || selectedDate > currentDate) {
      setError("La fecha no puede ser futura.");
      return;
    }
    if (needsMember && !memberId) {
      setError("Selecciona al hermano al que corresponde el cargo o pago.");
      return;
    }
    try {
      addMovement({
        date: selectedDate,
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
          <h1 className="mt-2 font-display text-3xl">{sectionTitle}</h1>
          <p className="mt-2 text-sm text-muted">
            {onlyDebts
              ? "Padrón asociado a los cargos y pagos de los hermanos."
              : section === "overview"
                ? "Resumen de caja y accesos a la gestión económica."
                : section === "movements"
                  ? "Consulta y registra los movimientos económicos."
                  : section === "fees"
                    ? "Administra las cuotas y revisa cobranzas pendientes."
                    : "Consulta y descarga el cierre mensual de caja."}
          </p>
        </div>
        {canManage && !onlyDebts ? (
          <Button
            type="button"
            onClick={() => {
              setShowForm(true);
              setError("");
              setSuccess("");
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Registrar movimiento
          </Button>
        ) : (
          <span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
            Solo consulta
          </span>
        )}
      </div>
      {!onlyDebts && (
        <nav
          aria-label="Secciones de Tesorería"
          className="flex flex-wrap gap-2 border-b border-line pb-4"
        >
          {treasurySections.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard?view=treasury&section=${item.id}`}
              aria-current={section === item.id ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-sm border px-4 py-2 text-sm font-medium transition-colors ${
                section === item.id
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-white-warm text-muted hover:bg-mist hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      {success && (
        <p
          role="status"
          className="rounded-sm border border-line bg-mist p-3 text-sm"
        >
          {success}
        </p>
      )}
      {!onlyDebts && section === "overview" && (
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
      {!onlyDebts && section === "overview" && (
        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Accesos rápidos de Tesorería"
        >
          {treasurySections.slice(1).map((item) => (
            <Link
              key={item.id}
              href={`/dashboard?view=treasury&section=${item.id}`}
              className="rounded-sm border border-line bg-white-warm p-5 transition-colors hover:bg-mist"
            >
              <span className="font-display text-lg">{item.label}</span>
              <span className="mt-2 block text-sm text-muted">
                {item.id === "movements"
                  ? `${cashMovements.length} movimientos registrados`
                  : item.id === "fees"
                    ? `${debts.filter((item) => item.balance > 0).length} hermanos con saldo pendiente`
                    : "Consultar y descargar el cierre mensual"}
              </span>
            </Link>
          ))}
        </section>
      )}
      {canManage && !onlyDebts && section === "fees" && (
        <section
          className="rounded-sm border border-line bg-white-warm p-5 sm:p-6"
          aria-labelledby="fees-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <h2 className="font-display text-xl" id="fees-heading">
                Cuotas institucionales
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Ordinaria actual: {money(currentOrdinaryFee)} al mes. Los
                Postulantes pagan la mitad; los Reingresantes pagan como
                Activos. Vitalicios están exonerados. Las extraordinarias son
                fijas: S/ 10 el 6 de mayo y S/ 20 el 3 de noviembre, sin
                descuento. El reingreso genera S/ 200.
              </p>
              <p className="mt-2 text-xs text-muted">
                La cuota ordinaria vence el día 1 del mes siguiente. Los cambios
                de importe rigen desde el próximo mes y no modifican cargos ya
                generados. El periodo de cuotas comienza en {billingStartMonth}.
              </p>
            </div>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={saveOrdinaryFee}
            >
              <label className="grid gap-2 text-sm">
                Nuevo importe mensual (S/)
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={feeAmount}
                  onChange={(event) => setFeeAmount(event.target.value)}
                  placeholder={currentOrdinaryFee.toFixed(2)}
                />
              </label>
              <Button type="submit" variant="outline">
                Aplicar desde próximo mes
              </Button>
            </form>
          </div>
          {feeError && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {feeError}
            </p>
          )}
          {feeSuccess && (
            <p className="mt-3 text-sm text-clay-text" role="status">
              {feeSuccess}
            </p>
          )}
        </section>
      )}
      {!onlyDebts && section === "reports" && (
        <section
          className="rounded-sm border border-line bg-white-warm p-5 sm:p-6"
          aria-labelledby="cash-report-heading"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl" id="cash-report-heading">
                Resumen mensual de caja
              </h2>
              <p className="mt-2 text-sm text-muted">
                Incluye ingresos y pagos como ingresos de caja; los cargos no
                son ingresos. El total de caja es ingresos menos egresos.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-sm">
                Mes del reporte
                <Input
                  type="month"
                  value={selectedReportMonth}
                  max={currentDate.slice(0, 7)}
                  onChange={(event) => setReportMonth(event.target.value)}
                />
              </label>
              <Button type="button" onClick={() => void downloadCashReport()}>
                Descargar reporte PDF
              </Button>
            </div>
          </div>
          {reportError && (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {reportError}
            </p>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-live="polite">
            {[
              ["Subtotal de ingresos", monthlyIncome],
              ["Subtotal de egresos", monthlyExpenses],
              ["Total de caja", monthlyIncome - monthlyExpenses],
            ].map(([label, amount]) => (
              <div className="rounded-sm border border-line bg-paper p-4" key={String(label)}>
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-2 font-display text-xl">{money(Number(amount))}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {canManage && !onlyDebts && section === "movements" && (
        <dialog
          ref={movementDialogRef}
          aria-labelledby="movement-dialog-title"
          aria-describedby="movement-dialog-description"
          onCancel={(event) => {
            event.preventDefault();
            setShowForm(false);
          }}
          className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-paper p-0 text-ink backdrop:bg-ink/50"
        >
          <form
            onSubmit={handleSubmit}
            className="flex h-full min-h-0 flex-col"
            noValidate
          >
            <header className="shrink-0 border-b border-line bg-white-warm px-4 py-4 sm:px-8">
              <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Tesorería · Movimientos de caja</p>
                  <h2
                    className="mt-2 font-display text-2xl sm:text-3xl"
                    id="movement-dialog-title"
                  >
                    Nuevo movimiento
                  </h2>
                  <p
                    id="movement-dialog-description"
                    className="mt-2 text-sm text-muted"
                  >
                    Registra un ingreso, egreso, cargo o pago.
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Cerrar registro de movimiento"
                  onClick={() => setShowForm(false)}
                >
                  <X className="size-5" aria-hidden="true" />
                </Button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-9">
              <div className="mx-auto max-w-4xl rounded-sm border border-line bg-white-warm p-5 sm:p-7">
                <div className="grid gap-4 sm:grid-cols-2">
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
                      max={currentDate}
                      value={selectedDate}
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
                            {member.fullName} · DNI {member.dni} ·{" "}
                            {statusLabels[member.status]}
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
              </div>
            </div>
            <footer className="shrink-0 border-t border-line bg-white-warm px-4 py-4 sm:px-8">
              <div className="mx-auto flex max-w-5xl flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Guardar movimiento</Button>
              </div>
            </footer>
          </form>
        </dialog>
      )}
      {(onlyDebts || section === "fees") && (
        <section
          className="rounded-sm border border-line bg-white-warm"
          aria-labelledby="debts-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
            <div>
              <h2 className="font-display text-xl" id="debts-heading">
                {onlyDebts ? "Deudas de los hermanos" : "Cobranzas y saldos"}
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
                        DNI {member.dni} · {statusLabels[member.status]}
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
      )}
      {!onlyDebts && section === "movements" && (
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
