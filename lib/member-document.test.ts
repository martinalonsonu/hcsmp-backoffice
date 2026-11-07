import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { emptyMemberDraft, todayDate, type Member } from "./portal.ts";
import { generateMonthlyCashReport } from "./cash-report.ts";
import {
  downloadMemberDocument,
  generateMemberRosterPdf,
  generateMemberDocument,
  generateMemberPdf,
  memberDocumentFilename,
  templatePathForMember,
} from "./member-document.ts";

const adultTemplate = readFileSync(
  new URL("../public/templates/ficha-mayores.docx", import.meta.url),
);
const minorTemplate = readFileSync(
  new URL("../public/templates/ficha-menores.docx", import.meta.url),
);
function member(patch: Partial<Member> = {}): Member {
  return {
    ...emptyMemberDraft(),
    id: "document-test",
    fullName: "Ana & José <López>",
    dni: "12345678",
    birthDate: "1990-02-03",
    address: "Calle A & B <12>",
    phone: "999123456",
    email: "ana@example.com",
    occupation: "Docente",
    maritalStatus: "Casado/a",
    joinedAt: "2020-01-02",
    swornAt: "2021-11-03",
    category: "activo",
    role: "estandar",
    username: "h12345678",
    passwordHash: "NEVER_EXPORT_THIS_HASH",
    status: "vigente",
    retiredAt: "",
    rejoinedAt: "",
    membershipHistory: [],
    sacraments: ["Bautizo", "Primera comunión"],
    ...patch,
  };
}
function xmlOf(bytes: Uint8Array): string {
  return strFromU8(unzipSync(bytes)["word/document.xml"]);
}
function drawingText(xml: string, name: string): string {
  const start = xml.indexOf(`name="${name}"`);
  assert.notEqual(start, -1);
  return xml.slice(start, xml.indexOf("</wp:anchor>", start));
}

test("download chooses the supplied minor/adult form on the exact 18th birthday", () => {
  assert.equal(
    templatePathForMember({ birthDate: "2008-11-06" }, "2026-11-06"),
    "/templates/ficha-mayores.pdf",
  );
  assert.equal(
    templatePathForMember({ birthDate: "2008-11-07" }, "2026-11-06"),
    "/templates/ficha-menores.pdf",
  );
  assert.throws(
    () => templatePathForMember({ birthDate: "" }),
    /fecha de nacimiento/,
  );
});

test("adult DOCX preserves the supplied ZIP parts, fills escaped fields and leaves signatures unsigned", () => {
  const original = unzipSync(adultTemplate);
  const output = generateMemberDocument(adultTemplate, member());
  const generated = unzipSync(output);
  assert.deepEqual(Object.keys(generated), Object.keys(original));
  assert.deepEqual(generated["word/styles.xml"], original["word/styles.xml"]);
  assert.deepEqual(
    generated["word/numbering.xml"],
    original["word/numbering.xml"],
  );
  const xml = xmlOf(output);
  for (const text of [
    "Ana &amp; José &lt;López&gt;",
    "Calle A &amp; B &lt;12&gt;",
    "12345678",
    "03/02/1990",
    "ana@example.com",
    "02/01/2020",
    "03/11/2021",
    "Docente",
    "Casado/a",
    "Categoría: Activo",
    "Estado: Vigente",
  ])
    assert.ok(xml.includes(text), text);
  assert.ok(!xml.includes("{{"));
  assert.ok(!xml.includes("NEVER_EXPORT_THIS_HASH"));
  assert.ok(!xml.includes("h12345678"));
  assert.ok(xml.includes("Firma del "));
  assert.ok(!xml.includes("DATOS DEL APODERADO"));
  assert.equal(
    (xml.match(/<w:p[ >]/g) || []).length,
    (strFromU8(original["word/document.xml"]).match(/<w:p[ >]/g) || []).length,
  );
});

test("sacrament X marks are inserted into the correct original boxes in both Word renderings", () => {
  const xml = xmlOf(generateMemberDocument(adultTemplate, member()));
  assert.match(drawingText(xml, "Rectángulo 28"), />X<\/w:t>/);
  assert.match(drawingText(xml, "Rectángulo 30"), />X<\/w:t>/);
  assert.doesNotMatch(drawingText(xml, "Rectángulo 29"), />X<\/w:t>/);
  assert.doesNotMatch(drawingText(xml, "Rectángulo 31"), />X<\/w:t>/);
  assert.equal((xml.match(/>X<\/w:t>/g) || []).length, 4);
});

test("minor DOCX includes all guardian fields and independent sacrament marks", () => {
  const minor = member({
    birthDate: `${Number(todayDate().slice(0, 4)) - 12}-01-01`,
    category: "postulante",
    swornAt: "",
    guardian: {
      fullName: 'Madre "Rosa" & María',
      dni: "87654321",
      education: "Superior",
      address: "Av. La Cruz 30",
      phone: "987654321",
      age: "42",
      relationship: "Madre",
      sacraments: ["Confirmación"],
    },
  });
  const xml = xmlOf(generateMemberDocument(minorTemplate, minor));
  for (const text of [
    "DATOS DEL APODERADO",
    "Madre &quot;Rosa&quot; &amp; María",
    "87654321",
    "Superior",
    "Av. La Cruz 30",
    "987654321",
    "Madre",
    "42",
    "Categoría: Postulante",
    "Firma del Apoderado",
  ])
    assert.ok(xml.includes(text), text);
  assert.doesNotMatch(drawingText(xml, "Rectángulo 14"), />X<\/w:t>/);
  assert.match(drawingText(xml, "Rectángulo 15"), />X<\/w:t>/);
  assert.doesNotMatch(drawingText(xml, "Rectángulo 16"), />X<\/w:t>/);
  assert.ok(!xml.includes("{{"));
  assert.throws(
    () => generateMemberDocument(adultTemplate, minor),
    /no corresponde/,
  );
});

test("retired and reentering members retain distinct category/status and lifecycle date", () => {
  const retired = xmlOf(
    generateMemberDocument(
      adultTemplate,
      member({ status: "retirado", retiredAt: "2026-10-01" }),
    ),
  );
  assert.ok(retired.includes("Categoría: Activo"));
  assert.ok(retired.includes("Estado: Retirado"));
  assert.ok(retired.includes("Retiro: 01/10/2026"));
  const rejoined = xmlOf(
    generateMemberDocument(
      adultTemplate,
      member({ category: "reingresante", rejoinedAt: "2026-11-06" }),
    ),
  );
  assert.ok(rejoined.includes("Reingresante (en prueba)"));
  assert.ok(rejoined.includes("Reingreso: 06/11/2026"));
});

test("photo is embedded with a Word relationship and does not leave the FOTO watermark", () => {
  const photo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+njKkAAAAASUVORK5CYII=";
  const files = unzipSync(
    generateMemberDocument(adultTemplate, member({ photo })),
  );
  assert.ok(files["word/media/hcsmp-member-photo.png"].length > 0);
  assert.ok(
    strFromU8(files["word/_rels/document.xml.rels"]).includes(
      'Target="media/hcsmp-member-photo.png"',
    ),
  );
  const xml = strFromU8(files["word/document.xml"]);
  assert.ok(xml.includes('r:embed="rIdHcsmpMemberPhoto"'));
  assert.ok(xml.includes('r:id="rIdHcsmpMemberPhoto"'));
  assert.ok(!xml.includes(">FOTO<"));
  assert.throws(
    () =>
      generateMemberDocument(
        adultTemplate,
        member({ photo: "data:image/webp;base64,AAAA" }),
      ),
    /convertirse/,
  );
});

test("invalid XML controls are removed and download filenames are sanitized", () => {
  const xml = xmlOf(
    generateMemberDocument(
      adultTemplate,
      member({ address: "Av. Uno\u0000\u000b\u001f & Dos" }),
    ),
  );
  assert.ok(xml.includes("Av. Uno &amp; Dos"));
  assert.ok(!xml.includes("\u0000"));
  assert.equal(
    memberDocumentFilename(member({ fullName: "José / López <Demo>" })),
    "ficha-jose-lopez-demo-12345678.pdf",
  );
});

test("long values remain complete and readable in a supplementary page instead of clipping", () => {
  const fullName = "Nombre ".repeat(20).trim();
  const address = "Av. Dirección amplia y completa número 123; "
    .repeat(6)
    .slice(0, 250);
  const guardianName = "Apoderado ".repeat(15).trim();
  const guardianAddress = "Distrito y dirección del apoderado, "
    .repeat(8)
    .slice(0, 250);
  const minor = member({
    fullName,
    address,
    birthDate: `${Number(todayDate().slice(0, 4)) - 12}-01-01`,
    category: "postulante",
    guardian: {
      fullName: guardianName,
      address: guardianAddress,
      dni: "87654321",
      phone: "987654321",
      education: "Superior",
      relationship: "Madre",
      age: "42",
      sacraments: [],
    },
  });
  const xml = xmlOf(generateMemberDocument(minorTemplate, minor));
  assert.ok(xml.includes("Información complementaria de la ficha"));
  assert.ok(xml.includes("<w:pageBreakBefore/>"));
  assert.ok(xml.includes("(ver anexo)"));
  for (const value of [fullName, address, guardianName, guardianAddress])
    assert.ok(xml.includes(value), value);
  const appendix = xml.slice(
    xml.indexOf("Información complementaria de la ficha"),
  );
  assert.ok(appendix.includes('w:sz w:val="24"'));
  assert.ok(!xml.includes('w:sz w:val="12"'));
});

const adultPdf = readFileSync(
  new URL("../public/templates/ficha-mayores.pdf", import.meta.url),
);
const minorPdf = readFileSync(
  new URL("../public/templates/ficha-menores.pdf", import.meta.url),
);
const pdfFont = readFileSync(
  new URL("../public/fonts/LiberationSans-Regular.ttf", import.meta.url),
);

test("monthly cash report separates cash income, expenses and excludes charges", async () => {
  const report = await generateMonthlyCashReport(
    [
      {
        id: "income",
        date: "2026-11-02",
        description: "Donación",
        memberId: "",
        type: "ingreso",
        amount: 25,
      },
      {
        id: "payment",
        date: "2026-11-03",
        description: "Cuota pagada",
        memberId: "document-test",
        type: "pago",
        amount: 10,
      },
      {
        id: "expense",
        date: "2026-11-04",
        description: "Materiales",
        memberId: "",
        type: "egreso",
        amount: 8,
      },
      {
        id: "charge",
        date: "2026-11-04",
        description: "Cargo no cobrado",
        memberId: "document-test",
        type: "cargo",
        amount: 20,
      },
      {
        id: "other-month",
        date: "2026-10-31",
        description: "Fuera del periodo",
        memberId: "",
        type: "ingreso",
        amount: 100,
      },
    ],
    [member()],
    "2026-11",
    pdfFont,
  );
  const pdf = await PDFDocument.load(report);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(pdf.getTitle()?.includes("noviembre de 2026"));
  assert.ok(
    pdf.getSubject()?.includes("2 ingresos · 1 egresos · Caja neta S/ 27.00"),
  );
});

test("monthly cash report paginates large ledgers without dropping rows", async () => {
  const movements = Array.from({ length: 80 }, (_, index) => ({
    id: `income-${index}`,
    date: `2026-11-${String((index % 28) + 1).padStart(2, "0")}`,
    description: `Ingreso de prueba ${index + 1}`,
    memberId: "",
    type: "ingreso" as const,
    amount: 1,
  }));
  const report = await generateMonthlyCashReport(
    movements,
    [],
    "2026-11",
    pdfFont,
  );
  const pdf = await PDFDocument.load(report);
  assert.ok(pdf.getPageCount() > 1);
  assert.ok(pdf.getSubject()?.includes("80 ingresos"));
  assert.ok(pdf.getSubject()?.includes("S/ 80.00"));
});

test("completed PDF preserves the adult/minor page count and includes category and membership status", async () => {
  const bytes = await generateMemberPdf(
    adultPdf,
    pdfFont,
    member({ category: "reingresante" }),
  );
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const adult = await PDFDocument.load(bytes);
  assert.equal(adult.getPageCount(), 1);
  assert.ok(adult.getSubject()?.includes("Reingresante (en prueba)"));
  assert.ok(adult.getTitle()?.includes("Ana & José <López>"));
  const minor = member({
    birthDate: `${Number(todayDate().slice(0, 4)) - 12}-01-01`,
    category: "postulante",
    swornAt: "",
    guardian: {
      fullName: "María & Rosa",
      dni: "87654321",
      education: "Superior",
      address: "Av. Dos",
      phone: "999987654",
      age: "42",
      relationship: "Madre",
      sacraments: ["Bautizo"],
    },
  });
  const loadedMinor = await PDFDocument.load(
    await generateMemberPdf(minorPdf, pdfFont, minor),
  );
  assert.equal(loadedMinor.getPageCount(), 2);
  assert.ok(loadedMinor.getSubject()?.includes("menor de edad"));
  await assert.rejects(
    () => generateMemberPdf(adultPdf, pdfFont, minor),
    /no corresponde/,
  );
});

test("completed PDF adds a readable appendix for long data and embeds photos", async () => {
  const long = member({
    fullName: "Nombre ".repeat(20).trim(),
    address: "Dirección completa ".repeat(15).slice(0, 250),
  });
  const pdf = await PDFDocument.load(
    await generateMemberPdf(adultPdf, pdfFont, long),
  );
  assert.equal(pdf.getPageCount(), 2);
  const photo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+njKkAAAAASUVORK5CYII=";
  const withPhoto = await PDFDocument.load(
    await generateMemberPdf(adultPdf, pdfFont, member({ photo })),
  );
  const images = withPhoto
    .getPage(0)
    .node.Resources()
    ?.lookup(PDFName.of("XObject"), PDFDict);
  assert.ok(images && images.keys().length > 0);
});

test("roster PDF includes filters, paginates all rows and omits account credentials", async () => {
  const members = Array.from({ length: 28 }, (_, index) =>
    member({
      id: `roster-${index}`,
      fullName: `Hermano de prueba ${index + 1}`,
      dni: String(10000000 + index),
      username: `private-user-${index}`,
      passwordHash: `private-hash-${index}`,
    }),
  );
  const bytes = await generateMemberRosterPdf(pdfFont, members, {
    status: "vigente",
    category: "activo",
    ageGroup: "mayores",
    search: "Hermano",
  });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
  assert.ok(pdf.getTitle()?.includes("Padrón de hermanos"));
  assert.ok(
    pdf
      .getSubject()
      ?.includes("Vigente · Activo · Mayores de edad · Búsqueda: Hermano · 28 registros"),
  );
  assert.ok(!pdf.getSubject()?.includes("private-hash"));
});

test("the browser download always receives a PDF Blob and .pdf filename", async (context) => {
  const captured: { blob: Blob | null; filename: string; clicked: boolean } = {
    blob: null,
    filename: "",
    clicked: false,
  };
  const anchor = {
    href: "",
    download: "",
    hidden: false,
    click() {
      captured.filename = this.download;
      captured.clicked = true;
    },
    remove() {},
  };
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => anchor, body: { appendChild() {} } },
  });
  context.after(() => {
    if (previousDocument)
      Object.defineProperty(globalThis, "document", previousDocument);
    else Reflect.deleteProperty(globalThis, "document");
  });
  context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const path = String(input);
    assert.ok(path.endsWith(".pdf") || path.endsWith(".ttf"));
    const source = path.endsWith(".ttf") ? pdfFont : adultPdf;
    return new Response(new Uint8Array(source).buffer, { status: 200 });
  });
  context.mock.method(URL, "createObjectURL", (blob: Blob | MediaSource) => {
    assert.ok(blob instanceof Blob);
    captured.blob = blob;
    return "blob:test-pdf";
  });
  await downloadMemberDocument(member());
  assert.equal(captured.clicked, true);
  assert.ok(captured.filename.endsWith(".pdf"));
  assert.ok(captured.blob);
  assert.equal(captured.blob.type, "application/pdf");
  const bytes = new Uint8Array(await captured.blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
});
