import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { bulkUpsertFinancialData } from "./db";
import {
  FINANCIAL_SYNC_REQUIRED_HEADERS,
  parseFinancialWorkbook,
} from "./financialSync";

function workbookBuffer(rows: Array<Record<string, unknown>>, headers = [...FINANCIAL_SYNC_REQUIRED_HEADERS]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Artefactos_proyectos");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function validRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Deal: "Deal4728",
    "Estado Proyecto": "EN EJECUCION",
    Proyecto: "CCLA SRP MVP1",
    Cliente: "CCLA",
    PM: "Eduardo",
    valor_venta_uf: 100,
    Presupuesto_UF: 80,
    Utilizado_UF: 40,
    Utilizado_UF_porc: 0.5,
    Presupuesto_HH: 200,
    Capacity_HH: 100,
    HH_porc_utilizado: 0.5,
    "Margen_bruto_nota_venta (UF)": 20,
    Porcentaje_avance_proyecto: 0.4,
    "Costo_Proyectado_UF_(segun avance)": 50,
    "Margen_Proyectado UF_(segun avance)": 50,
    "Margen_Proyectado_% (segun avance)": 0.5,
    Margen_Target_porc: 0.35,
    "Capacity U": 1,
    Planificado_UF: 75,
    Proyectado_UF: 90,
    margen_proyectado_segun_capacity: 0.45,
    Notas: "Evidencia válida",
    "Otros costos (UF)": 2,
    Linea_negocio: "Servicios",
    ...overrides,
  };
}

describe("parseFinancialWorkbook", () => {
  it("genera un hash SHA-256 reproducible y conserva el Deal", () => {
    const buffer = workbookBuffer([validRow()]);
    const first = parseFinancialWorkbook(buffer);
    const second = parseFinancialWorkbook(buffer);

    expect(first.records).toHaveLength(1);
    expect(first.records[0].dealId).toBe("Deal4728");
    expect(first.workbookSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(second.workbookSha256).toBe(first.workbookSha256);
  });

  it("bloquea un workbook con columnas financieras faltantes", () => {
    const headers = FINANCIAL_SYNC_REQUIRED_HEADERS.filter(header => header !== "Presupuesto_UF");
    const row = validRow();
    delete row.Presupuesto_UF;
    expect(() => parseFinancialWorkbook(workbookBuffer([row], headers))).toThrow(
      /Faltan columnas financieras requeridas: Presupuesto_UF/,
    );
  });

  it("bloquea Deals duplicados antes de escribir", () => {
    const buffer = workbookBuffer([validRow(), validRow({ Proyecto: "Duplicado" })]);
    expect(() => parseFinancialWorkbook(buffer)).toThrow(/Deal IDs duplicados.*Deal4728/);
  });

  it("bloquea valores numéricos inválidos en vez de convertirlos silenciosamente a null", () => {
    const buffer = workbookBuffer([validRow({ Presupuesto_UF: "ochenta" })]);
    expect(() => parseFinancialWorkbook(buffer)).toThrow(
      /Valor numérico inválido en Presupuesto_UF para Deal4728/,
    );
  });

  it("informa filas omitidas sin convertirlas en Deals", () => {
    const buffer = workbookBuffer([
      validRow(),
      validRow({ Deal: "" }),
      validRow({ Deal: "TOTAL" }),
    ]);
    const parsed = parseFinancialWorkbook(buffer);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.skippedRows).toBe(2);
    expect(parsed.sourceRows).toBe(3);
  });
});

describe("bulkUpsertFinancialData", () => {
  it("ejecuta todo el lote dentro de una única transacción", async () => {
    const persisted: string[] = [];
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<number>) => {
      const staged: string[] = [];
      const tx = {
        insert: () => ({
          values: (row: { dealId: string }) => ({
            onDuplicateKeyUpdate: async () => {
              staged.push(row.dealId);
            },
          }),
        }),
      };
      const result = await callback(tx);
      persisted.push(...staged);
      return result;
    });

    await expect(
      bulkUpsertFinancialData(
        [{ dealId: "Deal1" }, { dealId: "Deal2" }],
        { transaction },
      ),
    ).resolves.toBe(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(persisted).toEqual(["Deal1", "Deal2"]);
  });

  it("no deja filas aplicadas si una operación del lote falla", async () => {
    const persisted: string[] = [];
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<number>) => {
      const staged: string[] = [];
      const tx = {
        insert: () => ({
          values: (row: { dealId: string }) => ({
            onDuplicateKeyUpdate: async () => {
              if (row.dealId === "Deal2") throw new Error("simulated database failure");
              staged.push(row.dealId);
            },
          }),
        }),
      };
      const result = await callback(tx);
      persisted.push(...staged);
      return result;
    });

    await expect(
      bulkUpsertFinancialData(
        [{ dealId: "Deal1" }, { dealId: "Deal2" }],
        { transaction },
      ),
    ).rejects.toThrow(/simulated database failure/);
    expect(persisted).toEqual([]);
  });
});
