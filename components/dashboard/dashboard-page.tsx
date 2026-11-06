import {
  Archive,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  HandCoins,
  UsersRound,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ModuleCard } from "@/components/dashboard/module-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";

const statistics = [
  {
    label: "Miembros activos",
    value: "128",
    note: "En el padrón de la Hermandad",
    icon: UsersRound,
  },
  {
    label: "Próxima actividad",
    value: "08 nov.",
    note: "Jornada de preparación",
    icon: CalendarDays,
  },
  {
    label: "Solicitudes pendientes",
    value: "06",
    note: "Requieren revisión",
    icon: FileText,
  },
  {
    label: "Cuotas al día",
    value: "92%",
    note: "Resumen referencial",
    icon: HandCoins,
  },
];

const modules = [
  {
    id: "modulo-miembros",
    title: "Miembros",
    description: "Consulta el padrón y organiza la información de los hermanos.",
    href: "#modulo-miembros",
    icon: UsersRound,
  },
  {
    id: "actividades",
    title: "Actividades",
    description: "Revisa las próximas fechas y coordina las actividades.",
    href: "#actividades",
    icon: CalendarDays,
  },
  {
    id: "modulo-tesoreria",
    title: "Tesorería",
    description: "Visualiza un resumen de cuotas y movimientos internos.",
    href: "#modulo-tesoreria",
    icon: HandCoins,
  },
  {
    id: "modulo-archivo",
    title: "Archivo",
    description: "Encuentra actas, documentos y materiales de referencia.",
    href: "#modulo-archivo",
    icon: Archive,
  },
];

const activities = [
  {
    title: "Padrón de miembros actualizado",
    detail: "Se registró una actualización de datos de contacto.",
    time: "Hoy · 10:24 a. m.",
    icon: UsersRound,
    variant: "accent" as const,
  },
  {
    title: "Actividad programada",
    detail: "Jornada de preparación · 8 de noviembre",
    time: "Ayer · 4:10 p. m.",
    icon: CalendarDays,
    variant: "default" as const,
  },
  {
    title: "Documento añadido al archivo",
    detail: "Acta de reunión de coordinación",
    time: "4 nov. · 6:32 p. m.",
    icon: FileText,
    variant: "muted" as const,
  },
];

function DashboardPage() {
  return (
    <DashboardShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Portal interno · Vista de ejemplo</p>
          <h1
            className="mt-3 font-display text-3xl leading-tight tracking-[-0.04em] sm:text-4xl"
            id="resumen"
          >
            Resumen general
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Una mirada al trabajo y las actividades de la Hermandad.
          </p>
        </div>
        <Badge className="w-fit" variant="accent">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-clay" />
          Datos de demostración
        </Badge>
      </div>

      <section
        aria-label="Indicadores de ejemplo"
        className="grid gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4"
      >
        {statistics.map((statistic) => (
          <StatCard key={statistic.label} {...statistic} />
        ))}
      </section>

      <section className="mt-9" aria-labelledby="modules-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Áreas de gestión</p>
            <h2
              className="mt-2 font-display text-2xl leading-tight"
              id="modules-heading"
            >
              Módulos del portal
            </h2>
          </div>
          <p className="hidden max-w-xs text-right text-xs leading-5 text-muted sm:block">
            La disponibilidad de cada módulo podrá adaptarse al perfil de cada
            usuario.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <ModuleCard key={module.title} {...module} />
          ))}
        </div>
      </section>

      <section
        aria-label="Información de módulos de ejemplo"
        className="mt-9 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"
      >
        <div className="rounded-sm border border-line bg-white-warm p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Lo que ocurre</p>
              <h2 className="mt-2 font-display text-xl" id="actividades">
                Actividad reciente
              </h2>
            </div>
            <Badge variant="muted">Información de muestra</Badge>
          </div>
          <ul className="mt-5 divide-y divide-line">
            {activities.map(({ detail, icon: Icon, time, title, variant }) => (
              <li
                className="flex gap-3 py-4 first:pt-0 last:pb-0"
                key={title}
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-mist text-forest">
                  <Icon aria-hidden="true" className="size-4" strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    {detail}
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 text-[0.6875rem] text-muted">
                    <Clock3 aria-hidden="true" className="size-3" />
                    {time}
                  </span>
                </span>
                <Badge className="hidden self-start sm:inline-flex" variant={variant}>
                  <Check aria-hidden="true" className="size-3" />
                  Registrado
                </Badge>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-sm border border-line bg-[#eee8dc] p-5 sm:p-6">
          <p className="eyebrow">Próxima fecha</p>
          <h2 className="mt-2 font-display text-xl">
            Jornada de preparación
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Un espacio para coordinar los próximos compromisos de la Hermandad.
          </p>
          <div className="mt-6 flex items-center gap-3 border-t border-line/80 pt-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-white-warm text-center">
              <span>
                <span className="block text-[0.625rem] font-semibold uppercase tracking-wider text-clay-text">
                  Nov
                </span>
                <span className="mt-0.5 block font-display text-lg leading-none text-ink">
                  08
                </span>
              </span>
            </span>
            <span>
              <span className="block text-sm font-medium text-ink">
                Domingo · 9:00 a. m.
              </span>
              <span className="mt-1 block text-xs text-muted">
                Encuentro de coordinación
              </span>
            </span>
          </div>
          <p className="mt-5 rounded-sm border border-line/80 bg-white/50 px-3 py-2.5 text-xs leading-5 text-muted">
            Agenda y ubicación son datos ilustrativos para esta maqueta.
          </p>
        </div>
      </section>

    </DashboardShell>
  );
}

export { DashboardPage };
