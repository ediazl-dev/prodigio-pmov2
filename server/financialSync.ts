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
import { createHash } from "node:crypto";
import { bulkUpsertFinancialData } from "./db";
import type { InsertFinancialData } from "../drizzle/schema";
import {
  createDriveAccessTokenProvider,
  GoogleDriveCredentialError,
  type DriveAccessTokenProvider,
} from "./googleDriveServiceAccount";

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

export const FINANCIAL_SYNC_REQUIRED_HEADERS = ["Deal", ...Object.keys(FIELD_MAP)] as const;

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
  workbookSha256: string;
};

export type FinancialSyncPreflight = Omit<FinancialSyncOutcome, "status"> & {
  status: "dry_run";
  skippedRows: number;
};

export type ParsedFinancialWorkbook = {
  records: InsertFinancialData[];
  sourceRows: number;
  skippedRows: number;
  workbookSha256: string;
};

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "" || text === "None" || text === "N/A" || text.startsWith("#")) return null;
  return text;
}

function cleanNumber(value: unknown, field: string, dealId: string): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "" || text === "None" || text === "N/A" || text.startsWith("#")) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor numérico inválido en ${field} para ${dealId}`);
  }
  return String(parsed);
}

type WorkbookDownloadOptions = {
  accessTokenProvider?: DriveAccessTokenProvider;
  fetchImpl?: typeof fetch;
  localFilePath?: string;
};

async function readLocalWorkbook(localPath: string): Promise<Buffer> {
  const { readFileSync, existsSync } = await import("fs");
  if (!existsSync(localPath)) {
    throw new GoogleDriveCredentialError(
      "GOOGLE_CREDENTIALS_MISSING",
      "No hay credenciales Google ni archivo local configurado para la sincronización financiera",
    );
  }
  const buffer = readFileSync(localPath);
  if (buffer.length === 0) {
    throw new Error("El archivo local de sincronización está vacío");
  }
  console.log(`[FinancialSync] Usando archivo local: ${localPath} (${buffer.length} bytes)`);
  return buffer;
}

export async function downloadFinancialWorkbook(options: WorkbookDownloadOptions = {}): Promise<Buffer> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const localPath = options.localFilePath ?? process.env.FINANCIAL_SYNC_LOCAL_FILE ?? "./financial_sync.xlsx";

  let provider = options.accessTokenProvider;
  if (!provider) {
    try {
      provider = createDriveAccessTokenProvider();
    } catch (error) {
      if (error instanceof GoogleDriveCredentialError && error.code === "GOOGLE_CREDENTIALS_MISSING") {
        return readLocalWorkbook(localPath);
      }
      throw error;
    }
  }

  const maxAttempts = provider.renewable ? 2 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = await provider.getAccessToken({ forceRefresh: attempt > 0 });
    const response = await fetchImpl(DRIVE_EXPORT_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 401 && provider.renewable && attempt === 0) continue;
    if (response.status === 401) {
      throw new Error("Drive API rechazó la credencial Google al exportar la planilla (HTTP 401)");
    }
    if (response.status === 403) {
      throw new Error("La identidad Google no tiene permiso para exportar la planilla (HTTP 403)");
    }
    if (!response.ok) {
      throw new Error(`Drive API respondió HTTP ${response.status} al exportar la planilla`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) throw new Error("La planilla descargada está vacía");
    return buffer;
  }

  throw new Error("No fue posible exportar la planilla después de renovar la credencial Google");
}

export function parseFinancialWorkbook(buffer: Buffer): ParsedFinancialWorkbook {
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
  let skippedRows = 0;

  for (const row of rows) {
    const dealId = cleanText(row["Deal"]);
    if (!dealId || !dealId.startsWith("Deal")) {
      skippedRows += 1;
      continue;
    }
    if (seen.has(dealId)) {
      duplicates.add(dealId);
      continue;
    }
    seen.add(dealId);

    const record: Record<string, unknown> = { dealId };
    for (const [source, target] of Object.entries(FIELD_MAP)) {
      const raw = row[source];
      record[target] = TEXT_FIELDS.has(target) ? cleanText(raw) : cleanNumber(raw, source, dealId);
    }
    records.push(record as unknown as InsertFinancialData);
  }

  if (records.length === 0) {
    throw new Error("No se encontraron Deal IDs válidos; no se escribirá nada");
  }
  if (duplicates.size > 0) {
    throw new Error(`Deal IDs duplicados en la planilla: ${Array.from(duplicates).sort().join(", ")}`);
  }
  return {
    records,
    sourceRows: rows.length,
    skippedRows,
    workbookSha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

async function buildFinancialPreflight(buffer: Buffer): Promise<FinancialSyncPreflight & { records: InsertFinancialData[] }> {
  const parsed = parseFinancialWorkbook(buffer);
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");
  const { financialData } = await import("../drizzle/schema");
  const { inArray } = await import("drizzle-orm");

  // Fuerza a la base a validar el esquema completo antes de cualquier escritura.
  await db.select().from(financialData).limit(0);

  const dealIds = parsed.records.map(record => record.dealId);
  const existing = new Set<string>();
  const batchSize = 500;
  for (let offset = 0; offset < dealIds.length; offset += batchSize) {
    const batch = dealIds.slice(offset, offset + batchSize);
    const found = await db
      .select({ dealId: financialData.dealId })
      .from(financialData)
      .where(inArray(financialData.dealId, batch));
    for (const row of found) existing.add(row.dealId);
  }

  return {
    timestampUtc: new Date().toISOString(),
    inputDeals: parsed.records.length,
    insert: parsed.records.filter(record => !existing.has(record.dealId)).length,
    update: parsed.records.filter(record => existing.has(record.dealId)).length,
    status: "dry_run",
    skippedRows: parsed.skippedRows,
    workbookSha256: parsed.workbookSha256,
    records: parsed.records,
  };
}

export async function runFinancialSyncPreflight(): Promise<FinancialSyncPreflight> {
  const buffer = await downloadFinancialWorkbook();
  const { records: _records, ...preflight } = await buildFinancialPreflight(buffer);
  return preflight;
}

/**
 * Ejecuta la sincronización completa: descarga, parsea y aplica UPSERT.
 * Devuelve el resultado con conteos de inserciones y actualizaciones.
 */
async function runFinancialSyncInternal(): Promise<FinancialSyncOutcome> {
  const buffer = await downloadFinancialWorkbook();
  const { records, skippedRows: _skippedRows, status: _status, ...preflight } = await buildFinancialPreflight(buffer);
  await bulkUpsertFinancialData(records);

  return {
    ...preflight,
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
