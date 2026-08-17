import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
  PageNumber,
  NumberFormat,
  ShadingType,
  VerticalAlign,
  TabStopPosition,
  TabStopType,
  convertInchesToTwip,
} from "docx";

// ─── Brand colours ───────────────────────────────────────────────────────────
const PINK = "E91E8C";
const DARK = "1A1A2E";
const LIGHT_GREY = "F5F5F5";
const MID_GREY = "CCCCCC";
const WHITE = "FFFFFF";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function bold(text: string, size = 22, color = DARK): TextRun {
  return new TextRun({ text, bold: true, size, color, font: "Calibri" });
}
function normal(text: string, size = 20, color = DARK): TextRun {
  return new TextRun({ text, size, color, font: "Calibri" });
}
function pink(text: string, size = 22): TextRun {
  return new TextRun({ text, bold: true, size, color: PINK, font: "Calibri" });
}

function spacer(lines = 1): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: lines * 60 } });
}

function sectionBanner(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: WHITE, font: "Calibri" })],
    heading: HeadingLevel.HEADING_1,
    shading: { type: ShadingType.SOLID, color: PINK, fill: PINK },
    spacing: { before: 60, after: 100 },
    indent: { left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: PINK, font: "Calibri" })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 120, after: 60 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: PINK },
    },
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [normal(text, 20)],
    spacing: { after: 80, line: 276 },
  });
}

function bulletItem(text: string, num?: number): Paragraph {
  const prefix = num !== undefined ? `${num}. ` : "• ";
  return new Paragraph({
    children: [normal(prefix + text, 20)],
    indent: { left: convertInchesToTwip(0.3) },
    spacing: { after: 60 },
  });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

// ─── Table helpers ────────────────────────────────────────────────────────────
const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: MID_GREY },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: MID_GREY },
  left: { style: BorderStyle.SINGLE, size: 4, color: MID_GREY },
  right: { style: BorderStyle.SINGLE, size: 4, color: MID_GREY },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: MID_GREY },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: MID_GREY },
} as const;

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: WHITE },
  bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
  left: { style: BorderStyle.NONE, size: 0, color: WHITE },
  right: { style: BorderStyle.NONE, size: 0, color: WHITE },
} as const;

function headerCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, color: WHITE, font: "Calibri" })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { type: ShadingType.SOLID, color: PINK, fill: PINK },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

function dataCell(text: string, widthPct: number, shade = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [normal(text, 18)],
        alignment: AlignmentType.LEFT,
      }),
    ],
    shading: shade ? { type: ShadingType.SOLID, color: LIGHT_GREY, fill: LIGHT_GREY } : undefined,
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

function styledTable(headerCells: TableCell[], rows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headerCells, tableHeader: true }),
      ...rows,
    ],
    borders: TABLE_BORDERS,
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────
export interface SowDocxInput {
  projectName: string;
  clientName: string;
  version: string;
  redactor: string;
  redactorRole: string;
  date: string;
  generalObjective?: string;
  specificObjectives?: string[];
  activitiesIncluded?: string[];
  deliverables?: Array<{ name: string; description: string }>;
  limitations?: string[];
  assumptions?: string[];
  clientDependencies?: string[];
  risks?: string[];
  prerequisites?: string[];
  milestones?: Array<{ number: number; description: string; deliverable: string }>;
  meetingFrequency?: string;
  communicationChannel?: string;
  totalAmount?: string;
  currency?: string;
  billingMilestones?: Array<{ description: string; percentage: string; amount: string }>;
  prodigioTeam?: Array<{ role: string; name: string; responsibilities: string }>;
  clientTeam?: Array<{ role: string; name: string; responsibilities: string }>;
  introText?: string;
}

export async function generateSowDocx(input: SowDocxInput): Promise<Buffer> {
  const currency = input.currency ?? "USD";

  // ── HEADER (every page after cover) ──────────────────────────────────────
  const pageHeader = new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          ...NO_BORDERS,
          bottom: { style: BorderStyle.SINGLE, size: 4, color: PINK },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: WHITE },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: WHITE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [pink("PRODIGIO TECH", 18)] })],
                width: { size: 30, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: NO_BORDERS,
              }),
              new TableCell({
                children: [new Paragraph({ children: [normal(`Statement of Work — ${input.projectName}`, 16, "888888")], alignment: AlignmentType.CENTER })],
                width: { size: 50, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: NO_BORDERS,
              }),
              new TableCell({
                children: [new Paragraph({ children: [normal(`v${input.version}`, 16, "888888")], alignment: AlignmentType.RIGHT })],
                width: { size: 20, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: NO_BORDERS,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const pageFooter = new Footer({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          ...NO_BORDERS,
          top: { style: BorderStyle.SINGLE, size: 4, color: PINK },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: WHITE },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: WHITE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [normal("CONFIDENCIAL — Prodigio Tech © 2026", 16, "888888")] })],
                width: { size: 70, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      normal("Página ", 16, "888888"),
                      new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888", font: "Calibri" }),
                      normal(" de ", 16, "888888"),
                      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "888888", font: "Calibri" }),
                    ],
                    alignment: AlignmentType.RIGHT,
                  }),
                ],
                width: { size: 30, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ══════════════════════════════════════════════════════════════════════════
  // COVER PAGE (separate section — no header/footer)
  // ══════════════════════════════════════════════════════════════════════════
  const coverSection = {
    properties: {
      page: {
        margin: { top: convertInchesToTwip(1.5), bottom: convertInchesToTwip(1.5), left: convertInchesToTwip(1.5), right: convertInchesToTwip(1.5) },
        pageNumbers: { formatType: NumberFormat.DECIMAL, start: 0 },
      },
      titlePage: true,
    },
    headers: { default: new Header({ children: [new Paragraph({ children: [] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ children: [] })] }) },
    children: [
      // Top accent bar
      new Paragraph({
        children: [new TextRun({ text: " ", size: 8 })],
        shading: { type: ShadingType.SOLID, color: PINK, fill: PINK },
        spacing: { after: 0 },
      }),
      spacer(4),
      // Company name
      new Paragraph({
        children: [new TextRun({ text: "PRODIGIO TECH", bold: true, size: 52, color: PINK, font: "Calibri" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }),
      // Document type
      new Paragraph({
        children: [new TextRun({ text: "STATEMENT OF WORK", bold: true, size: 36, color: DARK, font: "Calibri" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "SoW", size: 28, color: "888888", font: "Calibri" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      // Divider line
      new Paragraph({
        children: [new TextRun({ text: " " })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PINK } },
        spacing: { after: 400 },
      }),
      // Project name
      new Paragraph({
        children: [new TextRun({ text: input.projectName, bold: true, size: 40, color: DARK, font: "Calibri" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Cliente: ${input.clientName}`, size: 26, color: "555555", font: "Calibri" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 500 },
      }),
      // Metadata table
      new Table({
        width: { size: 60, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [headerCell("Campo", 40), headerCell("Detalle", 60)] }),
          new TableRow({ children: [dataCell("Versión", 40, true), dataCell(input.version, 60)] }),
          new TableRow({ children: [dataCell("Fecha", 40, true), dataCell(input.date, 60)] }),
          new TableRow({ children: [dataCell("Redactor", 40, true), dataCell(input.redactor, 60)] }),
          new TableRow({ children: [dataCell("Cargo", 40, true), dataCell(input.redactorRole, 60)] }),
          new TableRow({ children: [dataCell("Estado", 40, true), dataCell("Borrador", 60)] }),
          new TableRow({ children: [dataCell("Clasificación", 40, true), dataCell("CONFIDENCIAL", 60)] }),
        ],
        borders: TABLE_BORDERS,
      }),
    ],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN DOCUMENT (single section — with header/footer)
  // Strategy: NO page breaks between short preliminary sections.
  //           Page breaks ONLY before major numbered content sections.
  // ══════════════════════════════════════════════════════════════════════════

  const children: (Paragraph | Table)[] = [];

  // ── Build cached TOC entries based on which sections exist ──────────────
  const tocEntries: Array<{ title: string; level: number }> = [];
  // Preliminary sections
  tocEntries.push({ title: "Control de Versiones", level: 1 });
  tocEntries.push({ title: "Cláusula de Confidencialidad", level: 1 });
  // Section 1
  tocEntries.push({ title: "1. Introducción y Objetivos", level: 1 });
  tocEntries.push({ title: "1.1 Objetivo General", level: 2 });
  if (input.specificObjectives?.length) {
    tocEntries.push({ title: "1.2 Objetivos Específicos", level: 2 });
  }
  // Section 2
  tocEntries.push({ title: "2. Alcance del Proyecto", level: 1 });
  if (input.activitiesIncluded?.length) tocEntries.push({ title: "2.1 Actividades Incluidas", level: 2 });
  if (input.deliverables?.length) tocEntries.push({ title: "2.2 Entregables", level: 2 });
  if (input.limitations?.length) tocEntries.push({ title: "2.3 Limitaciones y Exclusiones", level: 2 });
  if (input.assumptions?.length) tocEntries.push({ title: "2.4 Supuestos", level: 2 });
  if (input.clientDependencies?.length) tocEntries.push({ title: "2.5 Dependencias del Cliente", level: 2 });
  if (input.risks?.length) tocEntries.push({ title: "2.6 Riesgos", level: 2 });
  if (input.prerequisites?.length) tocEntries.push({ title: "2.7 Pre-requisitos del Cliente", level: 2 });
  // Section 3
  if (input.milestones?.length) tocEntries.push({ title: "3. Hitos del Proyecto", level: 1 });
  // Section 4
  tocEntries.push({ title: "4. Metodología y Gobierno", level: 1 });
  tocEntries.push({ title: "4.1 Gestión del Proyecto", level: 2 });
  if (input.meetingFrequency) tocEntries.push({ title: "4.2 Frecuencia de Reuniones", level: 2 });
  if (input.communicationChannel) tocEntries.push({ title: "4.3 Canal de Comunicación", level: 2 });
  // Section 5
  tocEntries.push({ title: "5. Roles y Responsabilidades", level: 1 });
  if (input.prodigioTeam?.length) tocEntries.push({ title: "5.1 Proveedor — Prodigio Tech", level: 2 });
  if (input.clientTeam?.length) tocEntries.push({ title: `5.2 Cliente — ${input.clientName}`, level: 2 });
  // Section 6
  tocEntries.push({ title: "6. Precio y Condiciones de Pago", level: 1 });
  // Section 7
  tocEntries.push({ title: "7. Aceptación Final y Firmas", level: 1 });

  // ── TABLE OF CONTENTS section ─────────────────────────────────────────
  const tocSection = {
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1.2),
          bottom: convertInchesToTwip(1.0),
          left: convertInchesToTwip(1.2),
          right: convertInchesToTwip(1.2),
        },
      },
    },
    headers: { default: pageHeader },
    footers: { default: pageFooter },
    children: [
      // TOC Title
      new Paragraph({
        children: [new TextRun({ text: "TABLA DE CONTENIDOS", bold: true, size: 32, color: PINK, font: "Calibri" })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 200 },
      }),
      // Divider
      new Paragraph({
        children: [new TextRun({ text: " " })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PINK } },
        spacing: { after: 300 },
      }),
      // TOC field
      new TableOfContents("Tabla de Contenidos", {
        hyperlink: true,
        headingStyleRange: "1-2",
        cachedEntries: tocEntries.map((e) => ({
          title: e.title,
          level: e.level,
        })),
      }),
    ],
  };

  // ── CONTROL DE VERSIONES (flows immediately, no page break) ─────────────
  children.push(
    sectionBanner("CONTROL DE VERSIONES"),
    spacer(),
    styledTable(
      [headerCell("Versión", 15), headerCell("Fecha", 20), headerCell("Autor", 25), headerCell("Descripción del Cambio", 40)],
      [
        new TableRow({
          children: [
            dataCell(input.version, 15),
            dataCell(input.date, 20),
            dataCell(input.redactor, 25),
            dataCell("Versión inicial del documento", 40),
          ],
        }),
      ]
    ),
    spacer(2),
  );

  // ── CLÁUSULA DE CONFIDENCIALIDAD (flows after version, no page break) ──
  children.push(
    sectionBanner("CLÁUSULA DE CONFIDENCIALIDAD"),
    spacer(),
    new Paragraph({
      children: [bold("INFORMACIÓN CONFIDENCIAL", 20, PINK)],
      spacing: { after: 80 },
    }),
    bodyParagraph(
      `El presente documento contiene información confidencial y de propiedad exclusiva de Prodigio Tech y de ${input.clientName}. ` +
      `Su contenido no podrá ser reproducido, divulgado, distribuido ni utilizado, total o parcialmente, sin el consentimiento previo y por escrito de ambas partes.`
    ),
    bodyParagraph(
      "Este documento está destinado exclusivamente a las personas y organizaciones identificadas como destinatarias del mismo. " +
      "Cualquier uso no autorizado, divulgación, copia o distribución de este documento o de su contenido está estrictamente prohibido y puede ser contrario a la ley."
    ),
    bodyParagraph(
      "Las partes acuerdan mantener la confidencialidad de toda la información intercambiada en el marco de este Statement of Work, " +
      "incluyendo pero no limitándose a: datos técnicos, estrategias de negocio, información de clientes, precios y condiciones comerciales."
    ),
  );

  // ── PAGE BREAK before Section 1 ─────────────────────────────────────────
  children.push(pageBreak());

  // ── SECTION 1: INTRODUCTION & OBJECTIVES ────────────────────────────────
  children.push(sectionBanner("1. INTRODUCCIÓN Y OBJETIVOS"), spacer());
  if (input.introText) {
    children.push(bodyParagraph(input.introText), spacer());
  }
  children.push(subHeading("1.1 Objetivo General"), bodyParagraph(input.generalObjective ?? "Por definir."));
  if (input.specificObjectives?.length) {
    children.push(spacer(), subHeading("1.2 Objetivos Específicos"));
    input.specificObjectives.forEach((o, i) => children.push(bulletItem(o, i + 1)));
  }

  // ── SECTION 2: SCOPE (flows after section 1, no forced page break) ─────
  children.push(spacer(), sectionBanner("2. ALCANCE DEL PROYECTO"), spacer());
  if (input.activitiesIncluded?.length) {
    children.push(subHeading("2.1 Actividades Incluidas"));
    input.activitiesIncluded.forEach((a, i) => children.push(bulletItem(a, i + 1)));
    children.push(spacer());
  }
  if (input.deliverables?.length) {
    children.push(
      subHeading("2.2 Entregables"),
      styledTable(
        [headerCell("N°", 8), headerCell("Entregable", 30), headerCell("Descripción", 62)],
        input.deliverables.map((d, i) =>
          new TableRow({
            children: [
              dataCell(String(i + 1), 8, i % 2 === 0),
              dataCell(d.name, 30, i % 2 === 0),
              dataCell(d.description, 62, i % 2 === 0),
            ],
          })
        )
      ),
      spacer(),
    );
  }
  if (input.limitations?.length) {
    children.push(subHeading("2.3 Limitaciones y Exclusiones"));
    input.limitations.forEach((l, i) => children.push(bulletItem(l, i + 1)));
    children.push(spacer());
  }
  if (input.assumptions?.length) {
    children.push(subHeading("2.4 Supuestos"));
    input.assumptions.forEach((a, i) => children.push(bulletItem(a, i + 1)));
    children.push(spacer());
  }
  if (input.clientDependencies?.length) {
    children.push(subHeading("2.5 Dependencias del Cliente"));
    input.clientDependencies.forEach((d, i) => children.push(bulletItem(d, i + 1)));
    children.push(spacer());
  }
  if (input.risks?.length) {
    children.push(subHeading("2.6 Riesgos"));
    input.risks.forEach((r, i) => children.push(bulletItem(r, i + 1)));
    children.push(spacer());
  }
  if (input.prerequisites?.length) {
    children.push(subHeading("2.7 Pre-requisitos del Cliente"));
    input.prerequisites.forEach((p, i) => children.push(bulletItem(p, i + 1)));
    children.push(spacer());
  }

  // ── SECTION 3: MILESTONES ───────────────────────────────────────────────
  if (input.milestones?.length) {
    children.push(
      sectionBanner("3. HITOS DEL PROYECTO"),
      spacer(),
      styledTable(
        [headerCell("N°", 10), headerCell("Hito", 45), headerCell("Entregable", 45)],
        input.milestones.map((m, i) =>
          new TableRow({
            children: [
              dataCell(String(m.number ?? i + 1), 10, i % 2 === 0),
              dataCell(m.description, 45, i % 2 === 0),
              dataCell(m.deliverable, 45, i % 2 === 0),
            ],
          })
        )
      ),
      spacer(),
    );
  }

  // ── SECTION 4: GOVERNANCE ───────────────────────────────────────────────
  children.push(sectionBanner("4. METODOLOGÍA Y GOBIERNO"), spacer());
  children.push(
    subHeading("4.1 Gestión del Proyecto"),
    bodyParagraph(
      "La gestión del proyecto será realizada por Prodigio Tech, asegurando la planificación, coordinación, seguimiento y control de las actividades, " +
      "así como la gestión de riesgos, cambios y comunicaciones."
    ),
  );
  if (input.meetingFrequency) {
    children.push(spacer(), subHeading("4.2 Frecuencia de Reuniones"), bodyParagraph(input.meetingFrequency));
  }
  if (input.communicationChannel) {
    children.push(spacer(), subHeading("4.3 Canal de Comunicación"), bodyParagraph(input.communicationChannel));
  }

  // ── SECTION 5: TEAMS ───────────────────────────────────────────────────
  children.push(spacer(), sectionBanner("5. ROLES Y RESPONSABILIDADES"), spacer());
  if (input.prodigioTeam?.length) {
    children.push(
      subHeading("5.1 Proveedor — Prodigio Tech"),
      styledTable(
        [headerCell("Rol", 30), headerCell("Nombre", 25), headerCell("Responsabilidades", 45)],
        input.prodigioTeam.map((m, i) =>
          new TableRow({
            children: [
              dataCell(m.role, 30, i % 2 === 0),
              dataCell(m.name, 25, i % 2 === 0),
              dataCell(m.responsibilities, 45, i % 2 === 0),
            ],
          })
        )
      ),
      spacer(),
    );
  }
  if (input.clientTeam?.length) {
    children.push(
      subHeading(`5.2 Cliente — ${input.clientName}`),
      styledTable(
        [headerCell("Rol", 30), headerCell("Nombre", 25), headerCell("Responsabilidades", 45)],
        input.clientTeam.map((m, i) =>
          new TableRow({
            children: [
              dataCell(m.role, 30, i % 2 === 0),
              dataCell(m.name, 25, i % 2 === 0),
              dataCell(m.responsibilities, 45, i % 2 === 0),
            ],
          })
        )
      ),
      spacer(),
    );
  }

  // ── SECTION 6: PRICING ──────────────────────────────────────────────────
  children.push(sectionBanner("6. PRECIO Y CONDICIONES DE PAGO"), spacer());
  children.push(
    bodyParagraph(
      `El servicio descrito en este SoW será prestado bajo la modalidad precio fijo por un monto total de ${input.totalAmount ?? "Por definir"} ${currency}, ` +
      "conforme a las siguientes condiciones de pago:"
    ),
    spacer(),
  );
  if (input.billingMilestones?.length) {
    children.push(
      styledTable(
        [headerCell("Hito de Facturación", 55), headerCell("%", 15), headerCell(`Monto (${currency})`, 30)],
        [
          ...input.billingMilestones.map((b, i) =>
            new TableRow({
              children: [
                dataCell(b.description, 55, i % 2 === 0),
                dataCell(`${b.percentage}%`, 15, i % 2 === 0),
                dataCell(b.amount, 30, i % 2 === 0),
              ],
            })
          ),
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [bold("TOTAL", 20)], alignment: AlignmentType.RIGHT })],
                columnSpan: 1,
                shading: { type: ShadingType.SOLID, color: LIGHT_GREY, fill: LIGHT_GREY },
                width: { size: 55, type: WidthType.PERCENTAGE },
                margins: { top: 60, bottom: 60, left: 80, right: 80 },
              }),
              dataCell("100%", 15, true),
              dataCell(`${input.totalAmount ?? "—"} ${currency}`, 30, true),
            ],
          }),
        ]
      ),
      spacer(),
    );
  }

  // ── SECTION 7: ACCEPTANCE & SIGNATURES ──────────────────────────────────
  children.push(sectionBanner("7. ACEPTACIÓN FINAL Y FIRMAS"), spacer());
  children.push(
    bodyParagraph(
      "Se considerará otorgada la Aceptación Final del Servicio una vez que se cumplan de manera concurrente las siguientes condiciones:"
    ),
    bulletItem("Que todos los entregables comprometidos en el presente SoW hayan sido entregados por el Proveedor y aceptados formalmente por el Cliente.", 1),
    bulletItem("Que el alcance del servicio haya sido ejecutado en conformidad con lo establecido en este SoW, sin observaciones pendientes.", 2),
    bulletItem("Que ambas Partes suscriban el Acta de Aceptación Final correspondiente, dejando constancia del cierre satisfactorio del servicio.", 3),
    spacer(2),
    styledTable(
      [headerCell("PRODIGIO TECH", 50), headerCell(input.clientName.toUpperCase(), 50)],
      [
        new TableRow({
          children: [
            dataCell("Firma: ___________________________", 50),
            dataCell("Firma: ___________________________", 50),
          ],
        }),
        new TableRow({
          children: [
            dataCell(`Nombre: ${input.redactor}`, 50, true),
            dataCell("Nombre: ___________________", 50, true),
          ],
        }),
        new TableRow({
          children: [
            dataCell(`Cargo: ${input.redactorRole}`, 50),
            dataCell("Cargo: ___________________", 50),
          ],
        }),
        new TableRow({
          children: [
            dataCell("Fecha: ___________________", 50, true),
            dataCell("Fecha: ___________________", 50, true),
          ],
        }),
      ]
    ),
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ASSEMBLE DOCUMENT
  // ══════════════════════════════════════════════════════════════════════════
  const doc = new Document({
    creator: "Prodigio Tech PMO Platform",
    title: `SoW — ${input.projectName}`,
    description: `Statement of Work para ${input.clientName}`,
    features: {
      updateFields: true,
    },
    styles: {
      paragraphStyles: [
        {
          id: "TOC1",
          name: "toc 1",
          basedOn: "Normal",
          next: "Normal",
          paragraph: {
            spacing: { before: 120, after: 60 },
            indent: { left: 0 },
          },
          run: {
            bold: true,
            size: 22,
            color: DARK,
            font: "Calibri",
          },
        },
        {
          id: "TOC2",
          name: "toc 2",
          basedOn: "Normal",
          next: "Normal",
          paragraph: {
            spacing: { before: 40, after: 40 },
            indent: { left: convertInchesToTwip(0.3) },
          },
          run: {
            size: 20,
            color: "555555",
            font: "Calibri",
          },
        },
      ],
    },
    sections: [
      // Cover (no header/footer)
      coverSection as any,
      // Table of Contents
      tocSection as any,
      // Main document (with header/footer)
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1.2),
              bottom: convertInchesToTwip(1.0),
              left: convertInchesToTwip(1.2),
              right: convertInchesToTwip(1.2),
            },
          },
        },
        headers: { default: pageHeader },
        footers: { default: pageFooter },
        children,
      },
    ],
  });

  return (await Packer.toBuffer(doc)) as Buffer;
}
