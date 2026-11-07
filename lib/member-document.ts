import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  PDFDocument,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  ageOnDate,
  categoryLabels,
  statusLabels,
  todayDate,
  type Category,
  type Member,
  type MembershipStatus,
} from "./portal.ts";

const DOCUMENT_XML = "word/document.xml";
const PDF_TYPE = "application/pdf";
const RELATIONSHIP_ID = "rIdHcsmpMemberPhoto";

function xmlEscape(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dateLabel(value: string): string {
  if (!value) return "Sin registrar";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function splitName(value: string, firstLineLimit: number): [string, string] {
  const words = value.trim().split(/\s+/);
  let first = "";
  while (
    words.length &&
    (!first || `${first} ${words[0]}`.length <= firstLineLimit)
  ) {
    first = first ? `${first} ${words.shift()}` : words.shift()!;
  }
  return [first, words.join(" ")];
}

/** Uses the current completed age, including the eighteenth birthday itself. */
export function templatePathForMember(
  member: Pick<Member, "birthDate">,
  asOf = todayDate(),
): string {
  const age = ageOnDate(member.birthDate, asOf);
  if (age === null)
    throw new Error(
      "La fecha de nacimiento no permite seleccionar una ficha válida.",
    );
  return `/templates/ficha-${age < 18 ? "menores" : "mayores"}.pdf`;
}

export function memberDocumentFilename(
  member: Pick<Member, "fullName" | "dni">,
): string {
  const name = member.fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `ficha-${name || "hermano"}-${member.dni.replace(/\D/g, "")}.pdf`;
}

// Arial's Latin metrics closely match Helvetica. Estimate conservatively so the
// fixed response boxes never depend on six-point text or hidden overflow.
function textWidth(value: string, fontSize: number): number {
  const upper = [
    667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  ];
  const lower = [
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  ];
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let units = 0;
  for (const char of normalized) {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) units += upper[code - 65];
    else if (code >= 97 && code <= 122) units += lower[code - 97];
    else if (/\d/.test(char)) units += 556;
    else if (/\s/.test(char)) units += 278;
    else if (/[.,:;!'|]/.test(char)) units += 278;
    else if (/[()\[\]{}]/.test(char)) units += 389;
    else units += 1000;
  }
  return (units / 1000) * fontSize * 1.06;
}

type AppendixField = { label: string; value: string };

function appendixXml(member: Member, fields: AppendixField[]): string {
  const paragraph = (text: string, bold = false, size = 24) =>
    `<w:p><w:pPr><w:spacing w:before="100" w:after="100"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
  return (
    `<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="32"/></w:rPr><w:t>Información complementaria de la ficha</w:t></w:r></w:p>` +
    paragraph(`DNI: ${member.dni}`, true) +
    paragraph(
      "Los siguientes datos se muestran íntegros por exceder el espacio del formulario original.",
      false,
      22,
    ) +
    fields
      .map((field) => paragraph(field.label, true, 22) + paragraph(field.value))
      .join("")
  );
}

function dataValues(member: Member): Record<string, string> {
  const [firstName, lastName] = splitName(member.fullName, 32);
  const [guardianFirstName, guardianLastName] = splitName(
    member.guardian?.fullName || "",
    42,
  );
  const sacraments = new Set(
    member.sacraments.map((sacrament) => sacrament.toLocaleLowerCase("es")),
  );
  const guardianSacraments = new Set(
    (member.guardian?.sacraments || []).map((sacrament) =>
      sacrament.toLocaleLowerCase("es"),
    ),
  );
  const has = (set: Set<string>, name: string) => (set.has(name) ? "X" : "");
  const guardian = member.guardian;
  return {
    FULL_NAME_FIRST: firstName,
    FULL_NAME_LAST: lastName,
    ADDRESS: member.address || "Sin registrar",
    BIRTH_DATE: dateLabel(member.birthDate),
    AGE: String(ageOnDate(member.birthDate)),
    PHONE: member.phone || "Sin registrar",
    EMAIL: member.email || "Sin correo electrónico",
    JOINED_AT: dateLabel(member.joinedAt),
    SWORN_AT: dateLabel(member.swornAt),
    OCCUPATION: member.occupation || "Sin registrar",
    MARITAL_STATUS: member.maritalStatus || "Sin registrar",
    DNI: member.dni,
    CATEGORY:
      member.category === "reingresante"
        ? "Reingresante (en prueba)"
        : categoryLabels[member.category],
    STATUS: member.status === "retirado" ? "Retirado" : "Vigente",
    LIFECYCLE_DATE:
      member.status === "retirado" && member.retiredAt
        ? `Retiro: ${dateLabel(member.retiredAt)}`
        : member.rejoinedAt
          ? `Reingreso: ${dateLabel(member.rejoinedAt)}`
          : "",
    BAPTISM: has(sacraments, "bautizo"),
    COMMUNION: has(sacraments, "primera comunión"),
    CONFIRMATION: has(sacraments, "confirmación"),
    MARRIAGE: has(sacraments, "matrimonio"),
    GUARDIAN_NAME_FIRST: guardianFirstName || "Sin registrar",
    GUARDIAN_NAME_LAST: guardianLastName,
    GUARDIAN_EDUCATION: guardian?.education || "Sin registrar",
    GUARDIAN_ADDRESS: guardian?.address || "Sin registrar",
    GUARDIAN_DNI: guardian?.dni || "Sin registrar",
    GUARDIAN_PHONE: guardian?.phone || "Sin registrar",
    GUARDIAN_AGE: guardian?.age || "Sin registrar",
    GUARDIAN_RELATIONSHIP: guardian?.relationship || "Sin registrar",
    GUARDIAN_BAPTISM: has(guardianSacraments, "bautizo"),
    GUARDIAN_COMMUNION: has(guardianSacraments, "primera comunión"),
    GUARDIAN_CONFIRMATION: has(guardianSacraments, "confirmación"),
    PHOTO_LABEL: member.photo ? "" : "FOTO",
    PHOTO_FILLED: member.photo ? "t" : "f",
  };
}

const fieldWidths: Record<string, number> = {
  FULL_NAME_FIRST: 202,
  FULL_NAME_LAST: 343,
  ADDRESS: 278,
  BIRTH_DATE: 198,
  AGE: 219,
  PHONE: 235,
  EMAIL: 326,
  JOINED_AT: 243,
  SWORN_AT: 294,
  OCCUPATION: 294,
  MARITAL_STATUS: 264,
  DNI: 267,
  GUARDIAN_NAME_FIRST: 290,
  GUARDIAN_NAME_LAST: 398,
  GUARDIAN_EDUCATION: 423,
  GUARDIAN_ADDRESS: 423,
  GUARDIAN_DNI: 316,
  GUARDIAN_PHONE: 270,
  GUARDIAN_AGE: 260,
  GUARDIAN_RELATIONSHIP: 290,
};

function fittedAnswers(member: Member): {
  values: Record<string, string>;
  appendix: AppendixField[];
} {
  const values = dataValues(member);
  const appendix = new Map<string, AppendixField>();
  const completeFields: Record<string, AppendixField> = {
    FULL_NAME_FIRST: {
      label: "Nombres y apellidos del hermano",
      value: member.fullName,
    },
    FULL_NAME_LAST: {
      label: "Nombres y apellidos del hermano",
      value: member.fullName,
    },
    ADDRESS: { label: "Dirección del hermano", value: member.address },
    PHONE: { label: "Celular del hermano", value: member.phone },
    EMAIL: { label: "Correo electrónico", value: member.email },
    OCCUPATION: { label: "Profesión u ocupación", value: member.occupation },
    MARITAL_STATUS: { label: "Estado civil", value: member.maritalStatus },
    GUARDIAN_NAME_FIRST: {
      label: "Nombres y apellidos del apoderado",
      value: member.guardian?.fullName || "",
    },
    GUARDIAN_NAME_LAST: {
      label: "Nombres y apellidos del apoderado",
      value: member.guardian?.fullName || "",
    },
    GUARDIAN_EDUCATION: {
      label: "Grado de instrucción del apoderado",
      value: member.guardian?.education || "",
    },
    GUARDIAN_ADDRESS: {
      label: "Dirección del apoderado",
      value: member.guardian?.address || "",
    },
    GUARDIAN_PHONE: {
      label: "Celular del apoderado",
      value: member.guardian?.phone || "",
    },
    GUARDIAN_RELATIONSHIP: {
      label: "Parentesco con el menor",
      value: member.guardian?.relationship || "",
    },
  };
  for (const [field, width] of Object.entries(fieldWidths)) {
    const fullValue = values[field] || "";
    let size = 22;
    while (size > 18 && textWidth(fullValue, size / 2) > width - 4) size -= 1;
    if (textWidth(fullValue, size / 2) > width - 4) {
      size = 20;
      const suffix = "… (ver anexo)";
      let prefix = fullValue;
      while (prefix && textWidth(prefix + suffix, size / 2) > width - 4)
        prefix = prefix.slice(0, -1);
      values[field] = prefix.trimEnd() + suffix;
      const complete = completeFields[field];
      if (complete) appendix.set(complete.label, complete);
    }
    values[`${field}_SIZE`] = String(size);
  }
  return { values, appendix: [...appendix.values()] };
}

/**
 * Fills the prepared copies of the supplied DOCX forms, preserving all unrelated
 * ZIP parts and the original headings, page borders and signature areas.
 * The synchronous generator accepts PNG/JPEG photos. The browser downloader
 * prepares a portrait PNG first (including when the uploaded photo is WebP).
 */
export function generateMemberDocument(
  template: Uint8Array,
  member: Member,
): Uint8Array {
  const files = unzipSync(template);
  if (!files[DOCUMENT_XML])
    throw new Error(
      "La plantilla de ficha no contiene un documento Word válido.",
    );
  let documentXml = strFromU8(files[DOCUMENT_XML]);
  const minor = templatePathForMember(member).includes("menores");
  if (
    !documentXml.includes(
      minor ? "HCSMP_TEMPLATE_MINOR" : "HCSMP_TEMPLATE_ADULT",
    )
  ) {
    throw new Error("La plantilla no corresponde a la edad del hermano.");
  }
  const { values, appendix } = fittedAnswers(member);
  if (member.photo) {
    const image = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
      member.photo,
    );
    if (!image)
      throw new Error(
        "La fotografía debe convertirse a PNG o JPG antes de generar la ficha.",
      );
    const extension = image[1] === "jpeg" ? "jpg" : "png";
    const bytes = Uint8Array.from(atob(image[2]), (character) =>
      character.charCodeAt(0),
    );
    if (bytes.byteLength > 4 * 1024 * 1024)
      throw new Error("La fotografía es demasiado grande para la ficha.");
    const imageName = `hcsmp-member-photo.${extension}`;
    files[`word/media/${imageName}`] = bytes;
    const relationshipsPath = "word/_rels/document.xml.rels";
    const relationships = strFromU8(files[relationshipsPath]);
    files[relationshipsPath] = strToU8(
      relationships.replace(
        "</Relationships>",
        `<Relationship Id="${RELATIONSHIP_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageName}"/></Relationships>`,
      ),
    );
    const contentTypesPath = "[Content_Types].xml";
    const contentTypes = strFromU8(files[contentTypesPath]);
    if (!contentTypes.includes(`Extension="${extension}"`))
      files[contentTypesPath] = strToU8(
        contentTypes.replace(
          "</Types>",
          `<Default Extension="${extension}" ContentType="image/${image[1]}"/></Types>`,
        ),
      );
    documentXml = documentXml
      .replace(
        "<!--HCSMP_PHOTO_FILL-->",
        `<a:blipFill><a:blip r:embed="${RELATIONSHIP_ID}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`,
      )
      .replace(
        "<!--HCSMP_VML_PHOTO-->",
        `<v:imagedata r:id="${RELATIONSHIP_ID}"/>`,
      );
  } else {
    documentXml = documentXml
      .replace("<!--HCSMP_PHOTO_FILL-->", "<a:noFill/>")
      .replace("<!--HCSMP_VML_PHOTO-->", "");
  }
  documentXml = documentXml.replace(
    /\{\{([A-Z_]+)\}\}/g,
    (_token, key: string) => {
      if (!(key in values))
        throw new Error(`La plantilla contiene un campo desconocido: ${key}.`);
      return xmlEscape(values[key]);
    },
  );
  if (appendix.length) {
    const sectionEnd = /(<w:sectPr\b[\s\S]*?<\/w:sectPr>)(\s*<\/w:body>)/;
    if (!sectionEnd.test(documentXml))
      throw new Error(
        "No se pudo añadir el anexo de datos completos a la ficha.",
      );
    documentXml = documentXml.replace(
      sectionEnd,
      (_match, section: string, bodyEnd: string) =>
        appendixXml(member, appendix) + section + bodyEnd,
    );
  }
  files[DOCUMENT_XML] = strToU8(documentXml);
  return zipSync(files, { level: 6 });
}

type PdfField = {
  page: number;
  x: number;
  y: number;
  fontSize?: number;
  centerX?: number;
  width: number;
  height?: number;
};
type PdfLayout = {
  pageCount: number;
  width: number;
  height: number;
  fields: Record<string, PdfField>;
};

// Exact baselines and box widths extracted from the supplied Word forms.
const pdfLayouts: Record<"adult" | "minor", PdfLayout> = {
  adult: {
    pageCount: 1,
    width: 612.0,
    height: 792.0,
    fields: {
      FULL_NAME_FIRST: {
        page: 0,
        x: 245.35,
        y: 644.95,
        fontSize: 11.0,
        centerX: 255.107,
        width: 201.75,
      },
      FULL_NAME_LAST: {
        page: 0,
        x: 87.85,
        y: 619.7,
        fontSize: 11.0,
        centerX: 100.676,
        width: 342.75,
      },
      ADDRESS: {
        page: 0,
        x: 163.6,
        y: 589.35,
        fontSize: 11.0,
        centerX: 173.357,
        width: 278.25,
      },
      BIRTH_DATE: {
        page: 0,
        x: 249.1,
        y: 547.3,
        fontSize: 11.0,
        centerX: 258.857,
        width: 198.0,
      },
      AGE: {
        page: 0,
        x: 135.1,
        y: 509.2,
        fontSize: 11.0,
        centerX: 144.857,
        width: 219.0,
      },
      PHONE: {
        page: 0,
        x: 231.1,
        y: 470.8,
        fontSize: 11.0,
        centerX: 243.926,
        width: 234.75,
      },
      EMAIL: {
        page: 0,
        x: 237.85,
        y: 430.9,
        fontSize: 11.0,
        centerX: 247.607,
        width: 326.25,
      },
      MARITAL_STATUS: {
        page: 0,
        x: 183.1,
        y: 269.95,
        fontSize: 11.0,
        centerX: 195.926,
        width: 264.0,
      },
      DNI: {
        page: 0,
        x: 215.35,
        y: 230.05,
        fontSize: 11.0,
        centerX: 225.107,
        width: 266.8645,
      },
      CATEGORY: {
        page: 0,
        x: 54.1,
        y: 71.3,
        fontSize: 9.5,
        centerX: 62.5217,
        width: 174.0,
      },
      STATUS: {
        page: 0,
        x: 54.1,
        y: 60.4,
        fontSize: 9.5,
        centerX: 65.1675,
        width: 174.0,
      },
      LIFECYCLE_DATE: {
        page: 0,
        x: 54.1,
        y: 49.5,
        fontSize: 9.5,
        centerX: 65.1675,
        width: 174.0,
      },
      JOINED_AT: {
        page: 0,
        x: 336.85,
        y: 388.05,
        fontSize: 11.0,
        centerX: 349.676,
        width: 243.0,
      },
      SWORN_AT: {
        page: 0,
        x: 270.05,
        y: 350.55,
        fontSize: 11.0,
        centerX: 282.876,
        width: 294.0,
      },
      BAPTISM: {
        page: 0,
        x: 184.85,
        y: 162.65,
        fontSize: 13.0,
        centerX: 189.9005,
        width: 28.5,
      },
      CONFIRMATION: {
        page: 0,
        x: 234.6,
        y: 132.4,
        fontSize: 13.0,
        centerX: 238.929,
        width: 28.5,
      },
      OCCUPATION: {
        page: 0,
        x: 270.1,
        y: 310.5,
        fontSize: 11.0,
        centerX: 282.926,
        width: 294.0,
      },
      COMMUNION: {
        page: 0,
        x: 450.3,
        y: 159.15,
        fontSize: 13.0,
        centerX: 456.4295,
        width: 28.5,
      },
      MARRIAGE: {
        page: 0,
        x: 395.5,
        y: 128.35,
        fontSize: 13.0,
        centerX: 400.193,
        width: 28.5,
      },
      PHOTO: {
        page: 0,
        x: 457.45,
        y: 505.3,
        width: 117.75,
        height: 155.25,
      },
    },
  },
  minor: {
    pageCount: 2,
    width: 612.0,
    height: 792.0,
    fields: {
      FULL_NAME_FIRST: {
        page: 0,
        x: 245.35,
        y: 644.95,
        fontSize: 11.0,
        centerX: 255.107,
        width: 201.75,
      },
      FULL_NAME_LAST: {
        page: 0,
        x: 87.85,
        y: 619.7,
        fontSize: 11.0,
        centerX: 100.676,
        width: 342.75,
      },
      ADDRESS: {
        page: 0,
        x: 163.6,
        y: 589.35,
        fontSize: 11.0,
        centerX: 173.357,
        width: 278.25,
      },
      BIRTH_DATE: {
        page: 0,
        x: 249.1,
        y: 547.3,
        fontSize: 11.0,
        centerX: 258.857,
        width: 198.0,
      },
      AGE: {
        page: 0,
        x: 135.1,
        y: 509.2,
        fontSize: 11.0,
        centerX: 144.857,
        width: 219.0,
      },
      PHONE: {
        page: 0,
        x: 231.1,
        y: 470.8,
        fontSize: 11.0,
        centerX: 243.926,
        width: 234.75,
      },
      EMAIL: {
        page: 0,
        x: 237.85,
        y: 430.9,
        fontSize: 11.0,
        centerX: 247.607,
        width: 326.25,
      },
      MARITAL_STATUS: {
        page: 0,
        x: 183.1,
        y: 269.95,
        fontSize: 11.0,
        centerX: 195.926,
        width: 264.0,
      },
      DNI: {
        page: 0,
        x: 215.35,
        y: 230.05,
        fontSize: 11.0,
        centerX: 225.107,
        width: 266.8645,
      },
      CATEGORY: {
        page: 0,
        x: 54.1,
        y: 72.0,
        fontSize: 9.5,
        centerX: 62.5217,
        width: 174.0,
      },
      STATUS: {
        page: 0,
        x: 54.1,
        y: 61.1,
        fontSize: 9.5,
        centerX: 65.1675,
        width: 174.0,
      },
      LIFECYCLE_DATE: {
        page: 0,
        x: 54.1,
        y: 50.2,
        fontSize: 9.5,
        centerX: 65.1675,
        width: 174.0,
      },
      JOINED_AT: {
        page: 0,
        x: 336.85,
        y: 388.05,
        fontSize: 11.0,
        centerX: 349.676,
        width: 243.0,
      },
      SWORN_AT: {
        page: 0,
        x: 270.05,
        y: 350.55,
        fontSize: 11.0,
        centerX: 282.876,
        width: 294.0,
      },
      BAPTISM: {
        page: 0,
        x: 184.85,
        y: 162.65,
        fontSize: 13.0,
        centerX: 189.9005,
        width: 28.5,
      },
      CONFIRMATION: {
        page: 0,
        x: 234.6,
        y: 132.4,
        fontSize: 13.0,
        centerX: 238.929,
        width: 28.5,
      },
      OCCUPATION: {
        page: 0,
        x: 270.1,
        y: 310.5,
        fontSize: 11.0,
        centerX: 282.926,
        width: 294.0,
      },
      COMMUNION: {
        page: 0,
        x: 450.3,
        y: 159.15,
        fontSize: 13.0,
        centerX: 456.4295,
        width: 28.5,
      },
      MARRIAGE: {
        page: 0,
        x: 395.5,
        y: 128.35,
        fontSize: 13.0,
        centerX: 400.193,
        width: 28.5,
      },
      GUARDIAN_BAPTISM: {
        page: 1,
        x: 223.6,
        y: 335.05,
        fontSize: 13.0,
        centerX: 227.565,
        width: 28.5,
      },
      GUARDIAN_CONFIRMATION: {
        page: 1,
        x: 260.2,
        y: 288.95,
        fontSize: 13.0,
        centerX: 264.893,
        width: 28.5,
      },
      GUARDIAN_COMMUNION: {
        page: 1,
        x: 301.45,
        y: 246.45,
        fontSize: 13.0,
        centerX: 305.779,
        width: 28.5,
      },
      GUARDIAN_NAME_FIRST: {
        page: 1,
        x: 279.05,
        y: 691.3,
        fontSize: 11.0,
        centerX: 291.876,
        width: 286.5,
      },
      GUARDIAN_NAME_LAST: {
        page: 1,
        x: 154.55,
        y: 668.65,
        fontSize: 11.0,
        centerX: 167.376,
        width: 390.75,
      },
      GUARDIAN_EDUCATION: {
        page: 1,
        x: 131.35,
        y: 622.85,
        fontSize: 11.0,
        centerX: 144.176,
        width: 414.0,
      },
      GUARDIAN_ADDRESS: {
        page: 1,
        x: 147.1,
        y: 574.4,
        fontSize: 11.0,
        centerX: 159.926,
        width: 411.0,
      },
      GUARDIAN_DNI: {
        page: 1,
        x: 162.8,
        y: 528.4,
        fontSize: 11.0,
        centerX: 175.626,
        width: 309.75,
      },
      GUARDIAN_PHONE: {
        page: 1,
        x: 162.8,
        y: 483.9,
        fontSize: 11.0,
        centerX: 175.626,
        width: 254.25,
      },
      GUARDIAN_AGE: {
        page: 1,
        x: 168.85,
        y: 441.65,
        fontSize: 11.0,
        centerX: 181.676,
        width: 258.0,
      },
      GUARDIAN_RELATIONSHIP: {
        page: 1,
        x: 257.95,
        y: 386.7,
        fontSize: 11.0,
        centerX: 270.776,
        width: 278.7907,
      },
      PHOTO: {
        page: 0,
        x: 457.45,
        y: 505.3,
        width: 117.75,
        height: 155.25,
      },
    },
  },
};

async function portraitPhoto(photo: string): Promise<string> {
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(photo))
    throw new Error("La fotografía almacenada no es una imagen compatible.");
  const image = new Image();
  image.src = photo;
  try {
    await image.decode();
  } catch {
    throw new Error(
      "No se pudo preparar la fotografía para la ficha. Revisa la imagen del hermano.",
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 471;
  canvas.height = 621;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error(
      "El navegador no permite preparar la fotografía de la ficha.",
    );
  const scale = Math.max(
    canvas.width / image.naturalWidth,
    canvas.height / image.naturalHeight,
  );
  const width = image.naturalWidth * scale,
    height = image.naturalHeight * scale;
  context.drawImage(
    image,
    (canvas.width - width) / 2,
    (canvas.height - height) / 2,
    width,
    height,
  );
  return canvas.toDataURL("image/png");
}

function plainText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

function wrappedLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of plainText(text).split(/\s+/)) {
    if (!word) continue;
    const combined = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(combined, size) <= maxWidth) {
      current = combined;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    for (const character of word) {
      if (
        current &&
        font.widthOfTextAtSize(current + character, size) > maxWidth
      ) {
        lines.push(current);
        current = "";
      }
      current += character;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function addPdfAppendix(
  pdf: PDFDocument,
  font: PDFFont,
  member: Member,
  fields: AppendixField[],
  layout: PdfLayout,
): void {
  let page: PDFPage;
  let y = 0;
  function nextPage() {
    page = pdf.addPage([layout.width, layout.height]);
    page.drawRectangle({
      x: 25,
      y: 25,
      width: layout.width - 50,
      height: layout.height - 50,
      borderWidth: 2,
      borderColor: rgb(0, 0, 0),
    });
    y = layout.height - 65;
    page.drawText("Información complementaria de la ficha", {
      x: 50,
      y,
      size: 16,
      font,
    });
    y -= 26;
    page.drawText(`DNI: ${member.dni}`, { x: 50, y, size: 11, font });
    y -= 30;
  }
  function line(text: string, size: number) {
    if (y < 65) nextPage();
    page.drawText(text, { x: 50, y, size, font });
    y -= size + 5;
  }
  nextPage();
  for (const text of wrappedLines(
    "Datos completos que exceden el espacio del formulario original.",
    font,
    11,
    layout.width - 100,
  ))
    line(text, 11);
  y -= 12;
  for (const field of fields) {
    if (y < 110) nextPage();
    for (const text of wrappedLines(field.label, font, 11, layout.width - 100))
      line(text, 11);
    for (const text of wrappedLines(field.value, font, 12, layout.width - 100))
      line(text, 12);
    y -= 16;
  }
}

/** Generates the completed PDF locally, using the PDF versions of the original forms. */
export async function generateMemberPdf(
  template: Uint8Array,
  fontBytes: Uint8Array,
  member: Member,
): Promise<Uint8Array> {
  const minor = templatePathForMember(member).includes("menores");
  const layout = pdfLayouts[minor ? "minor" : "adult"];
  const pdf = await PDFDocument.load(template);
  if (pdf.getPageCount() !== layout.pageCount)
    throw new Error("La plantilla PDF no corresponde a la edad del hermano.");
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const { values, appendix } = fittedAnswers(member);
  const checkboxes = new Set([
    "BAPTISM",
    "COMMUNION",
    "CONFIRMATION",
    "MARRIAGE",
    "GUARDIAN_BAPTISM",
    "GUARDIAN_COMMUNION",
    "GUARDIAN_CONFIRMATION",
  ]);
  for (const [field, position] of Object.entries(layout.fields)) {
    if (field === "PHOTO") continue;
    let text = plainText(values[field] || "");
    if (field === "CATEGORY") text = `Categoría: ${text}`;
    else if (field === "STATUS") text = `Estado: ${text}`;
    if (!text) continue;
    const size = checkboxes.has(field)
      ? 13
      : Number(values[`${field}_SIZE`] || (position.fontSize || 11) * 2) / 2;
    const x = checkboxes.has(field)
      ? (position.centerX || position.x) -
        font.widthOfTextAtSize(text, size) / 2
      : position.x;
    pdf
      .getPage(position.page)
      .drawText(text, { x, y: position.y, size, font, color: rgb(0, 0, 0) });
  }
  const photo = layout.fields.PHOTO;
  const photoPage = pdf.getPage(photo.page);
  if (member.photo) {
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
      member.photo,
    );
    if (!match)
      throw new Error(
        "La fotografía debe convertirse a PNG o JPG antes de generar la ficha PDF.",
      );
    const bytes = Uint8Array.from(atob(match[2]), (character) =>
      character.charCodeAt(0),
    );
    const image =
      match[1] === "png"
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes);
    const x = photo.x + 1.5,
      y = photo.y + 1.5,
      width = photo.width - 3,
      height = (photo.height || 155.25) - 3;
    const scale = Math.max(width / image.width, height / image.height);
    photoPage.pushOperators(
      pushGraphicsState(),
      rectangle(x, y, width, height),
      clip(),
      endPath(),
    );
    photoPage.drawImage(image, {
      x: x + (width - image.width * scale) / 2,
      y: y + (height - image.height * scale) / 2,
      width: image.width * scale,
      height: image.height * scale,
    });
    photoPage.pushOperators(popGraphicsState());
  } else {
    const size = 20;
    photoPage.drawText("FOTO", {
      x: photo.x + (photo.width - font.widthOfTextAtSize("FOTO", size)) / 2,
      y: photo.y + (photo.height || 155.25) / 2 - 7,
      size,
      font,
      color: rgb(0.72, 0.72, 0.72),
    });
  }
  if (appendix.length) addPdfAppendix(pdf, font, member, appendix, layout);
  pdf.setTitle(`Ficha de inscripción · ${plainText(member.fullName)}`);
  pdf.setSubject(
    `Ficha de ${minor ? "menor" : "mayor"} de edad · ${values.CATEGORY} · ${values.STATUS}`,
  );
  pdf.setCreator("Portal HCSMP");
  pdf.setProducer("HCSMP · generación local de fichas");
  return pdf.save({ useObjectStreams: false });
}

export type MemberRosterFilters = {
  status: MembershipStatus;
  category?: Category;
  ageGroup?: "mayores" | "menores";
  search?: string;
};

const rosterPageSize: [number, number] = [841.89, 595.28];
const rosterColumns = [
  { title: "#", width: 24 },
  { title: "Nombres y apellidos", width: 220 },
  { title: "DNI", width: 64 },
  { title: "Edad", width: 36 },
  { title: "Categoría", width: 95 },
  { title: "Estado", width: 58 },
  { title: "Ingreso", width: 80 },
  { title: "Juramentación", width: 100 },
  { title: "Celular", width: 90 },
] as const;

function rosterDescription(filters: MemberRosterFilters): string {
  const parts = [statusLabels[filters.status]];
  if (filters.category) parts.push(categoryLabels[filters.category]);
  if (filters.ageGroup)
    parts.push(
      filters.ageGroup === "mayores" ? "Mayores de edad" : "Menores de edad",
    );
  if (filters.search?.trim()) parts.push(`Búsqueda: ${filters.search.trim()}`);
  return parts.join(" · ");
}

function rosterFilename(filters: MemberRosterFilters): string {
  const suffix = [
    filters.status,
    filters.category,
    filters.ageGroup,
  ].filter(Boolean).join("-");
  return `padron-${suffix || "completo"}.pdf`;
}

/** Creates a paginated roster PDF locally without exporting account credentials. */
export async function generateMemberRosterPdf(
  fontBytes: Uint8Array,
  members: Member[],
  filters: MemberRosterFilters,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const [width, height] = rosterPageSize;
  const margin = 32;
  const contentWidth = width - margin * 2;
  const description = rosterDescription(filters);
  let y = 0;
  let pageNumber = 0;

  function addPage(): PDFPage {
    const nextPage = pdf.addPage(rosterPageSize);
    pageNumber += 1;
    nextPage.drawText("Padrón de hermanos", {
      x: margin,
      y: height - 35,
      size: 16,
      font,
      color: rgb(0.12, 0.18, 0.17),
    });
    nextPage.drawText(description, {
      x: margin,
      y: height - 52,
      size: 8,
      font,
      color: rgb(0.32, 0.35, 0.34),
      maxWidth: contentWidth,
    });
    nextPage.drawText(
      `${members.length} ${members.length === 1 ? "hermano" : "hermanos"} · Generado ${dateLabel(todayDate())}`,
      {
        x: margin,
        y: height - 66,
        size: 8,
        font,
        color: rgb(0.32, 0.35, 0.34),
      },
    );
    y = height - 82;
    const headerHeight = 24;
    nextPage.drawRectangle({
      x: margin,
      y: y - headerHeight + 4,
      width: contentWidth,
      height: headerHeight,
      color: rgb(0.13, 0.2, 0.19),
    });
    let x = margin;
    for (const column of rosterColumns) {
      nextPage.drawText(column.title, {
        x: x + 4,
        y: y - 11,
        size: 7.5,
        font,
        color: rgb(1, 1, 1),
        maxWidth: column.width - 8,
      });
      x += column.width;
    }
    y -= headerHeight;
    return nextPage;
  }

  let page = addPage();
  if (!members.length) {
    page.drawText("No hay hermanos que coincidan con los filtros seleccionados.", {
      x: margin,
      y: y - 12,
      size: 10,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
  }

  members.forEach((member, index) => {
    const age = ageOnDate(member.birthDate);
    const values = [
      String(index + 1),
      plainText(member.fullName),
      plainText(member.dni),
      age === null ? "—" : String(age),
      categoryLabels[member.category],
      statusLabels[member.status],
      dateLabel(member.joinedAt),
      dateLabel(member.swornAt),
      plainText(member.phone || "—"),
    ];
    const nameLines = wrappedLines(values[1], font, 8, rosterColumns[1].width - 8);
    const rowHeight = Math.max(22, nameLines.length * 9 + 8);
    if (y - rowHeight < 34) page = addPage();
    if (index % 2 === 1)
      page.drawRectangle({
        x: margin,
        y: y - rowHeight + 4,
        width: contentWidth,
        height: rowHeight,
        color: rgb(0.96, 0.96, 0.94),
      });
    let x = margin;
    values.forEach((value, columnIndex) => {
      const lines =
        columnIndex === 1
          ? nameLines
          : wrappedLines(
              value,
              font,
              7.5,
              rosterColumns[columnIndex].width - 8,
            );
      lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: x + 4,
          y: y - 12 - lineIndex * 9,
          size: columnIndex === 1 ? 8 : 7.5,
          font,
          color: rgb(0.13, 0.15, 0.14),
        });
      });
      x += rosterColumns[columnIndex].width;
    });
    y -= rowHeight;
  });

  pdf.getPages().forEach((rosterPage, index) => {
    rosterPage.drawText(`Página ${index + 1} de ${pageNumber}`, {
      x: width - margin - 60,
      y: 17,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  });
  pdf.setTitle("Padrón de hermanos · HCSMP");
  pdf.setSubject(`${description} · ${members.length} registros`);
  pdf.setCreator("Portal HCSMP");
  pdf.setProducer("HCSMP · generación local del padrón");
  return pdf.save({ useObjectStreams: false });
}

/** Downloads the selected roster locally; no member data is uploaded. */
export async function downloadMemberRoster(
  members: Member[],
  filters: MemberRosterFilters,
): Promise<void> {
  const fontResponse = await fetch("/fonts/LiberationSans-Regular.ttf");
  if (!fontResponse.ok)
    throw new Error(
      "No se pudo cargar la fuente para generar el padrón PDF. Inténtalo nuevamente.",
    );
  const font = new Uint8Array(await fontResponse.arrayBuffer());
  const bytes = await generateMemberRosterPdf(font, members, filters);
  downloadPdf(bytes, rosterFilename(filters));
}

function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: PDF_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Client-only PDF download; personal data is never uploaded to a conversion service. */
export async function downloadMemberDocument(member: Member): Promise<void> {
  const path = templatePathForMember(member);
  const [response, fontResponse] = await Promise.all([
    fetch(path),
    fetch("/fonts/LiberationSans-Regular.ttf"),
  ]);
  if (!response.ok || !fontResponse.ok)
    throw new Error(
      "No se pudo cargar la plantilla PDF de la ficha. Inténtalo nuevamente.",
    );
  const prepared = member.photo
    ? { ...member, photo: await portraitPhoto(member.photo) }
    : member;
  const [template, font] = await Promise.all([
    response.arrayBuffer(),
    fontResponse.arrayBuffer(),
  ]);
  const bytes = await generateMemberPdf(
    new Uint8Array(template),
    new Uint8Array(font),
    prepared,
  );
  downloadPdf(bytes, memberDocumentFilename(member));
}
