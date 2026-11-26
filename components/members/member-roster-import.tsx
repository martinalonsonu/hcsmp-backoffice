"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { FileSpreadsheet, LoaderCircle, RotateCcw, Upload } from "lucide-react";
import { useLoadedPortal } from "@/components/dashboard/portal-session";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { categoryLabels } from "@/lib/portal";
import {
  markRosterImportDuplicates, parseRosterImportRows, type RosterImportCell,
  type RosterImportRow, type RosterImportSourceRow,
} from "@/lib/member-import";
import {
  findExistingRosterMatches, importRosterMembers, type ExistingRosterMatch, type RosterImportResult,
} from "@/lib/firebase/member-import";

const maxFileSize = 15 * 1024 * 1024;
const maxRowsPerSheet = 5000;

function rowKey(row: RosterImportRow): string {
  return `${row.sourceSheet}:${row.rowNumber}`;
}

function formattedCellValue(cell: { value: unknown; text: string }): unknown {
  if (cell.value instanceof Date) return cell.value;
  return { raw: cell.value, display: cell.text } satisfies RosterImportCell;
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

type Props = {
  open: boolean;
  coverageReady: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function MemberRosterImport({ open, coverageReady, onClose, onImported }: Props) {
  const { identity } = useLoadedPortal();
  const [rows, setRows] = useState<RosterImportRow[]>([]);
  const [matches, setMatches] = useState<Map<string, ExistingRosterMatch[]>>(new Map());
  const [excludedRows, setExcludedRows] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [matchError, setMatchError] = useState("");
  const [importError, setImportError] = useState("");
  const [reading, setReading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchingComplete, setMatchingComplete] = useState(false);
  const [importing, setImporting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const [result, setResult] = useState<RosterImportResult | null>(null);

  const hasMissingMemberDni = rows.some((row) => !row.member.dni);
  const importableRows = rows.filter((row) => !row.errors.length && !excludedRows.has(rowKey(row)));
  const errorRows = rows.filter((row) => row.errors.length);
  const matchingRows = rows.filter((row) => matches.has(row.identityKey));
  const reviewAccepted = !hasMissingMemberDni || acknowledged;
  const busy = reading || matching || importing;

  function reset() {
    setRows([]);
    setMatches(new Map());
    setExcludedRows(new Set());
    setFileName("");
    setFileError("");
    setMatchError("");
    setImportError("");
    setMatchingComplete(false);
    setAcknowledged(false);
    setProgress(null);
    setResult(null);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function checkExistingMatches(nextRows: RosterImportRow[]) {
    setMatching(true);
    setMatchError("");
    setMatchingComplete(false);
    try {
      const found = await findExistingRosterMatches(identity, nextRows);
      setMatches(found);
      setExcludedRows(new Set(nextRows
        .filter((row) => row.errors.length || found.has(row.identityKey))
        .map(rowKey)));
      setMatchingComplete(true);
    } catch (cause) {
      setMatchError(messageOf(cause, "No se pudieron comprobar las fichas existentes."));
    } finally {
      setMatching(false);
    }
  }

  async function readWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    reset();
    setFileName(file.name);
    if (!file.name.toLocaleLowerCase("es").endsWith(".xlsx")) {
      setFileError("Selecciona un archivo .xlsx. Guarda el libro de Excel en ese formato antes de cargarlo.");
      return;
    }
    if (file.size > maxFileSize) {
      setFileError("El archivo supera el límite de 15 MB.");
      return;
    }
    if (!coverageReady) {
      setFileError("Espera a que termine la preparación del índice del padrón antes de importar.");
      return;
    }

    setReading(true);
    try {
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const parsedRows: RosterImportRow[] = [];
      const nonEmptySheets = workbook.worksheets.filter((sheet) => sheet.actualRowCount > 0);
      if (!nonEmptySheets.length) throw new Error("El libro no contiene hojas con datos.");

      for (const sheet of nonEmptySheets) {
        if (sheet.actualRowCount > maxRowsPerSheet)
          throw new Error(`La hoja «${sheet.name}» supera el límite de ${maxRowsPerSheet} filas.`);
        const sourceRows: RosterImportSourceRow[] = [];
        sheet.eachRow({ includeEmpty: false }, (row) => {
          const values = Array.from({ length: row.cellCount }, (_, index) => {
            const cell = row.getCell(index + 1);
            return formattedCellValue({ value: cell.value, text: cell.text });
          });
          sourceRows.push({ rowNumber: row.number, values });
        });
        try {
          parsedRows.push(...parseRosterImportRows(sourceRows, undefined, sheet.name, false));
        } catch (cause) {
          throw new Error(`No se importó ninguna hoja: «${sheet.name}» no tiene los encabezados requeridos. ${messageOf(cause, "Revisa esa hoja.")}`);
        }
      }

      if (!parsedRows.length) throw new Error("No se encontraron filas de hermanos debajo de los encabezados.");
      markRosterImportDuplicates(parsedRows);
      setRows(parsedRows);
      await checkExistingMatches(parsedRows);
    } catch (cause) {
      setFileError(messageOf(cause, "No se pudo leer el libro de Excel."));
    } finally {
      setReading(false);
    }
  }

  function toggleRow(row: RosterImportRow, include: boolean) {
    const key = rowKey(row);
    setExcludedRows((current) => {
      const next = new Set(current);
      if (include) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !matchingComplete || !reviewAccepted || !importableRows.length || result) return;
    setImporting(true);
    setImportError("");
    setProgress({ processed: 0, total: importableRows.length });
    try {
      const report = await importRosterMembers(identity, importableRows, (processed, total) => {
        setProgress({ processed, total });
      });
      setResult(report);
      if (report.created) onImported();
    } catch (cause) {
      setImportError(messageOf(cause, "No se pudo completar la importación."));
    } finally {
      setImporting(false);
    }
  }

  const footer = result
    ? <Button type="button" onClick={close}>Cerrar</Button>
    : <>
        <Button type="button" variant="outline" disabled={busy} onClick={close}>Cancelar</Button>
        <Button type="submit" disabled={
          busy || !matchingComplete || !reviewAccepted || !importableRows.length || Boolean(fileError) || !coverageReady
        }>
          {importing ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin"/> : <Upload aria-hidden="true" className="size-4"/>}
          {importing ? "Importando…" : `Importar ${importableRows.length} fichas`}
        </Button>
      </>;

  return (
    <Modal open={open} size="full" eyebrow="Secretaría · Importación controlada"
      title="Importar padrón desde Excel"
      description="El libro se procesa en este navegador. Solo se crearán fichas institucionales; no se crearán cuentas de acceso."
      busy={busy} onClose={close} onSubmit={submitImport} footer={footer}>
      <Alert variant="info">
        El Excel no trae DNI del hermano. Se buscarán posibles coincidencias por nombre y fecha de nacimiento.
        Las fichas sin DNI recibirán un identificador estable para evitar repetir la misma importación; aun así,
        revisa manualmente las coincidencias antes de continuar. «Tiempo en la hermandad» se calcula desde la
        juramentación y no se guarda como dato independiente; los postulantes/aspirantes sin juramentación se muestran como «Aún no juramentó».
        Si falta la juramentación o aparece «-» en otra categoría, se señala como posible postulante para revisión, sin cambiar el estatus.
        En MADRE, «MADRE» o «PADRE» indica hijos y permite inferir el género solo si está vacío; «NO», vacío o «-» significa que no tiene hijos.
        «Tiene ficha» y «Tiene foto» no se importan.
        Acepta fechas como 28-3-2025 o 31/01/1960. Las fechas ambiguas se interpretan día/mes/año; si una parte supera 12, se infiere el orden, como en 11/30/2025.
      </Alert>
      <Field label="Libro de Excel (.xlsx)">
        <Input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy || Boolean(result)} onChange={(event) => void readWorkbook(event)}/>
      </Field>
      {fileName && <p className="text-sm text-muted">Archivo: {fileName}</p>}
      {!coverageReady && <Alert variant="error">El índice del padrón no está listo. La importación se mantiene bloqueada para poder revisar duplicados.</Alert>}
      {fileError && <Alert variant="error">{fileError}</Alert>}
      {matchError && <Alert variant="error">
        {matchError}
        <Button type="button" size="sm" variant="outline" className="mt-2"
          disabled={matching || !coverageReady} onClick={() => void checkExistingMatches(rows)}>
          <RotateCcw aria-hidden="true" className="size-4"/> Reintentar revisión de coincidencias
        </Button>
      </Alert>}
      {matching && <Alert variant="loading">Comparando nombres y fechas con las fichas actuales…</Alert>}
      {rows.length > 0 && !matching && !matchError && <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-sm border border-line p-3"><strong>{rows.length}</strong><p className="text-sm text-muted">Filas detectadas</p></div>
          <div className="rounded-sm border border-line p-3"><strong>{importableRows.length}</strong><p className="text-sm text-muted">Seleccionadas para importar</p></div>
          <div className="rounded-sm border border-line p-3"><strong>{errorRows.length}</strong><p className="text-sm text-muted">Con errores que se excluirán</p></div>
        </div>
        {matchingRows.length > 0 && <Alert variant="info">
          {matchingRows.length} fila(s) coinciden con fichas ya existentes por nombre y fecha. Quedan excluidas inicialmente; revísalas en la tabla y marca solo las que sean personas distintas.
        </Alert>}
        {hasMissingMemberDni && <label className="flex items-start gap-3 rounded-sm border border-line bg-white-warm p-4 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-clay" checked={acknowledged}
            disabled={busy || Boolean(result)} onChange={(event) => setAcknowledged(event.target.checked)}/>
          <span>Confirmo que el archivo no incluye DNI de los hermanos, revisé las coincidencias detectadas y acepto importar las fichas seleccionadas sin ese dato.</span>
        </label>}
        <div className="max-h-[28rem] overflow-auto rounded-sm border border-line">
          <table className="w-full min-w-[980px] text-left text-sm">
            <caption className="sr-only">Revisión de filas del Excel antes de importarlas</caption>
            <thead className="sticky top-0 bg-mist text-xs uppercase text-muted">
              <tr><th className="p-3">Importar</th><th className="p-3">Hermano/a</th><th className="p-3">Hoja y fila</th>
                <th className="p-3">Categoría</th><th className="p-3">Nacimiento</th><th className="p-3">Tiempo</th>
                <th className="p-3">Apoderado</th><th className="p-3">Revisión</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row);
                const rowMatches = matches.get(row.identityKey) ?? [];
                const included = !excludedRows.has(key);
                return <tr key={key} className="border-t border-line align-top">
                  <td className="p-3"><input type="checkbox" aria-label={`Importar ${row.member.fullName}, fila ${row.rowNumber}`}
                    className="size-4 accent-clay" checked={included} disabled={Boolean(row.errors.length) || Boolean(result)}
                    onChange={(event) => toggleRow(row, event.target.checked)}/></td>
                  <td className="p-3">
                    <span className="font-medium">{row.member.fullName || "Sin nombre"}</span>
                    <span className="block text-xs text-muted">DNI {row.member.dni || "Sin registrar"}</span>
                  </td>
                  <td className="p-3">{row.sourceSheet}, {row.rowNumber}</td>
                  <td className="p-3">
                    {categoryLabels[row.member.category]}
                    {row.member.nonResidentHuacho && <span className="mt-1 block text-xs text-muted">No residente en Huacho</span>}
                  </td>
                  <td className="p-3">{row.member.birthDate || "Sin fecha"}</td>
                  <td className="p-3">{row.tenure}</td>
                  <td className="p-3">{row.member.guardian?.fullName || "—"}</td>
                  <td className="max-w-sm p-3">
                    {rowMatches.map((match) => <p key={match.id} className="mb-1 text-amber-800">
                      Coincide con {match.fullName} · {match.birthDate || "sin fecha"}.
                    </p>)}
                    {row.errors.map((error) => <p key={error} className="mb-1 text-red-700">{error}</p>)}
                    {row.warnings.map((warning) => <p key={warning} className="mb-1 text-muted">{warning}</p>)}
                    {!row.errors.length && !rowMatches.length && !row.warnings.length && "Sin observaciones"}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>}
      {importError && <Alert variant="error">{importError}</Alert>}
      {progress && importing && <Alert variant="loading">
        Procesadas {progress.processed} de {progress.total} filas seleccionadas…
      </Alert>}
      {result && <div className="space-y-3">
        <Alert variant={result.failures.length ? "error" : "success"}>
          Importación finalizada: {result.created} creadas, {result.alreadyExists} ya existentes,
          {result.failures.length} con error. Las filas excluidas o inválidas no se modificaron.
        </Alert>
        {result.failures.map((failure) => <p key={`${failure.sourceSheet}:${failure.rowNumber}:${failure.message}`} className="text-sm text-red-700">
          {failure.sourceSheet}, fila {failure.rowNumber}: {failure.message}
        </p>)}
      </div>}
      {rows.length === 0 && !fileError && !reading && <div className="rounded-sm border border-dashed border-line p-8 text-center text-sm text-muted">
        <FileSpreadsheet aria-hidden="true" className="mx-auto mb-2 size-8"/>
        Selecciona el padrón en formato .xlsx. Se analizarán todas las hojas no vacías; si una hoja no tiene los encabezados del padrón, se detendrá la lectura para no omitir registros.
      </div>}
      {reading && <Alert variant="loading">Leyendo las hojas del libro…</Alert>}
    </Modal>
  );
}
