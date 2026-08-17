import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { JiraAdvanceReport } from "./jiraClient";

export interface AdvanceReportDocxContext {
  projectName: string;
  dealId?: string;
  report: JiraAdvanceReport;
  summary?: {
    summary: string;
    semaphore: string;
    semaphoreDescription: string;
    nextSteps: Array<{ title: string; description: string; priority: string }>;
  };
}

const BRAND = "E91E8C";
const NAVY = "1F2937";
const MUTED = "64748B";

function paragraph(text: string, options: { bold?: boolean; color?: string; size?: number } = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: "Poppins", size: options.size ?? 20, bold: options.bold, color: options.color ?? NAVY })],
  });
}

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    border: { bottom: { color: BRAND, space: 4, style: "single", size: 8 } },
    children: [new TextRun({ text, font: "Poppins", bold: true, color: BRAND, size: 26 })],
  });
}

function cell(text: string, header = false) {
  return new TableCell({
    shading: header ? { fill: BRAND } : undefined,
    margins: { top: 90, bottom: 90, left: 100, right: 100 },
    children: [new Paragraph({
      children: [new TextRun({ text: String(text), font: "Poppins", bold: header, color: header ? "FFFFFF" : NAVY, size: 18 })],
    })],
  });
}

function table(headers: string[], rows: Array<Array<string | number>>) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((item) => cell(item, true)) }),
      ...rows.map((row) => new TableRow({ children: row.map((item) => cell(String(item))) })),
    ],
  });
}

/** Genera una versión DOCX del reporte de avance sincronizado desde Jira. */
export async function generateAdvanceReportDocx(ctx: AdvanceReportDocxContext): Promise<Buffer> {
  const report = ctx.report;
  const date = new Date().toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" });
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 120 },
      children: [new TextRun({ text: "PRODIGIO", font: "Poppins", bold: true, color: BRAND, size: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "Reporte de Avance PMO", font: "Poppins", bold: true, color: NAVY, size: 32 })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: ctx.projectName, font: "Poppins", color: NAVY, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [new TextRun({ text: `${ctx.dealId ? `Deal ${ctx.dealId} · ` : ""}${date}`, font: "Poppins", color: MUTED, size: 18 })] }),
    heading("Resumen ejecutivo"),
    paragraph(ctx.summary?.summary || "Reporte consolidado de avance basado en la sincronización vigente con Jira."),
    ctx.summary ? paragraph(`Estado: ${ctx.summary.semaphore}. ${ctx.summary.semaphoreDescription}`, { bold: true, color: BRAND }) : paragraph("Estado: Sin semáforo ejecutivo generado."),
    heading("Indicadores de avance"),
    table(["Total", "Finalizados", "En progreso", "Pendientes", "Avance"], [[report.totalIssues, report.doneCount, report.inProgressCount, report.toDoCount, `${report.percentComplete}%`]]),
    heading("Distribución por estado"),
    table(["Estado", "Cantidad", "%"], (report.byStatus || []).map((item) => [item.status, item.count, `${item.percentage}%`])),
    heading("Hitos y riesgos"),
    paragraph(`Hitos: ${report.milestonesCumplidos} cumplidos y ${report.milestonesPendientes} pendientes.`),
    table(["Hito", "Estado", "%"], (report.milestones || []).slice(0, 12).map((item) => [item.summary, item.status, item.percentage ? `${item.percentage}%` : "—"])),
    paragraph(`Riesgos abiertos: ${(report.risks || []).filter((item) => item.statusCategory !== "Done").length}.`, { bold: true }),
    table(["Riesgo", "Estado"], (report.risks || []).slice(0, 12).map((item) => [item.summary, item.status])),
  ];

  if (ctx.summary?.nextSteps?.length) {
    children.push(heading("Próximos pasos"));
    children.push(table(["Prioridad", "Acción", "Descripción"], ctx.summary.nextSteps.map((item) => [item.priority, item.title, item.description])));
  }

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 320 }, children: [new TextRun({ text: "Prodigio · Gestión de Proyectos", font: "Poppins", color: MUTED, size: 16, italics: true })] }));

  const document = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(document));
}
