import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { bulkUpsertFinancialData } from "./db";
import {
  FINANCIAL_BILLING_REQUIRED_HEADERS,
  FINANCIAL_SYNC_REQUIRED_HEADERS,
  parseFinancialWorkbook,
} from "./financialSync";

function validBillingRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Deal: "Deal4728",
    Proyecto: "CCLA SRP MVP1",
    "Hito de Facturación": "M01",
    "Fecha planificada (Compromiso segun plan kickoff)": "2026-03-01",
    "Fecha de Entrega (fecha de aprobacion de la entrega por parte del cliente)": "2026-03-05",
    "Fecha de Factura (real) lo completa finanzas": "2026-03-10",
    "MONTO ( lo completa finanzas)": 100,
    "TIPO DE MONEDA": "UF",
    "EN_USD (valor calculado, no completar)": 4500,
    "Estado Facturacion (valor calculado, no completar)": "FACTURADO",
    "Estado Entrega Hito (valor calculado, no completar)": "ENTREGADO",
    "CAUSA ATRASO (valor calculado, no completar)": null,
    Linea_de_negocio: "Delivery",
    ...overrides,
  };
}

function workbookBuffer(
  rows: Array<Record<string, unknown>>,
  headers = [...FINANCIAL_SYNC_REQUIRED_HEADERS],
  billingRows: Array<Record<string, unknown>> = [validBillingRow()],
  billingHeaders = [...FINANCIAL_BILLING_REQUIRED_HEADERS],
): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const billingSheet = XLSX.utils.json_to_sheet(billingRows, { header: billingHeaders });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Artefactos_proyectos");
  XLSX.utils.book_append_sheet(workbook, billingSheet, "Artefactos_facturacion");
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
  it("genera hash reproducible y claves idempotentes para ambas hojas", () => {
    const buffer = workbookBuffer([validRow()]);
    const first = parseFinancialWorkbook(buffer);
    const second = parseFinancialWorkbook(buffer);
    expect(first.records).toHaveLength(1);
    expect(first.billingRecords).toHaveLength(1);
    expect(first.records[0].dealId).toBe("Deal4728");
    expect(first.workbookSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(second.workbookSha256).toBe(first.workbookSha256);
    expect(second.billingRecords[0].sourceKey).toBe(first.billingRecords[0].sourceKey);
  });

  it("normaliza hitos, fechas y conversión USD declarada por la fuente", () => {
    const parsed = parseFinancialWorkbook(workbookBuffer([validRow()], undefined, [
      validBillingRow({
        Deal: "Deal 4728",
        "Fecha planificada (Compromiso segun plan kickoff)": "01/03/2026",
        "Fecha de Factura (real) lo completa finanzas": "10/03/2026",
      }),
    ]));
    expect(parsed.billingRecords[0]).toMatchObject({
      dealId: "Deal4728",
      plannedDate: "2026-03-01",
      invoicedAt: "2026-03-10",
      amount: "100",
      currency: "UF",
      amountUsdSource: "4500",
    });
    expect(parsed.billingPeriodFrom).toBe("2026-03-10");
    expect(parsed.billingPeriodTo).toBe("2026-03-10");
  });

  it("bloquea un workbook con columnas financieras faltantes", () => {
    const headers = FINANCIAL_SYNC_REQUIRED_HEADERS.filter(header => header !== "Presupuesto_UF");
    const row = validRow();
    delete row.Presupuesto_UF;
    expect(() => parseFinancialWorkbook(workbookBuffer([row], headers))).toThrow(/Faltan columnas financieras requeridas: Presupuesto_UF/);
  });

  it("bloquea un workbook sin columnas históricas de facturación", () => {
    const headers = FINANCIAL_BILLING_REQUIRED_HEADERS.filter(header => header !== "EN_USD (valor calculado, no completar)");
    const row = validBillingRow();
    delete row["EN_USD (valor calculado, no completar)"];
    expect(() => parseFinancialWorkbook(workbookBuffer([validRow()], undefined, [row], headers))).toThrow(/Faltan columnas de facturación requeridas: EN_USD/);
  });

  it("bloquea Deals duplicados antes de escribir", () => {
    const buffer = workbookBuffer([validRow(), validRow({ Proyecto: "Duplicado" })]);
    expect(() => parseFinancialWorkbook(buffer)).toThrow(/Deal IDs duplicados.*Deal4728/);
  });

  it("bloquea valores numéricos inválidos en vez de convertirlos silenciosamente a null", () => {
    expect(() => parseFinancialWorkbook(workbookBuffer([validRow({ Presupuesto_UF: "ochenta" })]))).toThrow(/Valor numérico inválido en Presupuesto_UF para Deal4728/);
  });

  it("informa filas omitidas sin convertirlas en ítems", () => {
    const parsed = parseFinancialWorkbook(workbookBuffer([validRow(), validRow({ Deal: "" }), validRow({ Deal: "TOTAL" })]));
    expect(parsed.records).toHaveLength(1);
    expect(parsed.skippedRows).toBe(2);
    expect(parsed.sourceRows).toBe(3);
  });

  it("preserva identificadores internos y subdeals como ítems distintos", () => {
    const parsed = parseFinancialWorkbook(workbookBuffer([
      validRow({ Deal: "Deal 1742-01" }),
      validRow({ Deal: "INT-Innovacion-2026", Proyecto: "Iniciativa interna" }),
    ]));
    expect(parsed.records.map(record => record.dealId)).toEqual(["Deal1742-01", "INT-Innovacion-2026"]);
  });
});

describe("bulkUpsertFinancialData", () => {
  it("ejecuta todo el lote dentro de una única transacción", async () => {
    const persisted: string[] = [];
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<number>) => {
      const staged: string[] = [];
      const tx = { insert: () => ({ values: (row: { dealId: string }) => ({ onDuplicateKeyUpdate: async () => { staged.push(row.dealId); } }) }) };
      const result = await callback(tx);
      persisted.push(...staged);
      return result;
    });
    await expect(bulkUpsertFinancialData([{ dealId: "Deal1" }, { dealId: "Deal2" }], { transaction })).resolves.toBe(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(persisted).toEqual(["Deal1", "Deal2"]);
  });

  it("no deja filas aplicadas si una operación del lote falla", async () => {
    const persisted: string[] = [];
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<number>) => {
      const staged: string[] = [];
      const tx = { insert: () => ({ values: (row: { dealId: string }) => ({ onDuplicateKeyUpdate: async () => {
        if (row.dealId === "Deal2") throw new Error("simulated database failure");
        staged.push(row.dealId);
      } }) }) };
      const result = await callback(tx);
      persisted.push(...staged);
      return result;
    });
    await expect(bulkUpsertFinancialData([{ dealId: "Deal1" }, { dealId: "Deal2" }], { transaction })).rejects.toThrow(/simulated database failure/);
    expect(persisted).toEqual([]);
  });
});
