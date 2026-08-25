/**
 * Sincronización financiera automatizada (Heartbeat).
 *
 * Descarga la planilla corporativa desde Google Drive vía API REST,
 * parsea la hoja `Artefactos_proyectos` y aplica un UPSERT por Deal ID
 * en la tabla `financial_data`. Replica la lógica validada del script
 * Python `scripts/sync_financial_data.py` (37 Deals, 0 errores).
 *
 * Controles heredados:
 * - Rechaza workbook vacío y Deal IDs duplicados.
 * - UPSERT por dealId: nunca elimina registros.
 * - Idempotente: reintentos producen el mismo resultado.
 * - No expone tokens en logs.
 */
import * as XLSX from "xlsx";
import { bulkUpsertFinancialData } from "./db";
import type { InsertFinancialData } from "../drizzle/schema";

const SHEET_NAME = "Artefactos_proyectos";
const SPREADSHEET_ID = "1ncyMnVgrwJ9DYWJDRorgnxNpGBPwaMAi3j8BYhxkjqQ";
const DRIVE_EXPORT_URL = `https://www.googleapis.com/drive/v3/files/${SPREADSHEET_ID}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;

/** Mapeo columna de la planilla -> columna de financial_data (idéntico al script Python). */
const FIELD_MAP: Record<string, keyof InsertFinancialData> = {
  "Estado Proyecto": "estadoProyecto",
  "Proyecto": "projectName",
  "Cliente": "clientName",
  "PM": "pm",
  "valor_venta_uf": "valorVentaUF",
  "Presupuesto_UF": "presupuestoUF",
  "Utilizado_UF": "utilizadoUF",
  "Utilizado_UF_porc": "utilizadoUFPorc",
  "Presupuesto_HH": "presupuestoHH",
  "Capacity_HH": "capacityHH",
  "HH_porc_utilizado": "hhPorcUtilizado",
  "Margen_bruto_nota_venta (UF)": "margenBrutoNotaVentaUF",
  "Porcentaje_avance_proyecto": "porcentajeAvanceProyecto",
  "Costo_Proyectado_UF_(segun avance)": "costoProyectadoUF",
  "Margen_Proyectado UF_(segun avance)": "margenProyectadoUF",
  "Margen_Proyectado_% (segun avance)": "margenProyectadoPorc",
  "Margen_Target_porc": "margenTargetPorc",
  "Capacity U": "capacityU",
  "Planificado_UF": "planificadoUF",
  "Proyectado_UF": "proyectadoUF",
  "margen_proyectado_segun_capacity": "margenProyectadoSegunCapacity",
  "Notas": "notas",
  "Otros costos (UF)": "otrosCostosUF",
  "Linea_negocio": "lineaNegocio",
};

const TEXT_FIELDS = new Set<keyof InsertFinancialData>([
  "estadoProyecto",
  "projectName",
  "clientName",
  "pm",
  "notas",
  "lineaNegocio",
]);

export type FinancialSyncOutcome = {
  timestampUtc: string;
  inputDeals: number;
  insert: number;
  update: number;
  status: "applied";
};

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "" || text === "None" || text === "N/A" || text.startsWith("#")) return null;
  return text;
}

function cleanNumber(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "" || text === "None" || text === "N/A") return null;
  const parsed = Number(text);
  if (Number.isNaN(parsed)) return null;
  return String(parsed);
}

async function downloadWorkbook(): Promise<Buffer> {
  const token = process.env.GOOGLE_DRIVE_TOKEN;
  if (token) {
    const response = await fetch(DRIVE_EXPORT_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Drive API respondió HTTP ${response.status} al exportar la planilla`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
      throw new Error("La planilla descargada está vacía");
    }
    return buffer;
  }
  // Fallback: leer archivo local descargado manualmente via gws
  const { readFileSync, existsSync } = await import("fs");
  const localPath = process.env.FINANCIAL_SYNC_LOCAL_FILE ?? "./financial_sync.xlsx";
  if (!existsSync(localPath)) {
    throw new Error("GOOGLE_DRIVE_TOKEN no configurado y no se encontró archivo local: " + localPath);
  }
  const buffer = readFileSync(localPath);
  if (buffer.length === 0) {
    throw new Error("El archivo local de sincronización está vacío");
  }
  console.log(`[FinancialSync] Usando archivo local: ${localPath} (${buffer.length} bytes)`);
  return buffer;
}

function parseWorkbook(buffer: Buffer): InsertFinancialData[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  if (!workbook.SheetNames.includes(SHEET_NAME)) {
    throw new Error(`No existe la hoja requerida: ${SHEET_NAME}`);
  }
  const sheet = workbook.Sheets[SHEET_NAME];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  // Validar columnas requeridas usando la primera fila disponible
  const firstRow = rows[0] ?? {};
  const headers = new Set(Object.keys(firstRow));
  if (!headers.has("Deal")) {
    throw new Error("La hoja no contiene la columna obligatoria Deal");
  }
  const missing = Object.keys(FIELD_MAP).filter((header) => !headers.has(header));
  if (missing.length > 0) {
    throw new Error(`Faltan columnas financieras requeridas: ${missing.join(", ")}`);
  }

  const records: InsertFinancialData[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    const dealId = cleanText(row["Deal"]);
    if (!dealId) continue;
    if (!dealId.startsWith("Deal")) continue;
    if (seen.has(dealId)) {
      duplicates.add(dealId);
      continue;
    }
    seen.add(dealId);

    const record: Record<string, unknown> = { dealId };
    for (const [source, target] of Object.entries(FIELD_MAP)) {
      const raw = row[source];
      record[target] = TEXT_FIELDS.has(target) ? cleanText(raw) : cleanNumber(raw);
    }
    records.push(record as unknown as InsertFinancialData);
  }

  if (records.length === 0) {
    throw new Error("No se encontraron Deal IDs válidos; no se escribirá nada");
  }
  if (duplicates.size > 0) {
    throw new Error(`Deal IDs duplicados en la planilla: ${Array.from(duplicates).sort().join(", ")}`);
  }
  return records;
}

/**
 * Ejecuta la sincronización completa: descarga, parsea y aplica UPSERT.
 * Devuelve el resultado con conteos de inserciones y actualizaciones.
 */
async function runFinancialSyncInternal(): Promise<FinancialSyncOutcome> {
  const buffer = await downloadWorkbook();
  const records = parseWorkbook(buffer);

  // Contar existentes antes del UPSERT para reportar insert vs update
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");
  const { financialData } = await import("../drizzle/schema");
  const { inArray } = await import("drizzle-orm");

  const dealIds = records.map((r) => r.dealId);
  const existing = new Set<string>();
  const BATCH = 500;
  for (let offset = 0; offset < dealIds.length; offset += BATCH) {
    const batch = dealIds.slice(offset, offset + BATCH);
    const found = await db
      .select({ dealId: financialData.dealId })
      .from(financialData)
      .where(inArray(financialData.dealId, batch));
    for (const row of found) existing.add(row.dealId);
  }

  await bulkUpsertFinancialData(records);

  return {
    timestampUtc: new Date().toISOString(),
    inputDeals: records.length,
    insert: records.filter((r) => !existing.has(r.dealId)).length,
    update: records.filter((r) => existing.has(r.dealId)).length,
    status: "applied",
  };
}


/**
 * Registra una ejecución de la sincronización en la tabla financial_sync_log.
 * Nunca lanza: si el registro falla, sólo se reporta por consola para no
 * interrumpir el resultado de la sincronización principal.
 */
async function logSyncExecution(entry: {
  status: "applied" | "error";
  inputDeals?: number;
  insertCount?: number;
  updateCount?: number;
  errorMessage?: string | null;
  triggeredBy?: string;
}): Promise<void> {
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const { financialSyncLogs } = await import("../drizzle/schema");
    await db.insert(financialSyncLogs).values({
      status: entry.status,
      inputDeals: entry.inputDeals ?? 0,
      insertCount: entry.insertCount ?? 0,
      updateCount: entry.updateCount ?? 0,
      errorMessage: entry.errorMessage ?? null,
      triggeredBy: entry.triggeredBy ?? "cron",
    });
  } catch (logError) {
    console.error("[FinancialSync] No se pudo registrar el log de sincronización:", logError);
  }
}

/**
 * Ejecuta la sincronización financiera y registra el resultado (éxito o error)
 * en el historial auditable. El error se re-lanza tras registrarlo para que el
 * endpoint responda 500 y el cron lo marque como fallido.
 */
export async function runFinancialSync(triggeredBy: "cron" | "manual" = "cron"): Promise<FinancialSyncOutcome> {
  try {
    const outcome = await runFinancialSyncInternal();
    await logSyncExecution({
      status: "applied",
      inputDeals: outcome.inputDeals,
      insertCount: outcome.insert,
      updateCount: outcome.update,
      triggeredBy,
    });
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSyncExecution({ status: "error", errorMessage: message, triggeredBy });
    throw error;
  }
}
