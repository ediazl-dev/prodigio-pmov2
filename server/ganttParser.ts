/**
 * ganttParser.ts
 * Parsea archivos Excel con formato Gantt corporativo Prodigio Tech.
 * Detecta jerarquía por indentación (3 espacios por nivel) en la columna "Nombre de tarea".
 */
import * as XLSX from "xlsx";

export interface GanttRow {
  rowIndex: number;
  level: number;           // 0=proyecto, 1=fase, 2=sub-fase, 3+=tarea
  name: string;            // nombre sin indentación
  isHito: boolean;         // nombre empieza con [HITO]
  isSummary: boolean;      // nivel <= 2 (fila resumen/agrupador)
  duration: string | null;
  startDate: string | null;
  endDate: string | null;
  predecessors: string | null;
  resources: string | null;
  percentComplete: number;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const month = String(d.m).padStart(2, "0");
      const day = String(d.d).padStart(2, "0");
      return `${d.y}-${month}-${day}`;
    }
  }
  if (typeof val === "string") {
    // Try YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.split("T")[0];
    // Try DD/MM/YYYY
    const ddmm = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ddmm) {
      return `${ddmm[3]}-${ddmm[2].padStart(2, "0")}-${ddmm[1].padStart(2, "0")}`;
    }
  }
  return String(val);
}

function detectLevel(name: string): number {
  const raw = name || "";
  const trimmed = raw.trimStart();
  const indent = raw.length - trimmed.length;
  return Math.floor(indent / 3);
}

export function parseGanttBuffer(buffer: Buffer): GanttRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: false,
  });

  if (raw.length < 2) return [];

  // Find header row (row with "Nombre de tarea")
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    const row = raw[i] as unknown[];
    if (row && row.some((c) => typeof c === "string" && c.toLowerCase().includes("nombre"))) {
      headerRowIdx = i;
      break;
    }
  }

  // Map header columns
  const headerRow = raw[headerRowIdx] as string[];
  const colMap: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    if (!h) return;
    const lower = String(h).toLowerCase();
    if (lower.includes("nombre")) colMap.name = idx;
    else if (lower.includes("duraci")) colMap.duration = idx;
    else if (lower.includes("comienzo") || lower.includes("inicio")) colMap.start = idx;
    else if (lower.includes("fin")) colMap.end = idx;
    else if (lower.includes("predecesor")) colMap.predecessors = idx;
    else if (lower.includes("recurso")) colMap.resources = idx;
    else if (lower.includes("%") || lower.includes("completado")) colMap.pct = idx;
  });

  const results: GanttRow[] = [];

  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    if (!row || !row[colMap.name ?? 0]) continue;

    const rawName = String(row[colMap.name ?? 0] || "");
    if (!rawName.trim()) continue;

    const level = detectLevel(rawName);
    const name = rawName.trim();
    const isHito = name.toUpperCase().startsWith("[HITO]");
    const isSummary = level <= 2 && !isHito;

    const pctRaw = row[colMap.pct ?? 6];
    let pct = 0;
    if (pctRaw !== null && pctRaw !== undefined) {
      const n = parseFloat(String(pctRaw));
      pct = isNaN(n) ? 0 : n > 1 ? n / 100 : n;
    }

    // Parse dates - handle both Date objects and strings
    const startVal = row[colMap.start ?? 2];
    const endVal = row[colMap.end ?? 3];

    results.push({
      rowIndex: i - headerRowIdx,
      level,
      name,
      isHito,
      isSummary,
      duration: row[colMap.duration ?? 1] ? String(row[colMap.duration ?? 1]) : null,
      startDate: parseDate(startVal),
      endDate: parseDate(endVal),
      predecessors: row[colMap.predecessors ?? 4] ? String(row[colMap.predecessors ?? 4]) : null,
      resources: row[colMap.resources ?? 5] ? String(row[colMap.resources ?? 5]) : null,
      percentComplete: pct,
    });
  }

  return results;
}

/**
 * Returns a summary of the parsed Gantt for display.
 */
export function summarizeGantt(rows: GanttRow[]) {
  const phases = rows.filter((r) => r.level === 1 && !r.isHito);
  const tasks = rows.filter((r) => r.level >= 3 && !r.isHito);
  const hitos = rows.filter((r) => r.isHito);
  return {
    totalRows: rows.length,
    phases: phases.length,
    tasks: tasks.length,
    hitos: hitos.length,
    startDate: rows.find((r) => r.startDate)?.startDate ?? null,
    endDate: [...rows].reverse().find((r) => r.endDate)?.endDate ?? null,
  };
}
