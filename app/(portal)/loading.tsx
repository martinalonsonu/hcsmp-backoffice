export default function Loading() {
  return (
    <div role="status" aria-label="Cargando módulo" className="flex min-h-64 items-center justify-center">
      <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-line border-t-clay"/>
      <span className="ml-3 text-sm text-muted">Cargando sección…</span>
    </div>
  );
}
