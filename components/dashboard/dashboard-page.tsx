"use client";

import { useSearchParams } from "next/navigation";
import {
  HandCoins,
  ClipboardList,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ModuleCard } from "@/components/dashboard/module-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { AccountPanel } from "@/components/portal/account-panel";
import { MembersPanel } from "@/components/portal/members-panel";
import { ProfilePanel } from "@/components/portal/profile-panel";
import { RequestsPanel } from "@/components/portal/requests-panel";
import { TreasuryPanel } from "@/components/portal/treasury-panel";
import { usePortal } from "@/components/portal/portal-provider";
import { Badge } from "@/components/ui/badge";
import { categoryLabels, roleLabels, isTrialCategory } from "@/lib/portal";

function DashboardPage() {
  const searchParams = useSearchParams();
  const { currentMember, members, movements } = usePortal();
  const view = searchParams.get("view") ?? "summary";
  const role = currentMember?.role;
  const rosterMembers = members.filter((member) => member.status === "vigente");
  const canSeeMembers = role === "secretaria" || role === "presidencia";
  const canSeeTreasury = role === "tesoreria" || role === "presidencia";
  const canSeeDebts = role === "secretaria";
  const allowed =
    ["summary", "account", "profile"].includes(view) ||
    (view === "members" && canSeeMembers) ||
    (view === "treasury" && canSeeTreasury) ||
    (view === "debts" && canSeeDebts) ||
    (view === "requests" && currentMember !== null);
  const personalBalance = movements
    .filter((item) => item.memberId === currentMember?.id)
    .reduce(
      (sum, item) =>
        sum +
        (item.type === "cargo"
          ? item.amount
          : item.type === "pago"
            ? -item.amount
            : 0),
      0,
    );
  const modules = [
    {
      id: "solicitudes",
      title: "Solicitudes",
      description:
        role === "secretaria"
          ? "Revisa las solicitudes recibidas y actualiza su seguimiento."
          : "Envía solicitudes a Secretaría y consulta su estado.",
      href: "/dashboard?view=requests",
      icon: ClipboardList,
    },
    {
      id: "mi-cuenta",
      title: "Mi estado de cuenta",
      description: "Consulta tus cuotas, pagos y saldo personal.",
      href: "/dashboard?view=account",
      icon: WalletCards,
    },
    {
      id: "mi-perfil",
      title: "Mi perfil",
      description: "Actualiza tus datos y cambia tu contraseña.",
      href: "/dashboard?view=profile",
      icon: UserRound,
    },
    ...(canSeeMembers
      ? [
          {
            id: "padron",
            title: "Padrón de hermanos",
            description:
              role === "secretaria"
                ? "Registra hermanos y administra sus fichas y accesos."
                : "Consulta las fichas de los hermanos de la institución.",
            href: "/dashboard?view=members",
            icon: UsersRound,
          },
        ]
      : []),
    ...(canSeeTreasury
      ? [
          {
            id: "tesoreria",
            title: "Tesorería",
            description:
              role === "tesoreria"
                ? "Resumen, movimientos, cuotas, cobranzas y reportes mensuales."
                : "Consulta los movimientos y reportes de la institución.",
            href: "/dashboard?view=treasury",
            icon: HandCoins,
          },
        ]
      : []),
    ...(canSeeDebts
      ? [
          {
            id: "deudas",
            title: "Deudas generales",
            description: "Revisa los saldos y las cuotas del padrón.",
            href: "/dashboard?view=debts",
            icon: WalletCards,
          },
        ]
      : []),
  ];

  return (
    <DashboardShell>
      {!allowed ? (
        <div
          className="rounded-sm border border-line bg-white-warm p-8"
          role="status"
        >
          <ShieldCheck className="size-7 text-clay-text" aria-hidden="true" />
          <h1 className="mt-4 font-display text-2xl">Acceso restringido</h1>
          <p className="mt-3 text-sm text-muted">
            Tu perfil no tiene acceso a este módulo. Utiliza el menú para
            continuar.
          </p>
        </div>
      ) : view === "members" ? (
        <MembersPanel />
      ) : view === "treasury" ? (
        <TreasuryPanel />
      ) : view === "debts" ? (
        <TreasuryPanel debtsOnly />
      ) : view === "requests" ? (
        <RequestsPanel />
      ) : view === "profile" ? (
        <ProfilePanel />
      ) : view === "account" ? (
        <AccountPanel />
      ) : currentMember ? (
        <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">
                Portal interno · {roleLabels[currentMember.role]}
              </p>
              <h1 className="mt-3 font-display text-3xl tracking-[-0.04em] sm:text-4xl">
                Bienvenido, {currentMember.fullName.split(" ")[0]}
              </h1>
              <p className="mt-3 text-sm text-muted">
                Tu información y los módulos de la Hermandad, en un solo lugar.
              </p>
            </div>
            <Badge variant="accent">
              {categoryLabels[currentMember.category]}
            </Badge>
          </div>
          <section
            aria-label="Resumen de tu información"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            <StatCard
              label="Mi saldo"
              value={new Intl.NumberFormat("es-PE", {
                style: "currency",
                currency: "PEN",
              }).format(personalBalance)}
              note="Cuotas menos pagos registrados"
              icon={WalletCards}
            />
            <StatCard
              label="Mi perfil de acceso"
              value={roleLabels[currentMember.role]}
              note="Permisos según tu función"
              icon={ShieldCheck}
            />
            {canSeeMembers ? (
              <StatCard
                label="Hermanos en el padrón"
                value={String(rosterMembers.length)}
                note={`${rosterMembers.filter((member) => isTrialCategory(member.category)).length} en periodo de prueba · ${members.length - rosterMembers.length} retirados`}
                icon={UsersRound}
              />
            ) : (
              <StatCard
                label="Mi categoría"
                value={categoryLabels[currentMember.category]}
                note="Administrada por Secretaría"
                icon={UserRound}
              />
            )}
          </section>
          <section className="mt-9" aria-labelledby="modules-heading">
            <p className="eyebrow">Tu espacio de trabajo</p>
            <h2 className="mt-2 font-display text-2xl" id="modules-heading">
              Módulos disponibles
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => (
                <ModuleCard key={module.id} {...module} />
              ))}
            </div>
          </section>
          {isTrialCategory(currentMember.category) && (
            <p className="mt-6 rounded-sm border border-line bg-white-warm p-4 text-sm leading-6 text-muted">
              {currentMember.category === "reingresante"
                ? "Tu categoría es Reingresante. Estás en periodo de prueba para recuperar la categoría Activo. Secretaría registrará el cambio cuando corresponda."
                : "Tu categoría es Postulante. Después de superar el periodo de prueba y juramentar, Secretaría podrá actualizarla. Cumplir 18 años no cambia automáticamente tu categoría."}
            </p>
          )}
        </>
      ) : null}
    </DashboardShell>
  );
}

export { DashboardPage };
