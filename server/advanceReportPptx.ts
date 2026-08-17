import PptxGenJSModule from "pptxgenjs";
// pptxgenjs exports the class directly in CJS, handle both import styles
const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;
import type { JiraAdvanceReport } from "./jiraClient";

interface ReportContext {
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

// Color palette - professional and sober
const COLORS = {
  primary: "1a365d",    // Dark navy
  secondary: "2d3748",  // Dark gray
  accent: "0891b2",     // Teal
  success: "10b981",    // Green
  warning: "f59e0b",    // Amber
  danger: "ef4444",     // Red
  lightBg: "f8fafc",    // Light background
  white: "ffffff",
  black: "1a202c",
  muted: "64748b",      // Muted text
  border: "e2e8f0",     // Border
  headerBg: "0f172a",   // Very dark for headers
};

const FONT = "Segoe UI";

function addMasterSlide(pptx: any) {
  // No master needed - we'll style each slide individually
}

function addTitleSlide(pptx: any, ctx: ReportContext) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.headerBg };

  // Top accent line
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: COLORS.accent } });

  // Title
  slide.addText("Reporte de Avance PMO", {
    x: 0.8, y: 1.2, w: 8.4, h: 0.8,
    fontSize: 32, fontFace: FONT, color: COLORS.white, bold: true,
  });

  // Project name
  slide.addText(ctx.projectName, {
    x: 0.8, y: 2.1, w: 8.4, h: 0.6,
    fontSize: 22, fontFace: FONT, color: COLORS.accent,
  });

  // Deal ID
  if (ctx.dealId) {
    slide.addText(`Deal: ${ctx.dealId}`, {
      x: 0.8, y: 2.7, w: 8.4, h: 0.4,
      fontSize: 14, fontFace: FONT, color: COLORS.muted,
    });
  }

  // Date
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" });
  slide.addText(dateStr, {
    x: 0.8, y: 3.4, w: 8.4, h: 0.4,
    fontSize: 14, fontFace: FONT, color: COLORS.muted,
  });

  // Bottom bar
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 5.2, w: "100%", h: 0.3, fill: { color: COLORS.accent } });

  // Prodigio Tech
  slide.addText("Prodigio Tech", {
    x: 0.8, y: 4.6, w: 4, h: 0.4,
    fontSize: 12, fontFace: FONT, color: COLORS.muted, italic: true,
  });
}

function addExecutiveSummarySlide(pptx: any, ctx: ReportContext) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };

  // Header bar
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: COLORS.accent } });
  slide.addText("Resumen Ejecutivo", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 22, fontFace: FONT, color: COLORS.primary, bold: true,
  });

  const r = ctx.report;

  // Semaphore
  if (ctx.summary) {
    const semColor = ctx.summary.semaphore === "VERDE" ? COLORS.success : ctx.summary.semaphore === "AMARILLO" ? COLORS.warning : COLORS.danger;
    slide.addShape(pptx.ShapeType.ellipse, { x: 0.5, y: 0.9, w: 0.35, h: 0.35, fill: { color: semColor } });
    slide.addText(`Estado: ${ctx.summary.semaphore}`, {
      x: 1.0, y: 0.9, w: 3, h: 0.35,
      fontSize: 14, fontFace: FONT, color: semColor, bold: true,
    });
    slide.addText(ctx.summary.semaphoreDescription, {
      x: 4.0, y: 0.9, w: 5.5, h: 0.35,
      fontSize: 11, fontFace: FONT, color: COLORS.muted,
    });
  }

  // KPI cards row
  const kpis = [
    { label: "Total Issues", value: `${r.totalIssues}`, color: COLORS.primary },
    { label: "Finalizados", value: `${r.doneCount}`, color: COLORS.success },
    { label: "En Progreso", value: `${r.inProgressCount}`, color: COLORS.accent },
    { label: "Pendientes", value: `${r.toDoCount}`, color: COLORS.warning },
    { label: "Avance", value: `${r.percentComplete}%`, color: r.percentComplete >= 70 ? COLORS.success : r.percentComplete >= 40 ? COLORS.warning : COLORS.danger },
  ];

  kpis.forEach((kpi, i) => {
    const x = 0.3 + i * 1.88;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 1.5, w: 1.7, h: 1.0, fill: { color: COLORS.lightBg }, line: { color: COLORS.border, width: 1 }, rectRadius: 0.08 });
    slide.addText(kpi.value, { x, y: 1.55, w: 1.7, h: 0.5, fontSize: 24, fontFace: FONT, color: kpi.color, bold: true, align: "center" });
    slide.addText(kpi.label, { x, y: 2.05, w: 1.7, h: 0.35, fontSize: 10, fontFace: FONT, color: COLORS.muted, align: "center" });
  });

  // Summary text
  if (ctx.summary?.summary) {
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.3, y: 2.8, w: 9.4, h: 1.5, fill: { color: COLORS.lightBg }, line: { color: COLORS.border, width: 1 }, rectRadius: 0.08 });
    slide.addText(ctx.summary.summary, {
      x: 0.5, y: 2.9, w: 9.0, h: 1.3,
      fontSize: 11, fontFace: FONT, color: COLORS.secondary, lineSpacingMultiple: 1.3,
    });
  }

  // Footer
  slide.addText(`Actualizado: ${new Date(r.lastUpdated).toLocaleDateString("es-CL")}`, {
    x: 0.5, y: 5.0, w: 9, h: 0.3,
    fontSize: 9, fontFace: FONT, color: COLORS.muted, italic: true,
  });
}

function addDistributionSlide(pptx: any, ctx: ReportContext) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: COLORS.accent } });
  slide.addText("Distribución de Issues", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 22, fontFace: FONT, color: COLORS.primary, bold: true,
  });

  const r = ctx.report;

  // By Status - table
  slide.addText("Por Estado", { x: 0.5, y: 0.85, w: 4.5, h: 0.35, fontSize: 14, fontFace: FONT, color: COLORS.secondary, bold: true });

  const statusRows: any[] = [
    [
      { text: "Estado", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary }, align: "left" } },
      { text: "Cantidad", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary }, align: "center" } },
      { text: "%", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary }, align: "center" } },
    ],
  ];

  r.byStatus.forEach((s) => {
    statusRows.push([
      { text: s.status, options: { fontSize: 10, fontFace: FONT, color: COLORS.secondary } },
      { text: `${s.count}`, options: { fontSize: 10, fontFace: FONT, color: COLORS.secondary, align: "center" } },
      { text: `${s.percentage}%`, options: { fontSize: 10, fontFace: FONT, color: COLORS.secondary, align: "center" } },
    ]);
  });

  slide.addTable(statusRows, {
    x: 0.5, y: 1.25, w: 4.3,
    border: { type: "solid", pt: 0.5, color: COLORS.border },
    rowH: 0.3,
    colW: [2.0, 1.15, 1.15],
  });

  // By Type - table
  slide.addText("Por Tipo", { x: 5.3, y: 0.85, w: 4.5, h: 0.35, fontSize: 14, fontFace: FONT, color: COLORS.secondary, bold: true });

  const typeRows: any[] = [
    [
      { text: "Tipo", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary }, align: "left" } },
      { text: "Cantidad", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary }, align: "center" } },
    ],
  ];

  r.byType.forEach((t) => {
    typeRows.push([
      { text: t.type, options: { fontSize: 10, fontFace: FONT, color: COLORS.secondary } },
      { text: `${t.count}`, options: { fontSize: 10, fontFace: FONT, color: COLORS.secondary, align: "center" } },
    ]);
  });

  slide.addTable(typeRows, {
    x: 5.3, y: 1.25, w: 4.2,
    border: { type: "solid", pt: 0.5, color: COLORS.border },
    rowH: 0.3,
    colW: [2.8, 1.4],
  });

  // Progress bar visual
  const barY = 4.2;
  slide.addText("Avance General", { x: 0.5, y: barY - 0.4, w: 9, h: 0.35, fontSize: 14, fontFace: FONT, color: COLORS.secondary, bold: true });
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: barY, w: 9, h: 0.4, fill: { color: COLORS.border }, rectRadius: 0.1 });
  const pctWidth = Math.max(0.1, (r.percentComplete / 100) * 9);
  const pctColor = r.percentComplete >= 70 ? COLORS.success : r.percentComplete >= 40 ? COLORS.warning : COLORS.danger;
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: barY, w: pctWidth, h: 0.4, fill: { color: pctColor }, rectRadius: 0.1 });
  slide.addText(`${r.percentComplete}%`, { x: 0.5, y: barY, w: 9, h: 0.4, fontSize: 14, fontFace: FONT, color: COLORS.white, bold: true, align: "center" });
}

function addEpicsSlide(pptx: any, ctx: ReportContext) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: COLORS.accent } });
  slide.addText("Mapa de Épicas", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 22, fontFace: FONT, color: COLORS.primary, bold: true,
  });

  const r = ctx.report;

  if (r.epics.length === 0) {
    slide.addText("No se encontraron épicas en el proyecto JIRA.", {
      x: 0.5, y: 2, w: 9, h: 1,
      fontSize: 14, fontFace: FONT, color: COLORS.muted, align: "center",
    });
    return;
  }

  const epicRows: any[] = [
    [
      { text: "Key", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary } } },
      { text: "Épica", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary } } },
      { text: "Estado", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary }, align: "center" } },
    ],
  ];

  r.epics.forEach((e) => {
    const statusColor = e.statusCategory === "Done" ? COLORS.success : e.statusCategory === "In Progress" ? COLORS.accent : COLORS.warning;
    epicRows.push([
      { text: e.key, options: { fontSize: 10, fontFace: FONT, color: COLORS.accent, bold: true } },
      { text: e.summary, options: { fontSize: 10, fontFace: FONT, color: COLORS.secondary } },
      { text: e.status, options: { fontSize: 10, fontFace: FONT, color: statusColor, align: "center", bold: true } },
    ]);
  });

  slide.addTable(epicRows, {
    x: 0.5, y: 0.9, w: 9,
    border: { type: "solid", pt: 0.5, color: COLORS.border },
    rowH: 0.35,
    colW: [1.5, 5.5, 2.0],
  });
}

function addMilestonesAndRisksSlide(pptx: any, ctx: ReportContext) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: COLORS.accent } });
  slide.addText("Hitos del Proyecto y Riesgos", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 22, fontFace: FONT, color: COLORS.primary, bold: true,
  });

  const r = ctx.report;

  // Milestones
  slide.addText(`Hitos (${r.milestonesCumplidos} cumplidos / ${r.milestonesPendientes} pendientes)`, {
    x: 0.5, y: 0.85, w: 9, h: 0.35, fontSize: 14, fontFace: FONT, color: COLORS.secondary, bold: true,
  });

  if (r.milestones.length > 0) {
    const msRows: any[] = [
      [
        { text: "Key", options: { bold: true, fontSize: 9, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary } } },
        { text: "Hito", options: { bold: true, fontSize: 9, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary } } },
        { text: "%", options: { bold: true, fontSize: 9, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary }, align: "center" } },
        { text: "Estado", options: { bold: true, fontSize: 9, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary }, align: "center" } },
      ],
    ];

    r.milestones.forEach((m) => {
      const statusColor = m.statusCategory === "Done" ? COLORS.success : COLORS.warning;
      msRows.push([
        { text: m.key, options: { fontSize: 9, fontFace: FONT, color: COLORS.accent } },
        { text: m.summary, options: { fontSize: 9, fontFace: FONT, color: COLORS.secondary } },
        { text: m.percentage ? `${m.percentage}%` : "-", options: { fontSize: 9, fontFace: FONT, color: COLORS.secondary, align: "center" } },
        { text: m.status, options: { fontSize: 9, fontFace: FONT, color: statusColor, align: "center", bold: true } },
      ]);
    });

    slide.addTable(msRows, {
      x: 0.5, y: 1.25, w: 9,
      border: { type: "solid", pt: 0.5, color: COLORS.border },
      rowH: 0.3,
      colW: [1.2, 4.8, 1.0, 2.0],
    });
  }

  // Risks
  const risksY = 1.25 + Math.max(1, (r.milestones.length + 1) * 0.3) + 0.3;
  slide.addText(`Riesgos (${r.risks.filter(ri => ri.statusCategory === "Done").length} cerrados / ${r.risks.filter(ri => ri.statusCategory !== "Done").length} abiertos)`, {
    x: 0.5, y: risksY, w: 9, h: 0.35, fontSize: 14, fontFace: FONT, color: COLORS.secondary, bold: true,
  });

  if (r.risks.length > 0) {
    const riskRows: any[] = [
      [
        { text: "Key", options: { bold: true, fontSize: 9, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary } } },
        { text: "Riesgo", options: { bold: true, fontSize: 9, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary } } },
        { text: "Estado", options: { bold: true, fontSize: 9, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary }, align: "center" } },
      ],
    ];

    r.risks.slice(0, 8).forEach((ri) => {
      const statusColor = ri.statusCategory === "Done" ? COLORS.success : COLORS.warning;
      riskRows.push([
        { text: ri.key, options: { fontSize: 9, fontFace: FONT, color: COLORS.accent } },
        { text: ri.summary, options: { fontSize: 9, fontFace: FONT, color: COLORS.secondary } },
        { text: ri.status, options: { fontSize: 9, fontFace: FONT, color: statusColor, align: "center", bold: true } },
      ]);
    });

    slide.addTable(riskRows, {
      x: 0.5, y: risksY + 0.35, w: 9,
      border: { type: "solid", pt: 0.5, color: COLORS.border },
      rowH: 0.3,
      colW: [1.2, 5.8, 2.0],
    });
  }
}

function addTeamSlide(pptx: any, ctx: ReportContext) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: COLORS.accent } });
  slide.addText("Equipo y Contribuciones", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 22, fontFace: FONT, color: COLORS.primary, bold: true,
  });

  const r = ctx.report;

  if (r.team.length === 0) {
    slide.addText("No se encontraron asignaciones de equipo.", {
      x: 0.5, y: 2, w: 9, h: 1,
      fontSize: 14, fontFace: FONT, color: COLORS.muted, align: "center",
    });
    return;
  }

  const teamRows: any[] = [
    [
      { text: "Recurso", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary } } },
      { text: "Contribución", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary } } },
      { text: "Estado", options: { bold: true, fontSize: 10, fontFace: FONT, color: COLORS.white, fill: { color: COLORS.primary }, align: "center" } },
    ],
  ];

  r.team.slice(0, 12).forEach((t) => {
    const statusColor = t.status === "Completado" ? COLORS.success : t.status === "Trabajo activo" ? COLORS.accent : COLORS.warning;
    teamRows.push([
      { text: t.name, options: { fontSize: 10, fontFace: FONT, color: COLORS.secondary, bold: true } },
      { text: t.contribution, options: { fontSize: 9, fontFace: FONT, color: COLORS.secondary } },
      { text: t.status, options: { fontSize: 9, fontFace: FONT, color: statusColor, align: "center", bold: true } },
    ]);
  });

  slide.addTable(teamRows, {
    x: 0.5, y: 0.9, w: 9,
    border: { type: "solid", pt: 0.5, color: COLORS.border },
    rowH: 0.35,
    colW: [2.5, 4.5, 2.0],
  });
}

function addNextStepsSlide(pptx: any, ctx: ReportContext) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: COLORS.accent } });
  slide.addText("Próximos Pasos para Cierre", {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 22, fontFace: FONT, color: COLORS.primary, bold: true,
  });

  const steps = ctx.summary?.nextSteps || [];
  if (steps.length === 0) {
    slide.addText("Ejecute la generación de resumen ejecutivo para obtener los próximos pasos.", {
      x: 0.5, y: 2, w: 9, h: 1,
      fontSize: 14, fontFace: FONT, color: COLORS.muted, align: "center",
    });
    return;
  }

  steps.forEach((step, i) => {
    const y = 0.9 + i * 0.85;
    const priorityColor = step.priority === "URGENTE" ? COLORS.danger : step.priority === "ALTA" ? COLORS.warning : COLORS.accent;

    // Left border
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y, w: 0.08, h: 0.7, fill: { color: priorityColor } });

    // Card background
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.6, y, w: 8.9, h: 0.7, fill: { color: COLORS.lightBg }, line: { color: COLORS.border, width: 0.5 }, rectRadius: 0.05 });

    // Priority badge
    slide.addShape(pptx.ShapeType.roundRect, { x: 8.3, y: y + 0.1, w: 1.0, h: 0.25, fill: { color: priorityColor }, rectRadius: 0.1 });
    slide.addText(step.priority, { x: 8.3, y: y + 0.1, w: 1.0, h: 0.25, fontSize: 8, fontFace: FONT, color: COLORS.white, bold: true, align: "center" });

    // Title
    slide.addText(step.title, { x: 0.8, y: y + 0.05, w: 7.3, h: 0.3, fontSize: 12, fontFace: FONT, color: COLORS.secondary, bold: true });

    // Description
    slide.addText(step.description, { x: 0.8, y: y + 0.35, w: 7.3, h: 0.3, fontSize: 10, fontFace: FONT, color: COLORS.muted });
  });
}

function addClosingSlide(pptx: any, ctx: ReportContext) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.headerBg };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: COLORS.accent } });

  slide.addText("Gracias", {
    x: 0.5, y: 1.5, w: 9, h: 0.8,
    fontSize: 36, fontFace: FONT, color: COLORS.white, bold: true, align: "center",
  });

  slide.addText("Prodigio Tech", {
    x: 0.5, y: 2.5, w: 9, h: 0.5,
    fontSize: 18, fontFace: FONT, color: COLORS.accent, align: "center",
  });

  slide.addText(ctx.projectName, {
    x: 0.5, y: 3.2, w: 9, h: 0.4,
    fontSize: 14, fontFace: FONT, color: COLORS.muted, align: "center",
  });

  if (ctx.dealId) {
    slide.addText(`Deal: ${ctx.dealId}`, {
      x: 0.5, y: 3.6, w: 9, h: 0.3,
      fontSize: 12, fontFace: FONT, color: COLORS.muted, align: "center",
    });
  }

  const now = new Date();
  slide.addText(now.toLocaleDateString("es-CL", { year: "numeric", month: "long" }), {
    x: 0.5, y: 4.1, w: 9, h: 0.3,
    fontSize: 12, fontFace: FONT, color: COLORS.muted, align: "center",
  });

  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 5.2, w: "100%", h: 0.3, fill: { color: COLORS.accent } });
}

export async function generateAdvanceReportPptx(ctx: ReportContext): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Prodigio Tech PMO";
  pptx.company = "Prodigio Tech";
  pptx.title = `Reporte PMO - ${ctx.projectName}`;

  addTitleSlide(pptx, ctx);
  addExecutiveSummarySlide(pptx, ctx);
  addDistributionSlide(pptx, ctx);
  addEpicsSlide(pptx, ctx);
  addMilestonesAndRisksSlide(pptx, ctx);
  addTeamSlide(pptx, ctx);
  addNextStepsSlide(pptx, ctx);
  addClosingSlide(pptx, ctx);

  const output = await pptx.write({ outputType: "nodebuffer" });
  return output as Buffer;
}
