/**
 * ganttBacklogExcel.ts
 * Genera un archivo Excel con el backlog ágil (Épica/Story/Task) con estilos corporativos Prodigio.
 */
import ExcelJS from "exceljs";

export interface BacklogItem {
  id: number;
  issueLevel: "epic" | "story" | "task" | "milestone";
  taskCode: string | null;
  taskName: string;
  epicCode: string | null;
  storyCode: string | null;
  storyPoints: number | null;
  acceptanceCriteria: string | null;
  assignee: string | null;
  phase: string;
  startDate?: string | null;
  endDate?: string | null;
  duration?: string | null;
}

const COLORS = {
  headerBg: "E91E8C",
  headerFg: "FFFFFF",
  epicBg: "5C2D91",
  epicFg: "FFFFFF",
  storyBg: "EDE7F6",
  storyFg: "3D3D3D",
  taskBg: "FFFFFF",
  taskFg: "212121",
  taskAltBg: "F8F8F8",
  milestoneBg: "FFF9C4",
  milestoneFg: "E65100",
  border: "CCCCCC",
};

function argbColor(hex: string) {
  return `FF${hex.toUpperCase()}`;
}

export async function generateBacklogExcel(
  projectName: string,
  items: BacklogItem[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Prodigio Tech PMO Platform";
  wb.created = new Date();

  const ws = wb.addWorksheet("Backlog Ágil", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  // ── Title row ────────────────────────────────────────────────────────────────
  ws.mergeCells("A1:J1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `PRODIGIO TECH — BACKLOG ÁGIL: ${projectName.toUpperCase()}`;
  titleCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: argbColor(COLORS.headerFg) } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argbColor(COLORS.headerBg) } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // ── Subtitle ─────────────────────────────────────────────────────────────────
  ws.mergeCells("A2:J2");
  const subCell = ws.getCell("A2");
  subCell.value = `Generado: ${new Date().toLocaleDateString("es-CL")} | Total items: ${items.length}`;
  subCell.font = { name: "Calibri", italic: true, size: 9, color: { argb: "FF555555" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
  subCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 18;

  // ── Column headers ────────────────────────────────────────────────────────────
  const headers = [
    { key: "code", header: "Código", width: 12 },
    { key: "level", header: "Nivel", width: 10 },
    { key: "name", header: "Nombre", width: 50 },
    { key: "phase", header: "Fase", width: 20 },
    { key: "sp", header: "Story Points", width: 13 },
    { key: "assignee", header: "Responsable", width: 20 },
    { key: "start", header: "Inicio", width: 13 },
    { key: "end", header: "Fin", width: 13 },
    { key: "duration", header: "Duración", width: 12 },
    { key: "criteria", header: "Criterios de Aceptación", width: 45 },
  ];

  const headerRow = ws.getRow(3);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h.header;
    cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: argbColor(COLORS.headerFg) } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argbColor(COLORS.headerBg) } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: argbColor(COLORS.border) } },
      bottom: { style: "thin", color: { argb: argbColor(COLORS.border) } },
      left: { style: "thin", color: { argb: argbColor(COLORS.border) } },
      right: { style: "thin", color: { argb: argbColor(COLORS.border) } },
    };
    ws.getColumn(idx + 1).width = h.width;
  });
  headerRow.height = 20;

  // ── Data rows ─────────────────────────────────────────────────────────────────
  items.forEach((item, rowIdx) => {
    const row = ws.getRow(4 + rowIdx);

    let bgHex: string;
    let fgHex: string;
    let bold = false;
    let indent = 0;

    switch (item.issueLevel) {
      case "epic":
        bgHex = COLORS.epicBg; fgHex = COLORS.epicFg; bold = true; indent = 0;
        break;
      case "story":
        bgHex = COLORS.storyBg; fgHex = COLORS.storyFg; bold = false; indent = 1;
        break;
      case "milestone":
        bgHex = COLORS.milestoneBg; fgHex = COLORS.milestoneFg; bold = true; indent = 0;
        break;
      default:
        bgHex = rowIdx % 2 === 0 ? COLORS.taskBg : COLORS.taskAltBg;
        fgHex = COLORS.taskFg; bold = false; indent = 2;
    }

    const levelLabel = item.issueLevel === "epic" ? "ÉPICA"
      : item.issueLevel === "story" ? "HISTORIA"
      : item.issueLevel === "milestone" ? "HITO"
      : "TAREA";

    const code = item.taskCode || (item.issueLevel === "epic" ? item.epicCode : item.storyCode) || "";
    const nameIndented = "  ".repeat(indent) + item.taskName;

    const values = [
      code,
      levelLabel,
      nameIndented,
      item.phase,
      item.storyPoints ?? "",
      item.assignee ?? "",
      item.startDate ?? "",
      item.endDate ?? "",
      item.duration ?? "",
      item.acceptanceCriteria ?? "",
    ];

    values.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: "Calibri", bold, size: 9, color: { argb: argbColor(fgHex) } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argbColor(bgHex) } };
      cell.alignment = {
        horizontal: colIdx === 2 || colIdx === 9 ? "left" : "center",
        vertical: "middle",
        wrapText: colIdx === 9,
      };
      cell.border = {
        top: { style: "thin", color: { argb: argbColor(COLORS.border) } },
        bottom: { style: "thin", color: { argb: argbColor(COLORS.border) } },
        left: { style: "thin", color: { argb: argbColor(COLORS.border) } },
        right: { style: "thin", color: { argb: argbColor(COLORS.border) } },
      };
    });

    row.height = item.acceptanceCriteria && item.acceptanceCriteria.length > 80 ? 32 : 16;
  });

  // ── Summary row ───────────────────────────────────────────────────────────────
  const lastRow = ws.getRow(4 + items.length);
  const epics = items.filter((i) => i.issueLevel === "epic").length;
  const stories = items.filter((i) => i.issueLevel === "story").length;
  const tasks = items.filter((i) => i.issueLevel === "task").length;
  const totalSP = items.reduce((acc, i) => acc + (i.storyPoints ?? 0), 0);

  ws.mergeCells(`A${4 + items.length}:C${4 + items.length}`);
  lastRow.getCell(1).value = `TOTAL: ${epics} épicas | ${stories} historias | ${tasks} tareas`;
  lastRow.getCell(1).font = { name: "Calibri", bold: true, size: 9, color: { argb: argbColor(COLORS.headerFg) } };
  lastRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argbColor(COLORS.headerBg) } };
  lastRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  lastRow.getCell(5).value = totalSP;
  lastRow.getCell(5).font = { name: "Calibri", bold: true, size: 9, color: { argb: argbColor(COLORS.headerFg) } };
  lastRow.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argbColor(COLORS.headerBg) } };
  lastRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
  lastRow.height = 18;

  // ── Freeze panes ──────────────────────────────────────────────────────────────
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
