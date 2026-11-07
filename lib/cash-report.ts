import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Member, Movement } from "./portal.ts";

const pageSize: [number, number] = [792, 612];
const margin = 36;
const money = (amount: number) =>
  `S/ ${amount.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const monthLabel = (month: string) => {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, value - 1, 1)));
};
const dateLabel = (date: string) => {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
};

function wrappedLines(
  value: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const character of word) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Generates a complete, paginated monthly cash summary PDF. */
export async function generateMonthlyCashReport(
  movements: Movement[],
  members: Member[],
  month: string,
  fontBytes: Uint8Array,
): Promise<Uint8Array> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("Selecciona un mes válido para el reporte.");

  const memberNames = new Map(
    members.map((member) => [member.id, member.fullName]),
  );
  const monthMovements = movements.filter(
    (movement) =>
      movement.date.startsWith(`${month}-`) &&
      movement.type !== "cargo",
  );
  const incomes = monthMovements
    .filter((movement) => movement.type === "ingreso" || movement.type === "pago")
    .toSorted((a, b) => a.date.localeCompare(b.date));
  const expenses = monthMovements
    .filter((movement) => movement.type === "egreso")
    .toSorted((a, b) => a.date.localeCompare(b.date));
  const incomeTotal = incomes.reduce((sum, movement) => sum + movement.amount, 0);
  const expenseTotal = expenses.reduce(
    (sum, movement) => sum + movement.amount,
    0,
  );

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  let page: PDFPage;
  let pageNumber = 0;
  let y = 0;

  function addPage(): PDFPage {
    const next = pdf.addPage(pageSize);
    pageNumber += 1;
    next.drawText("Resumen mensual de caja", {
      x: margin,
      y: pageSize[1] - margin,
      size: 18,
      font,
      color: rgb(0.12, 0.18, 0.17),
    });
    next.drawText(
      `${monthLabel(month)} · Hermandad de Cargadores de San Martín de Porres`,
      {
        x: margin,
        y: pageSize[1] - margin - 18,
        size: 9,
        font,
        color: rgb(0.32, 0.35, 0.34),
      },
    );
    y = pageSize[1] - margin - 48;
    return next;
  }

  function ensureSpace(height: number) {
    if (y - height < 55) {
      page = addPage();
      y = pageSize[1] - margin - 60;
    }
  }

  function section(title: string, rows: Movement[], total: number) {
    ensureSpace(45);
    page.drawText(title, {
      x: margin,
      y,
      size: 12,
      font,
      color: rgb(0.12, 0.18, 0.17),
    });
    y -= 18;
    page.drawRectangle({
      x: margin,
      y: y - 5,
      width: pageSize[0] - margin * 2,
      height: 18,
      color: rgb(0.13, 0.2, 0.19),
    });
    const columns = [
      { title: "Fecha", x: margin + 6, width: 60 },
      { title: "Concepto", x: margin + 72, width: 285 },
      { title: "Tipo", x: margin + 365, width: 112 },
      { title: "Hermano", x: margin + 485, width: 158 },
      { title: "Importe", x: margin + 650, width: 70 },
    ];
    for (const column of columns)
      page.drawText(column.title, {
        x: column.x,
        y: y + 1,
        size: 7.5,
        font,
        color: rgb(1, 1, 1),
      });
    y -= 21;

    for (const [index, movement] of rows.entries()) {
      const values = [
        { text: dateLabel(movement.date), x: columns[0].x, width: columns[0].width },
        { text: movement.description, x: columns[1].x, width: columns[1].width },
        {
          text: movement.type === "pago" ? "Pago de hermano" : "Ingreso",
          x: columns[2].x,
          width: columns[2].width,
        },
        {
          text: memberNames.get(movement.memberId) ?? "—",
          x: columns[3].x,
          width: columns[3].width,
        },
        { text: money(movement.amount), x: columns[4].x, width: columns[4].width },
      ];
      const lines = values.map((value) =>
        wrappedLines(value.text, font, 7.5, value.width - 6),
      );
      const rowHeight = Math.max(18, Math.max(...lines.map((value) => value.length)) * 9 + 6);
      if (y - rowHeight < 55) {
        page = addPage();
        y = pageSize[1] - margin - 48;
        page.drawText(`${title} (continuación)`, {
          x: margin,
          y,
          size: 12,
          font,
          color: rgb(0.12, 0.18, 0.17),
        });
        y -= 18;
        page.drawRectangle({
          x: margin,
          y: y - 5,
          width: pageSize[0] - margin * 2,
          height: 18,
          color: rgb(0.13, 0.2, 0.19),
        });
        for (const column of columns)
          page.drawText(column.title, {
            x: column.x,
            y: y + 1,
            size: 7.5,
            font,
            color: rgb(1, 1, 1),
          });
        y -= 21;
      }
      if (index % 2 === 1)
        page.drawRectangle({
          x: margin,
          y: y - rowHeight + 4,
          width: pageSize[0] - margin * 2,
          height: rowHeight,
          color: rgb(0.96, 0.96, 0.94),
        });
      for (const [columnIndex, value] of values.entries())
        lines[columnIndex].forEach((line, lineIndex) =>
          page.drawText(line, {
            x: value.x,
            y: y - 9 * lineIndex,
            size: 7.5,
            font,
            color: rgb(0.13, 0.15, 0.14),
          }),
        );
      y -= rowHeight;
    }
    ensureSpace(26);
    page.drawText(`Subtotal ${title.toLocaleLowerCase("es")}: ${money(total)}`, {
      x: pageSize[0] - margin - 190,
      y: y - 1,
      size: 9,
      font,
      color: rgb(0.12, 0.18, 0.17),
    });
    y -= 30;
  }

  page = addPage();
  section("Ingresos", incomes, incomeTotal);
  section("Egresos", expenses, expenseTotal);
  ensureSpace(72);
  page.drawRectangle({
    x: margin,
    y: y - 40,
    width: pageSize[0] - margin * 2,
    height: 58,
    color: rgb(0.93, 0.94, 0.91),
  });
  page.drawText(`Total de ingresos: ${money(incomeTotal)}`, {
    x: margin + 12,
    y: y,
    size: 10,
    font,
  });
  page.drawText(`Total de egresos: ${money(expenseTotal)}`, {
    x: margin + 270,
    y: y,
    size: 10,
    font,
  });
  page.drawText(`Total de caja: ${money(incomeTotal - expenseTotal)}`, {
    x: margin + 530,
    y: y,
    size: 10,
    font,
  });
  for (const [index, reportPage] of pdf.getPages().entries())
    reportPage.drawText(`Página ${index + 1} de ${pageNumber}`, {
      x: pageSize[0] - margin - 72,
      y: 20,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  pdf.setTitle(`Resumen mensual de caja · ${monthLabel(month)}`);
  pdf.setSubject(
    `${incomes.length} ingresos · ${expenses.length} egresos · Caja neta ${money(incomeTotal - expenseTotal)}`,
  );
  pdf.setCreator("Portal HCSMP");
  return pdf.save({ useObjectStreams: false });
}

export async function downloadMonthlyCashReport(
  movements: Movement[],
  members: Member[],
  month: string,
): Promise<void> {
  const fontResponse = await fetch("/fonts/LiberationSans-Regular.ttf");
  if (!fontResponse.ok)
    throw new Error(
      "No se pudo cargar la fuente para generar el reporte PDF. Inténtalo nuevamente.",
    );
  const bytes = await generateMonthlyCashReport(
    movements,
    members,
    month,
    new Uint8Array(await fontResponse.arrayBuffer()),
  );
  const blob = new Blob([new Uint8Array(bytes).buffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `resumen-caja-${month}.pdf`;
  link.hidden = true;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
