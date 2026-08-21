import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { ufValues } from "../drizzle/schema";

/**
 * Servicio de obtención del valor de la UF del día.
 * Fuentes (en orden de prioridad):
 *   1. Caché local (tabla uf_value) — si ya existe registro para la fecha, se retorna sin llamar APIs.
 *   2. findic.cl — API gratuita sin autenticación (fuente principal).
 *   3. API Banco Central de Chile (BDE Siete) — requiere BCCH_API_TOKEN (fuente secundaria/fallback).
 * El valor obtenido de una fuente externa se persiste en uf_value con la fuente correspondiente.
 */

export interface UfDelDia {
  fecha: string;        // YYYY-MM-DD
  valorCLP: number;     // valor en pesos chilenos
  fuente: "cache" | "findic.cl" | "bcentral";
}

const BCCH_SERIE_UF = "F073.UFF.PRE.Z.D";
const BCCH_ENDPOINT = "https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx";
const FINDIC_ENDPOINT = "https://findic.cl/api/uf";
const FETCH_TIMEOUT_MS = 8000;

/** Convierte fecha DD-MM-YYYY (formato BCCh) a YYYY-MM-DD */
export function bcchDateToISO(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

/** Parsea la respuesta de findic.cl y retorna el valor más reciente */
export function parseFindicResponse(json: any): { fecha: string; valorCLP: number } | null {
  if (!json || !Array.isArray(json.serie) || json.serie.length === 0) return null;
  const first = json.serie[0];
  if (!first || typeof first.valor !== "number" || !first.fecha) return null;
  return { fecha: String(first.fecha).slice(0, 10), valorCLP: first.valor };
}

/** Parsea la respuesta del BCCh y retorna el valor más reciente */
export function parseBcchResponse(json: any): { fecha: string; valorCLP: number } | null {
  if (!json || json.Codigo !== 0 || !json.Series || !Array.isArray(json.Series.Obs) || json.Series.Obs.length === 0) return null;
  const obs = json.Series.Obs.filter((o: any) => o.statusCode === "OK" && o.value);
  if (obs.length === 0) return null;
  const last = obs[obs.length - 1];
  const valor = parseFloat(String(last.value).replace(",", "."));
  if (isNaN(valor)) return null;
  return { fecha: bcchDateToISO(last.indexDateString), valorCLP: valor };
}

async function fetchWithTimeout(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromFindic(): Promise<{ fecha: string; valorCLP: number } | null> {
  try {
    const json = await fetchWithTimeout(FINDIC_ENDPOINT);
    return parseFindicResponse(json);
  } catch {
    return null;
  }
}

async function fetchFromBcch(): Promise<{ fecha: string; valorCLP: number } | null> {
  const token = process.env.BCCH_API_TOKEN;
  if (!token) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const url = `${BCCH_ENDPOINT}?token=${encodeURIComponent(token)}&function=GetSeries&timeseries=${BCCH_SERIE_UF}&firstdate=${weekAgo}&lastdate=${today}`;
    const json = await fetchWithTimeout(url);
    return parseBcchResponse(json);
  } catch {
    return null;
  }
}

/**
 * Obtiene el valor de la UF del día.
 * 1. Busca en caché (tabla uf_value) el registro de hoy.
 * 2. Si no existe, consulta findic.cl; si falla, consulta BCCh.
 * 3. Persiste el resultado en uf_value y lo retorna.
 * Retorna null si todas las fuentes fallan.
 */
export async function getUfDelDia(): Promise<UfDelDia | null> {
  const today = new Date().toISOString().slice(0, 10);
  const db = await getDb();

  // 1. Caché local
  if (db) {
    const cached = await db.select().from(ufValues).where(eq(ufValues.fecha, today)).limit(1);
    if (cached[0]) {
      return { fecha: cached[0].fecha, valorCLP: parseFloat(cached[0].valorCLP), fuente: "cache" };
    }
  }

  // 2. Fuente principal: findic.cl
  let result = await fetchFromFindic();
  let fuente: UfDelDia["fuente"] = "findic.cl";

  // 3. Fallback: Banco Central
  if (!result) {
    result = await fetchFromBcch();
    fuente = "bcentral";
  }

  if (!result) return null;

  // Persistir en caché (upsert por fecha)
  if (db) {
    const existing = await db.select().from(ufValues).where(eq(ufValues.fecha, result.fecha)).limit(1);
    if (existing[0]) {
      await db.update(ufValues)
        .set({ valorCLP: String(result.valorCLP), fuente })
        .where(eq(ufValues.fecha, result.fecha));
    } else {
      await db.insert(ufValues).values({
        fecha: result.fecha,
        valorCLP: String(result.valorCLP),
        fuente,
      });
    }
  }

  return { fecha: result.fecha, valorCLP: result.valorCLP, fuente };
}
