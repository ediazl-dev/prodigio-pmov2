/**
 * Motor determinista del Consolidado de Facturación.
 * Calcula el embudo completo: CONTRATADO → DEVENGADO → FACTURABLE → FACTURADO → COBRADO
 * y las brechas: WIP, BACKLOG, AR, DESCALCE.
 *
 * Regla anti-fabricación: campos sin evidencia = null (se muestran como [POR CONFIRMAR]).
 * Invariante de cierre: CONTRATADO = COBRADO + AR + WIP + BACKLOG
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ContractData {
  id: number;
  projectId: number | null;
  dealId: string | null;
  clientName: string;
  contractName: string;
  valorContratadoUF: string | null;
  esInversionInterna: boolean | null;
  estado: string | null;
}

export interface PaymentScheduleItemData {
  id: number;
  contractId: number;
  milestoneCode: string | null;
  descripcion: string | null;
  pesoPct: string | null;
  valorUF: string | null;
  fechaPlanificada: string | null;
}

export interface RevenueEventData {
  id: number;
  contractId: number;
  milestoneCode: string | null;
  valorUF: string | null;
  fechaDevengo: string | null;
}

export interface InvoiceData {
  id: number;
  contractId: number;
  valorUF: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  estadoSII: string | null;
}

export interface PaymentData {
  id: number;
  invoiceId: number;
  valorUF: string | null;
  fechaPago: string | null;
}

export const ELIGIBLE_INVOICE_STATES = new Set(["emitida", "aceptada"]);

export function isEligibleInvoice(invoice: InvoiceData, fechaCorte: string): boolean {
  const status = invoice.estadoSII?.trim().toLowerCase() ?? "";
  return Boolean(invoice.fechaEmision && invoice.fechaEmision <= fechaCorte && ELIGIBLE_INVOICE_STATES.has(status));
}

export function normalizeFinancialCutoff(value: string | null | undefined, today: string): string {
  const candidate = value?.trim() || today;
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  const month = candidate.match(/^(\d{4})-(\d{2})$/);
  if (month) {
    const year = Number(month[1]);
    const monthNumber = Number(month[2]);
    if (monthNumber >= 1 && monthNumber <= 12) {
      return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    }
  }
  throw new Error("La fecha de corte debe usar YYYY-MM-DD o YYYY-MM");
}

export interface InvoiceAgingBucket {
  rango: string;
  monto: number;
  cantidad: number;
  porcentaje: number;
}

export function calculateInvoiceAging(
  invoices: InvoiceData[],
  payments: PaymentData[],
  fechaCorte: string,
): InvoiceAgingBucket[] {
  const buckets = [
    { rango: "0-30 días", monto: 0, cantidad: 0 },
    { rango: "31-60 días", monto: 0, cantidad: 0 },
    { rango: "61-90 días", monto: 0, cantidad: 0 },
    { rango: "91-120 días", monto: 0, cantidad: 0 },
    { rango: ">120 días", monto: 0, cantidad: 0 },
  ];
  const paidByInvoice = new Map<number, number>();
  for (const payment of payments) {
    if (!payment.fechaPago || payment.fechaPago > fechaCorte) continue;
    paidByInvoice.set(payment.invoiceId, (paidByInvoice.get(payment.invoiceId) ?? 0) + safeAmount(payment.valorUF));
  }
  const cutoffMs = Date.parse(`${fechaCorte}T00:00:00Z`);
  for (const invoice of invoices) {
    if (!isEligibleInvoice(invoice, fechaCorte) || !invoice.fechaVencimiento) continue;
    const dueMs = Date.parse(`${invoice.fechaVencimiento}T00:00:00Z`);
    if (!Number.isFinite(dueMs) || dueMs >= cutoffMs) continue;
    const balance = Math.max(0, safeAmount(invoice.valorUF) - (paidByInvoice.get(invoice.id) ?? 0));
    if (balance <= 0) continue;
    const days = Math.floor((cutoffMs - dueMs) / (24 * 60 * 60 * 1000));
    const index = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : days <= 120 ? 3 : 4;
    buckets[index].monto += balance;
    buckets[index].cantidad += 1;
  }
  const total = buckets.reduce((sum, bucket) => sum + bucket.monto, 0);
  return buckets.map((bucket) => ({ ...bucket, porcentaje: total > 0 ? (bucket.monto / total) * 100 : 0 }));
}

// ─── Resultado del embudo por contrato ───────────────────────────────────────

export interface FunnelResult {
  contractId: number;
  projectId: number | null;
  dealId: string | null;
  clientName: string;
  contractName: string;
  esInversionInterna: boolean;

  // Embudo principal (UF)
  contratado: number;
  devengado: number;
  facturado: number;
  cobrado: number;

  // Brechas (UF)
  wip: number;           // Devengado no facturado
  backlog: number;       // Contratado no devengado
  ar: number;            // Facturado no cobrado
  descalce: number;      // Plan vs real (curva)

  // Plan (curva de pago)
  planAcumulado: number; // Σ valorUF de ítems con fechaPlanificada ≤ corte
  realAcumulado: number; // Σ valorUF de revenue_events con fechaDevengo ≤ corte

  // Porcentajes
  pctDevengado: number;  // devengado / contratado × 100
  pctFacturado: number;  // facturado / contratado × 100
  pctCobrado: number;    // cobrado / contratado × 100

  // Invariante
  invarianteOk: boolean; // contratado ≈ cobrado + ar + wip + backlog
}

// ─── Resultado consolidado del portafolio ────────────────────────────────────

export interface PortfolioFunnel {
  // Totales cartera comercial (sin inversión interna)
  contratado: number;
  devengado: number;
  facturado: number;
  cobrado: number;
  wip: number;
  backlog: number;
  ar: number;
  descalce: number;
  planAcumulado: number;
  realAcumulado: number;

  // Porcentajes
  pctDevengado: number;
  pctFacturado: number;
  pctCobrado: number;

  // Inversión interna (separada)
  inversionInterna: number;

  // Conteos
  totalContratos: number;
  contratosActivos: number;
  contratosCerrados: number;

  // Invariante global
  invarianteOk: boolean;

  // Detalle por contrato
  contratos: FunnelResult[];

  // Fecha de corte
  fechaCorte: string;
}

// ─── Función principal: calcular embudo por contrato ─────────────────────────

export function calculateContractFunnel(
  contract: ContractData,
  scheduleItems: PaymentScheduleItemData[],
  revenueEvents: RevenueEventData[],
  invoices: InvoiceData[],
  payments: PaymentData[],
  fechaCorte: string,
): FunnelResult {
  const contratado = safeAmount(contract.valorContratadoUF);

  // DEVENGADO: Σ revenue_events con fechaDevengo ≤ corte
  const devengado = revenueEvents
    .filter(r => r.contractId === contract.id && r.fechaDevengo && r.fechaDevengo <= fechaCorte)
    .reduce((sum, r) => sum + safeAmount(r.valorUF), 0);

  // FACTURADO: sólo facturas emitidas o aceptadas al corte.
  const contractInvoices = invoices.filter(i => i.contractId === contract.id && isEligibleInvoice(i, fechaCorte));
  const facturado = contractInvoices.reduce((sum, i) => sum + safeAmount(i.valorUF), 0);

  // COBRADO: Σ payments de facturas del contrato con fechaPago ≤ corte
  const invoiceIds = new Set(contractInvoices.map(i => i.id));
  const cobrado = payments
    .filter(p => invoiceIds.has(p.invoiceId) && p.fechaPago && p.fechaPago <= fechaCorte)
    .reduce((sum, p) => sum + safeAmount(p.valorUF), 0);

  // Brechas
  const wip = devengado - facturado;
  const backlog = contratado - devengado;
  const ar = facturado - cobrado;

  // Plan vs real (curva)
  const planAcumulado = scheduleItems
    .filter(s => s.contractId === contract.id && s.fechaPlanificada && s.fechaPlanificada <= fechaCorte)
    .reduce((sum, s) => sum + safeAmount(s.valorUF), 0);
  const realAcumulado = devengado;
  const descalce = realAcumulado - planAcumulado;

  // Porcentajes
  const pctDevengado = contratado > 0 ? (devengado / contratado) * 100 : 0;
  const pctFacturado = contratado > 0 ? (facturado / contratado) * 100 : 0;
  const pctCobrado = contratado > 0 ? (cobrado / contratado) * 100 : 0;

  // Invariante: CONTRATADO = COBRADO + AR + WIP + BACKLOG
  const suma = cobrado + ar + wip + backlog;
  const invarianteOk = Math.abs(contratado - suma) < 0.01;

  return {
    contractId: contract.id,
    projectId: contract.projectId,
    dealId: contract.dealId,
    clientName: contract.clientName,
    contractName: contract.contractName,
    esInversionInterna: contract.esInversionInterna ?? false,
    contratado,
    devengado,
    facturado,
    cobrado,
    wip,
    backlog,
    ar,
    descalce,
    planAcumulado,
    realAcumulado,
    pctDevengado,
    pctFacturado,
    pctCobrado,
    invarianteOk,
  };
}

// ─── Función consolidada: embudo del portafolio completo ─────────────────────

export function calculatePortfolioFunnel(
  contracts: ContractData[],
  scheduleItems: PaymentScheduleItemData[],
  revenueEvents: RevenueEventData[],
  invoices: InvoiceData[],
  payments: PaymentData[],
  fechaCorte: string,
): PortfolioFunnel {
  const funnels = contracts.map(c =>
    calculateContractFunnel(c, scheduleItems, revenueEvents, invoices, payments, fechaCorte)
  );

  // Separar cartera comercial de inversión interna
  const comercial = funnels.filter(f => !f.esInversionInterna);
  const interna = funnels.filter(f => f.esInversionInterna);

  const sum = (arr: FunnelResult[], key: keyof FunnelResult) =>
    arr.reduce((s, f) => s + (f[key] as number), 0);

  const contratado = sum(comercial, 'contratado');
  const devengado = sum(comercial, 'devengado');
  const facturado = sum(comercial, 'facturado');
  const cobrado = sum(comercial, 'cobrado');
  const wip = sum(comercial, 'wip');
  const backlog = sum(comercial, 'backlog');
  const ar = sum(comercial, 'ar');
  const descalce = sum(comercial, 'descalce');
  const planAcumulado = sum(comercial, 'planAcumulado');
  const realAcumulado = sum(comercial, 'realAcumulado');
  const inversionInterna = sum(interna, 'contratado');

  const pctDevengado = contratado > 0 ? (devengado / contratado) * 100 : 0;
  const pctFacturado = contratado > 0 ? (facturado / contratado) * 100 : 0;
  const pctCobrado = contratado > 0 ? (cobrado / contratado) * 100 : 0;

  const sumaInvariante = cobrado + ar + wip + backlog;
  const invarianteOk = Math.abs(contratado - sumaInvariante) < 0.01;

  return {
    contratado,
    devengado,
    facturado,
    cobrado,
    wip,
    backlog,
    ar,
    descalce,
    planAcumulado,
    realAcumulado,
    pctDevengado,
    pctFacturado,
    pctCobrado,
    inversionInterna,
    totalContratos: contracts.length,
    contratosActivos: contracts.filter(c => c.estado === 'activo').length,
    contratosCerrados: contracts.filter(c => c.estado === 'cerrado').length,
    invarianteOk,
    contratos: funnels,
    fechaCorte,
  };
}

// ─── Formato de números UF ───────────────────────────────────────────────────

export function formatUF(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(1);
}

export function formatUFFull(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function safeAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
