import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** `primary` is the card title on small screens; `actions` is rendered as a footer. */
  kind?: "primary" | "actions";
  className?: string;
};

type DataTableProps<T> = {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
};

function DataTable<T>({ caption, columns, rows, rowKey }: DataTableProps<T>) {
  const primary = columns.find((column) => column.kind === "primary") ?? columns[0];
  const actions = columns.find((column) => column.kind === "actions");
  const details = columns.filter((column) => column !== primary && column !== actions);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-sm border border-line md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-paper/70 text-xs uppercase tracking-wide text-muted">
              {columns.map((column) => (
                <th
                  key={column.header}
                  scope="col"
                  className={cn("px-5 py-3.5 font-semibold", column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-paper/40">
                {columns.map((column) => (
                  <td
                    key={column.header}
                    className={cn("px-5 py-4 align-middle", column.className)}
                  >
                    {column.kind === "actions" ? (
                      <div className="flex items-center gap-2">{column.cell(row)}</div>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul
        aria-label={caption}
        className="divide-y divide-line rounded-sm border border-line md:hidden"
      >
        {rows.map((row) => (
          <li key={rowKey(row)} className="space-y-3 p-4">
            <div className="min-w-0">{primary.cell(row)}</div>
            {details.length > 0 && (
              <dl className="space-y-2">
                {details.map((column) => (
                  <div
                    key={column.header}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <dt className="shrink-0 text-xs font-semibold text-muted">
                      {column.header}
                    </dt>
                    <dd className="min-w-0 text-right">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && (
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {actions.cell(row)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export { DataTable };
export type { Column };
