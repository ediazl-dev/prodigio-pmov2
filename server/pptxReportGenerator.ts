import PptxGenJSModule from "pptxgenjs";
const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

// ==================== TYPES ====================
export interface ReportData {
  projectName: string;
  clientName: string;
  dealNumber: string;
  jiraKey: string;
  date: string;
  // KPIs
  totalIssues: number;
  doneCount: number;
  inProgressCount: number;
  toDoCount: number;
  percentComplete: number;
  // Milestones
  milestones: Array<{ key: string; summary: string; status: string; statusCategory: string; percentage?: string }>;
  milestonesCumplidos: number;
  milestonesPendientes: number;
  // Epics
  epics: Array<{ key: string; summary: string; status: string; statusCategory: string; doneSubtasks: number; totalSubtasks: number }>;
  // Risks
  risks: Array<{ key: string; summary: string; status: string; statusCategory: string; priority: string }>;
  // Scope changes
  scopeChanges: Array<{ key: string; summary: string; status: string; statusCategory: string; priority: string }>;
  // Team
  team: Array<{ name: string; total: number; done: number; inProgress: number; contribution: string; status: string }>;
  // By status
  byStatus: Array<{ status: string; count: number; percentage: number; color: string }>;
  // By type
  byType: Array<{ type: string; count: number }>;
}

interface AIContent {
  estadoGeneral: string;
  semaforo: "VERDE" | "AMARILLO" | "ROJO";
  semJustificacion: string;
  proximosPasos: Array<{ titulo: string; descripcion: string; prioridad: "URGENTE" | "ALTA" | "MEDIA" }>;
}

// ==================== COLORS ====================
const C = {
  navy: "1B2A4A",
  navyDark: "0F1B33",
  pink: "E91E8C",
  white: "FFFFFF",
  lightGray: "F5F5F5",
  gray: "6B7280",
  green: "22C55E",
  greenBg: "DCFCE7",
  blue: "3B82F6",
  blueBg: "DBEAFE",
  orange: "F59E0B",
  orangeBg: "FEF3C7",
  red: "EF4444",
  redBg: "FEE2E2",
  teal: "14B8A6",
  tealBg: "CCFBF1",
};

// ==================== HELPERS ====================
function addFooter(slide: any, projectName: string, pageNum: number) {
  slide.addText(`PRODIG.IO  |  Reporte PMO ${projectName}`, {
    x: 0.8, y: 7.0, w: 7, h: 0.35,
    fontSize: 8, color: C.gray, fontFace: "Arial",
  });
  slide.addText(`${pageNum}`, {
    x: 12.0, y: 7.0, w: 0.5, h: 0.35,
    fontSize: 8, color: C.gray, fontFace: "Arial", align: "right",
  });
  // Top pink bar
  slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: C.pink } });
}

function getSemColor(sem: string): string {
  if (sem === "VERDE") return C.green;
  if (sem === "AMARILLO") return C.orange;
  return C.red;
}

function getPrioColor(prio: string): string {
  if (prio === "URGENTE") return C.red;
  if (prio === "ALTA") return C.orange;
  return C.blue;
}

function isDone(statusCategory: string): boolean {
  return statusCategory === "Done" || statusCategory === "done";
}

// ==================== AI CONTENT GENERATION ====================
async function generateAIContent(data: ReportData): Promise<AIContent> {
  const prompt = `Eres un gerente de proyectos senior (PMO) de Prodigio Tech. Genera contenido para un reporte de estado del proyecto.

DATOS DEL PROYECTO:
- Nombre: ${data.projectName} - ${data.clientName} (Deal ${data.dealNumber})
- JIRA Key: ${data.jiraKey}
- Issues: ${data.totalIssues} totales, ${data.doneCount} finalizados (${data.percentComplete}%)
- Hitos: ${data.milestonesCumplidos} cumplidos, ${data.milestonesPendientes} pendientes
- Épicas: ${data.epics.length} totales, ${data.epics.filter(e => isDone(e.statusCategory)).length} finalizadas
- Riesgos: ${data.risks.length} registrados, ${data.risks.filter(r => isDone(r.statusCategory)).length} cerrados
- Cambios de alcance: ${data.scopeChanges.length}
- Equipo: ${data.team.length} personas

ÉPICAS:
${data.epics.map(e => `- ${e.summary}: ${e.status} (${e.doneSubtasks}/${e.totalSubtasks} subtareas)`).join("\n")}

HITOS:
${data.milestones.map(m => `- ${m.summary}: ${m.status} (${m.percentage || "N/A"})`).join("\n")}

RIESGOS:
${data.risks.map(r => `- ${r.summary}: ${r.status} (${r.priority})`).join("\n")}

Genera un JSON con:
1. "estadoGeneral": Párrafo de 3-4 oraciones describiendo el estado general del proyecto para el cliente. Menciona % avance, hitos, épicas y riesgos.
2. "semaforo": "VERDE" si avance >80% y sin riesgos abiertos, "AMARILLO" si hay riesgos o retrasos moderados, "ROJO" si hay problemas graves.
3. "semJustificacion": Una oración justificando el semáforo.
4. "proximosPasos": Array de 3-5 próximos pasos con "titulo", "descripcion" (1-2 oraciones) y "prioridad" (URGENTE/ALTA/MEDIA).

Responde SOLO con JSON válido.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Eres un PMO senior. Responde exclusivamente en JSON válido." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "report_content",
          strict: true,
          schema: {
            type: "object",
            properties: {
              estadoGeneral: { type: "string" },
              semaforo: { type: "string", enum: ["VERDE", "AMARILLO", "ROJO"] },
              semJustificacion: { type: "string" },
              proximosPasos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    titulo: { type: "string" },
                    descripcion: { type: "string" },
                    prioridad: { type: "string", enum: ["URGENTE", "ALTA", "MEDIA"] },
                  },
                  required: ["titulo", "descripcion", "prioridad"],
                  additionalProperties: false,
                },
              },
            },
            required: ["estadoGeneral", "semaforo", "semJustificacion", "proximosPasos"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("No LLM content");
    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    return JSON.parse(contentStr);
  } catch (e) {
    console.error("AI content generation failed:", e);
    return {
      estadoGeneral: `El proyecto ${data.projectName} presenta un avance del ${data.percentComplete}% con ${data.doneCount} de ${data.totalIssues} issues completados. Se han cumplido ${data.milestonesCumplidos} hitos y quedan ${data.milestonesPendientes} pendientes.`,
      semaforo: data.percentComplete >= 80 ? "VERDE" : data.percentComplete >= 50 ? "AMARILLO" : "ROJO",
      semJustificacion: `Avance del ${data.percentComplete}% con ${data.milestonesPendientes} hitos pendientes.`,
      proximosPasos: [
        { titulo: "Revisar issues pendientes", descripcion: "Priorizar y asignar las tareas restantes del proyecto.", prioridad: "ALTA" as const },
        { titulo: "Seguimiento de hitos", descripcion: "Verificar el cumplimiento de los hitos pendientes.", prioridad: "ALTA" as const },
        { titulo: "Actualizar riesgos", descripcion: "Revisar y actualizar el estado de los riesgos del proyecto.", prioridad: "MEDIA" as const },
      ],
    };
  }
}

// ==================== SLIDE BUILDERS ====================

function buildSlide1_Cover(pptx: any, data: ReportData) {
  const slide = pptx.addSlide();
  slide.background = { color: C.navyDark };
  // Top pink bar
  slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: C.pink } });

  // Title
  slide.addText("REPORTE DE ESTADO", {
    x: 1, y: 2.8, w: 11.33, h: 0.8,
    fontSize: 36, color: C.white, fontFace: "Arial", bold: true,
    align: "center", charSpacing: 8,
  });

  // Project name
  slide.addText(`${data.projectName} — ${data.clientName}`, {
    x: 1, y: 3.7, w: 11.33, h: 0.6,
    fontSize: 20, color: C.pink, fontFace: "Arial",
    align: "center",
  });

  // Deal and JIRA key
  slide.addText(`Deal ${data.dealNumber}  |  Proyecto ${data.jiraKey}`, {
    x: 1, y: 4.3, w: 11.33, h: 0.5,
    fontSize: 13, color: C.gray, fontFace: "Arial",
    align: "center",
  });

  // Date
  slide.addText(`Fecha: ${data.date}`, {
    x: 1, y: 4.9, w: 11.33, h: 0.4,
    fontSize: 12, color: C.gray, fontFace: "Arial",
    align: "center",
  });

  // Bottom pink bar
  slide.addShape("rect", { x: 3, y: 5.5, w: 7.33, h: 0.04, fill: { color: C.pink } });
  // Footer bar
  slide.addShape("rect", { x: 0, y: 7.44, w: 13.33, h: 0.06, fill: { color: C.pink } });
}

function buildSlide2_ExecutiveSummary(pptx: any, data: ReportData, ai: AIContent) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addFooter(slide, data.clientName, 2);

  // Title
  slide.addText([{ text: "📈 ", options: { fontSize: 22 } }, { text: "RESUMEN EJECUTIVO", options: { fontSize: 22, bold: true, color: C.navy } }], {
    x: 0.5, y: 0.3, w: 12, h: 0.6, fontFace: "Arial",
  });

  // 4 KPI boxes
  const kpis = [
    { value: `${data.totalIssues}`, label: "Issues\nTotales", barColor: C.blue },
    { value: `${data.percentComplete}%`, label: "Finalizados\no Cerrados", barColor: C.green },
    { value: `${data.milestonesCumplidos}`, label: "Hitos\nCumplidos", barColor: C.teal },
    { value: `${data.milestonesPendientes}`, label: "Hitos\nPendientes", barColor: C.orange },
  ];

  kpis.forEach((kpi, i) => {
    const x = 0.5 + i * 3.1;
    // Color bar on top
    slide.addShape("rect", { x, y: 1.1, w: 2.8, h: 0.06, fill: { color: kpi.barColor } });
    // Card bg
    slide.addShape("rect", { x, y: 1.16, w: 2.8, h: 1.3, fill: { color: C.lightGray }, rectRadius: 0.05 });
    // Value
    slide.addText(kpi.value, {
      x, y: 1.2, w: 2.8, h: 0.7,
      fontSize: 28, color: kpi.barColor, fontFace: "Arial", bold: true, align: "center",
    });
    // Label
    slide.addText(kpi.label, {
      x, y: 1.85, w: 2.8, h: 0.55,
      fontSize: 10, color: C.gray, fontFace: "Arial", align: "center",
    });
  });

  // Estado General box
  slide.addShape("rect", { x: 0.5, y: 2.8, w: 12.33, h: 0.04, fill: { color: C.lightGray } });
  slide.addText("Estado General del Proyecto", {
    x: 0.6, y: 3.0, w: 12, h: 0.4,
    fontSize: 14, color: C.navy, fontFace: "Arial", bold: true,
  });
  slide.addText(ai.estadoGeneral, {
    x: 0.6, y: 3.4, w: 12, h: 2.0,
    fontSize: 11, color: "333333", fontFace: "Arial",
    paraSpaceAfter: 6, lineSpacingMultiple: 1.3,
  });

  // Semáforo
  const semColor = getSemColor(ai.semaforo);
  slide.addText(`Semáforo general: `, {
    x: 0.6, y: 5.5, w: 2.2, h: 0.4,
    fontSize: 11, color: C.navy, fontFace: "Arial", bold: true,
  });
  slide.addText(`${ai.semaforo} — ${ai.semJustificacion}`, {
    x: 2.8, y: 5.5, w: 9.8, h: 0.4,
    fontSize: 11, color: semColor, fontFace: "Arial",
  });
}

function buildSlide3_Distribution(pptx: any, data: ReportData) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addFooter(slide, data.clientName, 3);

  slide.addText([{ text: "⚙️ ", options: { fontSize: 22 } }, { text: "DISTRIBUCIÓN DE ISSUES", options: { fontSize: 22, bold: true, color: C.navy } }], {
    x: 0.5, y: 0.3, w: 12, h: 0.6, fontFace: "Arial",
  });

  // Left: By Status - use a table to simulate the donut chart data
  slide.addText("Por Estado", {
    x: 0.5, y: 1.1, w: 5.5, h: 0.4,
    fontSize: 14, color: C.navy, fontFace: "Arial", bold: true,
  });

  const statusRows: any[][] = [];
  data.byStatus.forEach(s => {
    statusRows.push([
      { text: "●", options: { fontSize: 12, color: s.color.replace("#", ""), align: "center" } },
      { text: s.status, options: { fontSize: 11, color: "333333" } },
      { text: `${s.count}`, options: { fontSize: 11, color: C.navy, bold: true, align: "right" } },
      { text: `${s.percentage}%`, options: { fontSize: 11, color: C.gray, align: "right" } },
    ]);
  });

  if (statusRows.length > 0) {
    slide.addTable(statusRows, {
      x: 0.5, y: 1.6, w: 5.5,
      colW: [0.5, 2.5, 1.0, 1.0],
      fontSize: 11, fontFace: "Arial",
      border: { type: "none" },
      rowH: 0.35,
    });
  }

  // Right: By Type
  slide.addText("Por Tipo de Issue", {
    x: 7, y: 1.1, w: 5.5, h: 0.4,
    fontSize: 14, color: C.navy, fontFace: "Arial", bold: true,
  });

  const typeRows: any[][] = [];
  data.byType.slice(0, 10).forEach(t => {
    typeRows.push([
      { text: t.type, options: { fontSize: 10, color: "333333" } },
      { text: `${t.count}`, options: { fontSize: 10, color: C.navy, bold: true, align: "center" } },
    ]);
  });

  if (typeRows.length > 0) {
    // Use horizontal bars via shapes
    const maxCount = Math.max(...data.byType.map(t => t.count), 1);
    data.byType.slice(0, 10).forEach((t, i) => {
      const y = 1.6 + i * 0.45;
      slide.addText(t.type, {
        x: 7, y, w: 2, h: 0.35,
        fontSize: 10, color: "333333", fontFace: "Arial", valign: "middle",
      });
      // Bar
      const barW = Math.max((t.count / maxCount) * 3.5, 0.15);
      slide.addShape("rect", {
        x: 9.2, y: y + 0.05, w: barW, h: 0.25,
        fill: { color: C.pink }, rectRadius: 0.03,
      });
      // Count label
      slide.addText(`${t.count}`, {
        x: 9.2 + barW + 0.1, y, w: 0.6, h: 0.35,
        fontSize: 10, color: C.navy, fontFace: "Arial", bold: true, valign: "middle",
      });
    });
  }
}

function buildSlide4_Epics(pptx: any, data: ReportData) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addFooter(slide, data.clientName, 4);

  const doneEpics = data.epics.filter(e => isDone(e.statusCategory));
  const pendingEpics = data.epics.filter(e => !isDone(e.statusCategory));
  const allDone = pendingEpics.length === 0;

  slide.addText([
    { text: "🗄️ ", options: { fontSize: 22 } },
    { text: `MAPA DE ÉPICAS${allDone ? " — TODAS FINALIZADAS" : ""}`, options: { fontSize: 22, bold: true, color: C.navy } },
  ], {
    x: 0.5, y: 0.3, w: 12, h: 0.6, fontFace: "Arial",
  });

  // Split epics into 2 columns
  const half = Math.ceil(data.epics.length / 2);
  const col1 = data.epics.slice(0, half);
  const col2 = data.epics.slice(half);

  [col1, col2].forEach((col, colIdx) => {
    const xBase = colIdx === 0 ? 0.5 : 6.8;
    col.forEach((epic, i) => {
      const y = 1.2 + i * 0.5;
      const done = isDone(epic.statusCategory);
      // Row bg
      slide.addShape("rect", {
        x: xBase, y, w: 5.8, h: 0.42,
        fill: { color: C.lightGray }, rectRadius: 0.04,
      });
      // Check icon
      slide.addText(done ? "✅" : "🔄", {
        x: xBase + 0.1, y, w: 0.4, h: 0.42,
        fontSize: 12, valign: "middle",
      });
      // Epic name
      const label = epic.summary.length > 45 ? epic.summary.slice(0, 45) + "…" : epic.summary;
      slide.addText(label, {
        x: xBase + 0.55, y, w: 4.5, h: 0.42,
        fontSize: 9.5, color: "333333", fontFace: "Arial", valign: "middle",
      });
      // Subtask count
      slide.addText(`${epic.doneSubtasks}/${epic.totalSubtasks}`, {
        x: xBase + 5.0, y, w: 0.7, h: 0.42,
        fontSize: 8, color: C.gray, fontFace: "Arial", valign: "middle", align: "right",
      });
    });
  });
}

function buildSlide5_MilestonesRisks(pptx: any, data: ReportData) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addFooter(slide, data.clientName, 5);

  slide.addText([{ text: "🚩 ", options: { fontSize: 22 } }, { text: "HITOS Y RIESGOS", options: { fontSize: 22, bold: true, color: C.navy } }], {
    x: 0.5, y: 0.3, w: 12, h: 0.6, fontFace: "Arial",
  });

  // Left: Milestones
  slide.addText("Hitos del Proyecto", {
    x: 0.5, y: 1.1, w: 5.5, h: 0.4,
    fontSize: 14, color: C.navy, fontFace: "Arial", bold: true,
  });

  data.milestones.forEach((m, i) => {
    const y = 1.6 + i * 1.0;
    const done = isDone(m.statusCategory);
    // Card bg
    slide.addShape("rect", {
      x: 0.5, y, w: 5.8, h: 0.85,
      fill: { color: C.lightGray }, rectRadius: 0.05,
    });
    // Icon
    slide.addText(done ? "✅" : "🕐", {
      x: 0.7, y: y + 0.1, w: 0.5, h: 0.5,
      fontSize: 18,
    });
    // Text
    const pct = m.percentage ? `${m.percentage}: ` : "";
    slide.addText(`${pct}${m.summary}`, {
      x: 1.3, y: y + 0.05, w: 4.8, h: 0.4,
      fontSize: 10, color: C.navy, fontFace: "Arial", bold: true,
    });
    slide.addText(`Estado: ${done ? "CUMPLIDO" : "PENDIENTE"}`, {
      x: 1.3, y: y + 0.42, w: 4.8, h: 0.35,
      fontSize: 9, color: done ? C.green : C.orange, fontFace: "Arial", bold: true,
    });
  });

  // Right: Risks
  const allRisksClosed = data.risks.every(r => isDone(r.statusCategory));
  slide.addText(`Riesgos${allRisksClosed ? " (Todos Cerrados)" : ""}`, {
    x: 7, y: 1.1, w: 5.5, h: 0.4,
    fontSize: 14, color: C.navy, fontFace: "Arial", bold: true,
  });

  data.risks.slice(0, 6).forEach((r, i) => {
    const y = 1.6 + i * 0.7;
    const done = isDone(r.statusCategory);
    slide.addShape("rect", {
      x: 7, y, w: 5.8, h: 0.55,
      fill: { color: C.lightGray }, rectRadius: 0.04,
    });
    slide.addText(done ? "🛡️" : "⚠️", {
      x: 7.15, y, w: 0.4, h: 0.55,
      fontSize: 14, valign: "middle",
    });
    const rLabel = r.summary.length > 50 ? r.summary.slice(0, 50) + "…" : r.summary;
    slide.addText(`R${i + 1}: ${rLabel}`, {
      x: 7.6, y, w: 5.0, h: 0.55,
      fontSize: 9.5, color: "333333", fontFace: "Arial", valign: "middle",
    });
  });

  if (data.risks.length === 0) {
    slide.addText("No hay riesgos registrados en el proyecto.", {
      x: 7, y: 1.7, w: 5.5, h: 0.4,
      fontSize: 10, color: C.gray, fontFace: "Arial", italic: true,
    });
  }

  // Scope changes note
  if (data.scopeChanges.length > 0) {
    const sc = data.scopeChanges[0];
    slide.addShape("rect", {
      x: 0.5, y: 6.2, w: 5.8, h: 0.6,
      fill: { color: "FEF9C3" }, rectRadius: 0.04,
    });
    slide.addText(`Cambio de Alcance (${sc.key}): ${sc.status} — Prioridad ${sc.priority}`, {
      x: 0.7, y: 6.2, w: 5.4, h: 0.6,
      fontSize: 9, color: C.red, fontFace: "Arial", bold: true, valign: "middle",
    });
  }
}

function buildSlide6_Team(pptx: any, data: ReportData) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addFooter(slide, data.clientName, 6);

  slide.addText([{ text: "👥 ", options: { fontSize: 22 } }, { text: "EQUIPO Y CONTRIBUCIONES", options: { fontSize: 22, bold: true, color: C.navy } }], {
    x: 0.5, y: 0.3, w: 12, h: 0.6, fontFace: "Arial",
  });

  // Table header
  const headerRow = [
    { text: "Recurso", options: { fontSize: 10, color: C.white, bold: true, fill: { color: C.navy } } },
    { text: "Rol", options: { fontSize: 10, color: C.white, bold: true, fill: { color: C.navy } } },
    { text: "Contribución", options: { fontSize: 10, color: C.white, bold: true, fill: { color: C.navy } } },
    { text: "Estado", options: { fontSize: 10, color: C.white, bold: true, fill: { color: C.navy } } },
  ];

  const rows: any[][] = [headerRow];
  data.team.slice(0, 10).forEach(member => {
    const statusColor = member.status === "Completado" ? C.green : member.status === "Trabajo activo" ? C.orange : C.gray;
    rows.push([
      { text: member.name, options: { fontSize: 9, color: "333333" } },
      { text: member.contribution.split("—")[0]?.trim() || "Equipo", options: { fontSize: 9, color: C.gray } },
      { text: `${member.total} issues — ${member.contribution}`, options: { fontSize: 9, color: "333333" } },
      { text: member.status, options: { fontSize: 9, color: statusColor, bold: true } },
    ]);
  });

  slide.addTable(rows, {
    x: 0.5, y: 1.1, w: 12.33,
    colW: [2.5, 2.5, 5.0, 2.33],
    fontSize: 9, fontFace: "Arial",
    border: { pt: 0.5, color: "E5E7EB" },
    rowH: 0.5,
    autoPage: false,
  });
}

function buildSlide7_NextSteps(pptx: any, data: ReportData, ai: AIContent) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  addFooter(slide, data.clientName, 7);

  slide.addText([{ text: "🚀 ", options: { fontSize: 22 } }, { text: "PRÓXIMOS PASOS", options: { fontSize: 22, bold: true, color: C.navy } }], {
    x: 0.5, y: 0.3, w: 12, h: 0.6, fontFace: "Arial",
  });

  ai.proximosPasos.slice(0, 5).forEach((paso, i) => {
    const y = 1.1 + i * 1.1;
    const prioColor = getPrioColor(paso.prioridad);

    // Left color bar
    slide.addShape("rect", {
      x: 0.5, y, w: 0.08, h: 0.9,
      fill: { color: prioColor },
    });
    // Card bg
    slide.addShape("rect", {
      x: 0.58, y, w: 10.5, h: 0.9,
      fill: { color: C.lightGray }, rectRadius: 0.04,
    });
    // Title
    slide.addText(paso.titulo, {
      x: 0.8, y: y + 0.05, w: 9.5, h: 0.35,
      fontSize: 11, color: C.navy, fontFace: "Arial", bold: true,
    });
    // Description
    slide.addText(paso.descripcion, {
      x: 0.8, y: y + 0.4, w: 9.5, h: 0.45,
      fontSize: 9.5, color: "555555", fontFace: "Arial",
    });
    // Priority badge
    slide.addShape("roundRect", {
      x: 11.3, y: y + 0.2, w: 1.3, h: 0.4,
      fill: { color: prioColor }, rectRadius: 0.1,
    });
    slide.addText(paso.prioridad, {
      x: 11.3, y: y + 0.2, w: 1.3, h: 0.4,
      fontSize: 9, color: C.white, fontFace: "Arial", bold: true, align: "center", valign: "middle",
    });
  });
}

function buildSlide8_Closing(pptx: any, data: ReportData) {
  const slide = pptx.addSlide();
  slide.background = { color: C.navyDark };

  // GRACIAS
  slide.addText("GRACIAS", {
    x: 1, y: 2.5, w: 11.33, h: 1,
    fontSize: 44, color: C.white, fontFace: "Arial", bold: true,
    align: "center", charSpacing: 10,
  });

  // Project name
  slide.addText(`${data.projectName} — ${data.clientName}  |  Deal ${data.dealNumber}`, {
    x: 1, y: 3.6, w: 11.33, h: 0.5,
    fontSize: 16, color: C.pink, fontFace: "Arial",
    align: "center",
  });

  // Footer
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const now = new Date();
  slide.addText(`Prodigio  •  Reporte PMO  •  ${monthNames[now.getMonth()]} ${now.getFullYear()}`, {
    x: 1, y: 4.3, w: 11.33, h: 0.4,
    fontSize: 11, color: C.gray, fontFace: "Arial",
    align: "center",
  });

  // Bottom pink bar
  slide.addShape("rect", { x: 0, y: 7.44, w: 13.33, h: 0.06, fill: { color: C.pink } });
}

// ==================== MAIN GENERATOR ====================
export async function generateStatusReportPptx(data: ReportData): Promise<{ url: string; filename: string }> {
  // Generate AI content
  const ai = await generateAIContent(data);

  // Create presentation
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pptx.author = "Prodigio Tech PMO";
  pptx.company = "Prodigio Tech";
  pptx.title = `Reporte PMO ${data.projectName} ${data.clientName}`;

  // Build all 8 slides
  buildSlide1_Cover(pptx, data);
  buildSlide2_ExecutiveSummary(pptx, data, ai);
  buildSlide3_Distribution(pptx, data);
  buildSlide4_Epics(pptx, data);
  buildSlide5_MilestonesRisks(pptx, data);
  buildSlide6_Team(pptx, data);
  buildSlide7_NextSteps(pptx, data, ai);
  buildSlide8_Closing(pptx, data);

  // Generate PPTX buffer
  const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;

  // Build filename: Reporte PMP Proyecto_cliente_DealXXX_DDMMAAAA.pptx
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const filename = `Reporte_PMO_${data.clientName.replace(/\s+/g, "")}_${data.projectName.replace(/\s+/g, "")}_Deal${data.dealNumber}_${dd}${mm}${yyyy}.pptx`;

  // Upload to S3
  const fileKey = `reports/${filename}`;
  const { url } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");

  return { url, filename };
}
