/**
 * documentExtractor.ts
 * Extracts text content from uploaded documents (DOCX, XLSX, PDF, etc.)
 * Uses local parsing for DOCX (mammoth) and XLSX (xlsx/ganttParser),
 * and LLM file_url only for PDF files (the only document type supported by the LLM API).
 */
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { invokeLLM } from "./_core/llm";
import { parseGanttBuffer, summarizeGantt, type GanttRow } from "./ganttParser";

/** Detect mime type from file URL or name */
export function detectMimeType(url: string, fileName?: string): string {
  const name = (fileName || url).toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (name.endsWith(".xls")) return "application/vnd.ms-excel";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/** Check if a file is a DOCX document */
export function isDocx(url: string, fileName?: string): boolean {
  const name = (fileName || url).toLowerCase();
  return name.endsWith(".docx");
}

/** Check if a file is an Excel spreadsheet */
export function isExcel(url: string, fileName?: string): boolean {
  const name = (fileName || url).toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
}

/** Check if a file is a PDF */
export function isPdf(url: string, fileName?: string): boolean {
  const name = (fileName || url).toLowerCase();
  return name.endsWith(".pdf");
}

/** Download a file from URL and return as Buffer */
async function downloadFile(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

/**
 * Extract text from a DOCX file using mammoth.
 * Returns clean, structured text content.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract text from an Excel file using xlsx.
 * Returns a text representation of all sheets.
 */
export function extractTextFromExcel(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    if (rows.length === 0) continue;
    parts.push(`--- Hoja: ${sheetName} (${rows.length} filas) ---`);
    // Get headers
    const headers = Object.keys(rows[0]);
    parts.push(headers.join(" | "));
    // Add rows (limit to 100 for context window)
    for (const row of rows.slice(0, 100)) {
      parts.push(headers.map(h => String(row[h] ?? "")).join(" | "));
    }
    if (rows.length > 100) {
      parts.push(`... (${rows.length - 100} filas adicionales omitidas)`);
    }
  }
  return parts.join("\n");
}

/**
 * Extract text from a PDF file using LLM file_url.
 * This is the only document type that the LLM API supports via file_url.
 */
export async function extractTextFromPdf(url: string, context: string): Promise<string> {
  const extractResp = await invokeLLM({
    messages: [
      { role: "system", content: "Eres un analista de proyectos. Extrae y resume el contenido completo del documento adjunto. Responde en español con formato estructurado." },
      { role: "user", content: [
        { type: "text", text: context },
        { type: "file_url", file_url: { url, mime_type: "application/pdf" as any } },
      ] },
    ],
  });
  return extractResp.choices?.[0]?.message?.content as string || "";
}

/**
 * Extract SoW content from any supported file format.
 * - DOCX: download + mammoth text extraction + LLM analysis
 * - PDF: LLM file_url (native support)
 * - XLSX: download + xlsx text extraction
 * Returns the extracted/analyzed text content.
 */
export async function extractSowContent(
  fileUrl: string,
  fileName: string,
  projectName: string
): Promise<string> {
  const systemPrompt = "Eres un analista de proyectos. Extrae y resume el contenido clave del Statement of Work (SoW). Incluye: objetivo general, objetivos específicos, alcance (actividades incluidas y excluidas), entregables, hitos, supuestos, dependencias del cliente, limitaciones, equipo propuesto, y monto/condiciones comerciales. Responde en español con formato estructurado.";

  if (isDocx(fileUrl, fileName)) {
    // DOCX: download, extract text with mammoth, then send text to LLM for structured analysis
    console.log(`[DocExtractor] Extracting DOCX SoW: ${fileName}`);
    const buffer = await downloadFile(fileUrl);
    const rawText = await extractTextFromDocx(buffer);
    console.log(`[DocExtractor] DOCX text extracted: ${rawText.length} chars`);

    if (rawText.length < 50) {
      return `[Archivo SoW DOCX: ${fileName}, contenido muy breve o vacío]`;
    }

    // Send extracted text to LLM for structured analysis
    const extractResp = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analiza el siguiente contenido del SoW del proyecto "${projectName}" y extrae toda la información relevante para evaluar el cumplimiento del proyecto:\n\n${rawText.substring(0, 30000)}` },
      ],
    });
    return extractResp.choices?.[0]?.message?.content as string || rawText.substring(0, 5000);

  } else if (isPdf(fileUrl, fileName)) {
    // PDF: use LLM file_url directly (native support)
    console.log(`[DocExtractor] Extracting PDF SoW: ${fileName}`);
    return await extractTextFromPdf(
      fileUrl,
      `Analiza este documento SoW del proyecto "${projectName}" y extrae toda la información relevante para evaluar el cumplimiento del proyecto.`
    );

  } else if (isExcel(fileUrl, fileName)) {
    // Excel: download and extract text
    console.log(`[DocExtractor] Extracting Excel SoW: ${fileName}`);
    const buffer = await downloadFile(fileUrl);
    return extractTextFromExcel(buffer);

  } else {
    // Unsupported format - try as PDF via LLM as last resort
    console.log(`[DocExtractor] Unknown format for SoW: ${fileName}, trying as PDF`);
    try {
      return await extractTextFromPdf(
        fileUrl,
        `Analiza este documento SoW del proyecto "${projectName}".`
      );
    } catch {
      return `[Archivo SoW disponible: ${fileName}, formato no soportado para extracción automática]`;
    }
  }
}

/**
 * Extract Gantt content from any supported file format.
 * - XLSX/XLS/CSV: download + ganttParser for structured extraction
 * - PDF: LLM file_url (native support)
 * Returns the extracted/analyzed text content.
 */
export async function extractGanttContent(
  fileUrl: string,
  fileName: string,
  projectName: string
): Promise<string> {
  if (isExcel(fileUrl, fileName)) {
    // Excel: download and parse with ganttParser
    console.log(`[DocExtractor] Extracting Excel Gantt: ${fileName}`);
    const buffer = await downloadFile(fileUrl);
    console.log(`[DocExtractor] Downloaded Gantt: ${buffer.length} bytes`);

    const ganttRows = parseGanttBuffer(buffer);
    const summary = summarizeGantt(ganttRows);
    console.log(`[DocExtractor] Parsed Gantt: ${ganttRows.length} rows, ${summary.phases} phases, ${summary.hitos} milestones`);

    let content = `PLANIFICACIÓN GANTT - ${projectName}\n` +
      `Archivo: ${fileName}\n` +
      `Total filas: ${summary.totalRows}, Fases: ${summary.phases}, Tareas: ${summary.tasks}, Hitos: ${summary.hitos}\n` +
      `Fecha inicio: ${summary.startDate || "N/A"}, Fecha fin: ${summary.endDate || "N/A"}\n\n`;

    // Add phases with their tasks
    const phases = ganttRows.filter(r => r.level === 1);
    for (const phase of phases) {
      const phaseIdx = ganttRows.indexOf(phase);
      const nextPhaseIdx = ganttRows.findIndex((p, idx) => idx > phaseIdx && p.level === 1);
      const phaseTasks = ganttRows.filter((r, idx) =>
        r.level > 1 && idx > phaseIdx && (nextPhaseIdx === -1 || idx < nextPhaseIdx)
      );
      content += `\nFase: ${phase.name} (${phase.startDate || ""} - ${phase.endDate || ""}) [${phase.percentComplete}%]\n`;
      const milestones = phaseTasks.filter(t => t.isHito);
      if (milestones.length > 0) {
        content += `  Hitos: ${milestones.map(m => `${m.name} (${m.endDate || "sin fecha"}) [${m.percentComplete}%]`).join("; ")}\n`;
      }
      const criticalTasks = phaseTasks.filter(t => !t.isHito && t.level >= 2).slice(0, 10);
      if (criticalTasks.length > 0) {
        content += `  Tareas: ${criticalTasks.map(t => `${t.name} (${t.startDate || ""}-${t.endDate || ""}) [${t.percentComplete}%]`).join("; ")}\n`;
      }
    }

    // If no phases found, list all rows
    if (phases.length === 0 && ganttRows.length > 0) {
      content += ganttRows.slice(0, 50).map(r =>
        `${"  ".repeat(r.level)}${r.isHito ? "[HITO] " : ""}${r.name} (${r.startDate || ""}-${r.endDate || ""}) [${r.percentComplete}%]`
      ).join("\n");
    }

    return content;

  } else if (isPdf(fileUrl, fileName)) {
    // PDF: use LLM file_url
    console.log(`[DocExtractor] Extracting PDF Gantt: ${fileName}`);
    return await extractTextFromPdf(
      fileUrl,
      `Analiza este cronograma/Gantt del proyecto "${projectName}" y extrae la planificación completa. Incluye: fases principales, hitos clave con fechas, tareas críticas, duración total estimada, recursos asignados, y ruta crítica si es identificable.`
    );

  } else {
    // Unsupported format
    console.log(`[DocExtractor] Unknown format for Gantt: ${fileName}`);
    try {
      return await extractTextFromPdf(
        fileUrl,
        `Analiza este cronograma/Gantt del proyecto "${projectName}".`
      );
    } catch {
      return `[Archivo Gantt disponible: ${fileName}, formato no soportado para extracción automática]`;
    }
  }
}
