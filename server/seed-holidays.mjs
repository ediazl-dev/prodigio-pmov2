/**
 * Seed holidays from Nager.Date API for Chile (2025-2028)
 * Run: node server/seed-holidays.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

const YEARS = [2025, 2026, 2027, 2028];
const API_BASE = "https://date.nager.at/api/v3/publicholidays";

async function fetchHolidays(year) {
  const url = `${API_BASE}/${year}/CL`;
  console.log(`Fetching holidays for ${year} from ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status} for year ${year}`);
  const data = await res.json();
  // Only keep global holidays (not regional ones)
  return data
    .filter((h) => h.global === true)
    .map((h) => ({
      date: h.date,
      name: h.localName || h.name,
      year,
      source: "feriados.cl",
    }));
}

async function main() {
  console.log("Seeding Chilean holidays 2025-2028...");

  // Clear existing holidays
  await db.execute(sql`DELETE FROM holidays`);

  for (const year of YEARS) {
    const holidays = await fetchHolidays(year);
    console.log(`  ${year}: ${holidays.length} holidays found`);
    for (const h of holidays) {
      await db.execute(
        sql`INSERT INTO holidays (date, name, year, source) VALUES (${h.date}, ${h.name}, ${h.year}, ${h.source})`
      );
    }
  }

  // Also seed default stage deadlines if not exist
  const stageDefaults = [
    { stageId: "sow", maxBusinessDays: 10, label: "Statement of Work" },
    { stageId: "jira", maxBusinessDays: 5, label: "Configuración Jira" },
    { stageId: "risks", maxBusinessDays: 5, label: "Matriz de Riesgos" },
    { stageId: "planning", maxBusinessDays: 10, label: "Planificación WBS" },
    { stageId: "design", maxBusinessDays: 10, label: "Análisis y Diseño" },
    { stageId: "closure", maxBusinessDays: 5, label: "Cierre" },
  ];

  for (const s of stageDefaults) {
    await db.execute(
      sql`INSERT IGNORE INTO stage_deadlines (stageId, maxBusinessDays, label) VALUES (${s.stageId}, ${s.maxBusinessDays}, ${s.label})`
    );
  }

  console.log("Done! Holidays and default deadlines seeded.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
