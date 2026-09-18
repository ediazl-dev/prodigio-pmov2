/**
 * Los cuatro paneles de evidencia.
 *
 * IMPORTANTE PARA QUIEN IMPLEMENTA: el contenido de estos paneles es, en su
 * mayoría, el MISMO markup que ya existe en RecurringServicesDashboardV2.tsx.
 * No se está rediseñando lo de adentro; se está moviendo de una pila de
 * secciones a pestañas, y se le está aplicando la regla de colapso en N/D.
 *
 * Lo único que cambia de fondo:
 * - OperationsPanel ya no pinta seis casillas en N/D; delega en EmptyDimension.
 * - FinancePanel fusiona "Compromiso financiero" y "Analítica financiera", que
 *   hoy son dos secciones separadas mostrando la misma plata dos veces.
 */

import { CalendarDays, FileWarning, CheckCircle2, DatabaseZap, Link2, ReceiptText, ShieldCheck, TrendingUp, WalletCards, HelpCircle } from "lucide-react";
import { useLocation } from "wouter";
import {
  currencyRows,
  formatCutOffDate,
  formatRecurringMonth,
  formatRecurringMoney,
  formatRecurringPercent,
} from "../recurringDashboardV2ViewModel";
import type { DashboardV2Data, EvidenceTab } from "../recurringDashboardV3ViewModel";
import { EmptyDimension } from "./EmptyDimension";

/* Mapas de etiquetas: idénticos a los de la página actual. */

const RECONCILIATION_LABELS: Record<string, { label: string; className: string }> = {
  comparable: { label: "Conciliado y comparable", className: "bg-emerald-50 text-emerald-800" },
  reference_not_comparable: { label: "Referencia UF no comparable", className: "bg-blue-50 text-blue-800" },
  missing_reference: { label: "Sin referencia corporativa", className: "bg-amber-50 text-amber-900" },
  ambiguous: { label: "Deal ambiguo", className: "bg-red-50 text-red-800" },
  no_deal: { label: "Sin Deal", className: "bg-red-50 text-red-800" },
};

const REPORT_STATUS_UI: Record<string, { label: string; shortLabel: string; className: string }> = {
  accepted: { label: "Aceptado por cliente", shortLabel: "Aceptado", className: "border-emerald-200 bg-emerald-100 text-emerald-900" },
  delivered: { label: "Entregado, pendiente de aceptación", shortLabel: "Entregado", className: "border-blue-200 bg-blue-100 text-blue-900" },
  completed_without_evidence: { label: "Completado sin evidencia", shortLabel: "Sin evidencia", className: "border-amber-300 bg-amber-100 text-amber-950" },
  rejected: { label: "Rechazado", shortLabel: "Rechazado", className: "border-red-300 bg-red-100 text-red-900" },
  waived: { label: "No exigible", shortLabel: "Eximido", className: "border-slate-200 bg-slate-100 text-slate-700" },
  overdue: { label: "Vencido sin entrega", shortLabel: "Vencido", className: "border-red-300 bg-red-50 text-red-900" },
  planned: { label: "Planificado", shortLabel: "Planificado", className: "border-slate-200 bg-white text-slate-600" },
  unscheduled_evidence: { label: "Evidencia sin hito asociado", shortLabel: "No asociado", className: "border-violet-200 bg-violet-50 text-violet-900" },
};

const DOCUMENT_STATUS_UI: Record<string, { label: string; className: string }> = {
  valid: { label: "Vigente y validado", className: "bg-emerald-50 text-emerald-800" },
  pending: { label: "Validación pendiente", className: "bg-amber-50 text-amber-900" },
  unvalidated: { label: "Presente sin control", className: "bg-slate-100 text-slate-700" },
  expired: { label: "Vencido", className: "bg-red-50 text-red-800" },
  rejected: { label: "Rechazado", className: "bg-red-50 text-red-800" },
  missing: { label: "Faltante", className: "bg-red-50 text-red-800" },
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = { contrato: "Contrato", sow: "SoW" };

function EmptyValue({ text = "Sin evidencia disponible" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
      <HelpCircle size={12} /> {text}
    </span>
  );
}

function Stat({ label, value, className = "text-slate-950" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-black ${className}`}>{value}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Financiero — fusión de "Compromiso financiero" y "Analítica financiera"
   ═══════════════════════════════════════════════════════════════════════════ */

export function FinancePanel({ data, tab }: { data: DashboardV2Data; tab: EvidenceTab }) {
  if (!tab.hasEvidence) {
    return (
      <EmptyDimension
        title={tab.emptyTitle}
        reason={tab.emptyReason}
        actionLabel={tab.emptyAction}
        icon={WalletCards}
        restores="Este panel muestra la tendencia mensual y la reconciliación por Deal en cuanto existan cuotas programadas."
      />
    );
  }

  const { kpis, financeAnalytics, trends, metadata } = data;
  const finance = currencyRows(kpis.financeByCurrency);

  return (
    <div className="grid xl:grid-cols-[0.9fr_1.1fr]">
      <div className="border-b border-slate-200 p-5 sm:p-6 xl:border-b-0 xl:border-r">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <TrendingUp size={16} className="text-[#175CD3]" /> Programado vs. facturado y cobrado
          </div>
          <span className="text-[10px] font-semibold text-slate-600">Hasta {formatCutOffDate(metadata.cutOffDate)}</span>
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {finance.map(row => (
            <article key={row.currency} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-[#0A1628] px-2 py-0.5 text-[11px] font-black text-white">{row.currency}</span>
                {row.overdueItems > 0 && (
                  <span className="text-[11px] font-bold text-[#B42318]">
                    {row.overdueItems} cuota{row.overdueItems === 1 ? "" : "s"} vencida{row.overdueItems === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[9px] font-bold uppercase text-slate-500">Contratado</p>
                  <p className="mt-0.5 font-mono text-[13px] font-black text-slate-950">
                    {formatRecurringMoney(row.contracted, row.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-slate-500">Facturado</p>
                  <p className="mt-0.5 font-mono text-[13px] font-black text-[#175CD3]">
                    {formatRecurringMoney(row.invoiced, row.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-slate-500">Cobrado</p>
                  <p className="mt-0.5 font-mono text-[13px] font-black text-[#067647]">
                    {formatRecurringMoney(row.collected, row.currency)}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex justify-between text-[10px] font-semibold text-slate-600">
                <span>CxC {formatRecurringMoney(row.accountsReceivable, row.currency)}</span>
                <span className={row.overdue > 0 ? "text-[#B42318]" : ""}>
                  Vencido {formatRecurringMoney(row.overdue, row.currency)}
                </span>
              </div>
            </article>
          ))}
        </div>

        {trends.finance.length === 0 ? (
          <div className="mt-4">
            <EmptyValue text="Sin cuotas programadas" />
          </div>
        ) : (
          <div className="mt-4 max-h-[280px] space-y-2.5 overflow-y-auto pr-1">
            {trends.finance.map(item => {
              const maxValue = Math.max(item.scheduled, item.invoiced, item.collected, 1);
              return (
                <div key={`${item.month}-${item.currency}`} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <b className="text-xs text-slate-900">{formatRecurringMonth(item.month)}</b>
                    {item.overdue > 0 && (
                      <span className="text-[10px] font-bold text-[#B42318]">
                        Vencido {formatRecurringMoney(item.overdue, item.currency)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1.5 text-[10px] font-semibold text-slate-600">
                    {(
                      [
                        ["Programado", item.scheduled, "#64748B"],
                        ["Facturado", item.invoiced, "#175CD3"],
                        ["Cobrado", item.collected, "#12A08D"],
                      ] as const
                    ).map(([label, value, color]) => (
                      <div key={label} className="grid grid-cols-[68px_1fr_auto] items-center gap-2">
                        <span>{label}</span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <i
                            className="block h-full rounded-full"
                            style={{ width: `${(Number(value) / maxValue) * 100}%`, background: color }}
                          />
                        </span>
                        <b className="font-mono text-slate-800">{formatRecurringMoney(Number(value), item.currency)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Link2 size={16} className="text-[#E91E8C]" /> Reconciliación con la fuente corporativa
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Conciliados" value={`${financeAnalytics.summary.reconciledServices}/${data.kpis.totalServices}`} />
            <Stat label="Fact. verif." value={String(financeAnalytics.summary.verifiedInvoiceEvidence)} />
            <Stat label="Pagos verif." value={String(financeAnalytics.summary.verifiedPaymentEvidence)} />
          </div>
        </div>

        <p className="mt-2 text-[11px] leading-4 text-slate-600">
          La referencia UF se compara solo cuando la moneda contractual también es UF.
        </p>

        <div className="mt-3 max-h-[300px] space-y-2.5 overflow-y-auto pr-1">
          {financeAnalytics.services.map(service => {
            const reconciliation = RECONCILIATION_LABELS[service.reconciliationStatus] ?? RECONCILIATION_LABELS.missing_reference;
            return (
              <article key={service.serviceId} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-slate-950">{service.serviceName}</p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {service.clientName} · Deal {service.dealId ?? "N/D"}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-black ${reconciliation.className}`}>
                    {reconciliation.label}
                  </span>
                </div>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {service.localCurrencies.map(row => (
                    <div key={row.currency} className="rounded-lg bg-slate-50 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-500">Plan local {row.currency}</span>
                        <WalletCards size={14} className="text-slate-400" />
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                        <span className="text-slate-600">Programado</span>
                        <b className="text-right font-mono text-slate-900">{formatRecurringMoney(row.scheduled, row.currency)}</b>
                        <span className="text-slate-600">Facturado</span>
                        <b className="text-right font-mono text-[#175CD3]">{formatRecurringMoney(row.invoiced, row.currency)}</b>
                        <span className="text-slate-600">Cobrado</span>
                        <b className="text-right font-mono text-[#067647]">{formatRecurringMoney(row.collected, row.currency)}</b>
                        <span className="text-slate-600">Vencido</span>
                        <b className={`text-right font-mono ${row.overdue > 0 ? "text-[#B42318]" : "text-slate-900"}`}>
                          {formatRecurringMoney(row.overdue, row.currency)}
                        </b>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-500">Referencia corporativa</span>
                      <ReceiptText size={14} className="text-slate-400" />
                    </div>
                    {service.corporateReference ? (
                      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                        <span className="text-slate-600">Venta</span>
                        <b className="text-right font-mono text-slate-900">
                          {service.corporateReference.valorVentaUF === null ? "N/D" : formatRecurringMoney(service.corporateReference.valorVentaUF, "UF")}
                        </b>
                        <span className="text-slate-600">Utilizado</span>
                        <b className="text-right font-mono text-slate-900">
                          {service.corporateReference.utilizadoUF === null ? "N/D" : formatRecurringMoney(service.corporateReference.utilizadoUF, "UF")}
                        </b>
                        <span className="text-slate-600">Proyectado</span>
                        <b className="text-right font-mono text-slate-900">
                          {service.corporateReference.proyectadoUF === null ? "N/D" : formatRecurringMoney(service.corporateReference.proyectadoUF, "UF")}
                        </b>
                        <span className="text-slate-600">Línea</span>
                        <b className="text-right text-slate-900">{service.corporateReference.lineaNegocio ?? "N/D"}</b>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <EmptyValue text="Deal no presente en la fuente corporativa" />
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Entregables — calendario de cumplimiento, movido tal cual
   ═══════════════════════════════════════════════════════════════════════════ */

export function DeliverablesPanel({ data, tab }: { data: DashboardV2Data; tab: EvidenceTab }) {
  const [, navigate] = useLocation();
  const { deliverables } = data;

  if (!tab.hasEvidence) {
    return (
      <EmptyDimension
        title={tab.emptyTitle}
        reason={tab.emptyReason}
        actionLabel={tab.emptyAction}
        icon={CalendarDays}
        restores="Este panel muestra el calendario mes a mes en cuanto el plan de trabajo tenga hitos de reporte."
      />
    );
  }

  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <CalendarDays size={16} className="text-[#175CD3]" /> Calendario de cumplimiento
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-600">
            Un hito marcado como completado sin respaldo queda visible como excepción.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Exigibles" value={String(deliverables.summary.due)} />
          <Stat label="Entrega" value={formatRecurringPercent(deliverables.summary.deliveryRate)} className="text-[#175CD3]" />
          <Stat label="Aceptación" value={formatRecurringPercent(deliverables.summary.acceptanceRate)} className="text-[#067647]" />
          <Stat label="En plazo" value={formatRecurringPercent(deliverables.summary.onTimeRate)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-bold">
        {Object.entries(REPORT_STATUS_UI)
          .slice(0, 5)
          .map(([key, item]) => (
            <span key={key} className={`rounded-full border px-2 py-1 ${item.className}`}>
              {item.shortLabel}
            </span>
          ))}
      </div>

      <div className="mt-3 overflow-x-auto pb-2">
        <div className="min-w-max">
          <div
            className="grid items-center gap-2"
            style={{ gridTemplateColumns: `minmax(230px, 1fr) repeat(${deliverables.periods.length}, 88px)` }}
          >
            <span className="px-2 text-[9px] font-black uppercase tracking-wide text-slate-500">Servicio</span>
            {deliverables.periods.map(period => (
              <span key={period} className="text-center text-[9px] font-black uppercase text-slate-600">
                {formatRecurringMonth(period)}
              </span>
            ))}
            {deliverables.rows.flatMap(row => [
              <button
                key={`${row.serviceId}-name`}
                type="button"
                onClick={() => navigate(`/recurring-services/${row.serviceId}`)}
                className="rounded-lg px-2 py-2 text-left hover:bg-slate-50"
              >
                <span className="block max-w-[230px] truncate text-xs font-black text-slate-900">{row.serviceName}</span>
                <span className="mt-0.5 block text-[10px] text-slate-600">{row.clientName}</span>
              </button>,
              ...deliverables.periods.map(period => {
                const cell = row.cells.find(item => item.period === period);
                if (!cell) {
                  return (
                    <div
                      key={`${row.serviceId}-${period}`}
                      className="h-12 rounded-lg border border-dashed border-slate-200 bg-slate-50/40"
                      title="Sin reporte planificado"
                    />
                  );
                }
                const visual = REPORT_STATUS_UI[cell.status] ?? REPORT_STATUS_UI.planned;
                const timing = cell.deliveryTiming === "late" ? " · entrega tardía" : cell.deliveryTiming === "on_time" ? " · en plazo" : "";
                return (
                  <div
                    key={`${row.serviceId}-${period}`}
                    title={`${visual.label}${timing}${cell.dueDate ? ` · vence ${cell.dueDate}` : ""}`}
                    className={`grid h-12 place-items-center rounded-lg border px-1 text-center text-[9px] font-black ${visual.className}`}
                  >
                    {visual.shortLabel}
                  </div>
                );
              }),
            ])}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 pt-3 text-[10px] text-slate-600">
        <span>
          <b>{deliverables.summary.deliveredWithEvidence}</b> entregados con evidencia
        </span>
        <span>
          <b>{deliverables.summary.accepted}</b> aceptados
        </span>
        <span className={deliverables.summary.overdue > 0 ? "font-semibold text-[#B42318]" : ""}>
          <b>{deliverables.summary.overdue}</b> excepciones vencidas
        </span>
        <span>
          <b>{deliverables.summary.completedWithoutEvidence}</b> completados sin respaldo
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Formalidad — documentos por servicio, movido tal cual
   ═══════════════════════════════════════════════════════════════════════════ */

export function FormalityPanel({ data, tab }: { data: DashboardV2Data; tab: EvidenceTab }) {
  const [, navigate] = useLocation();
  const { documents } = data;

  if (!tab.hasEvidence) {
    return (
      <EmptyDimension
        title={tab.emptyTitle}
        reason={tab.emptyReason}
        actionLabel={tab.emptyAction}
        icon={ShieldCheck}
        restores="Este panel muestra el estado de contrato y SoW por servicio en cuanto exista al menos un documento cargado."
      />
    );
  }

  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <ShieldCheck size={16} className="text-[#E91E8C]" /> Formalidad documental
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-600">
            Contrato y SoW por servicio. «Presente sin control» significa cargado, pero nunca validado.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#067647]">Vigentes</p>
            <p className="mt-1 font-mono text-lg font-black text-[#067647]">{documents.summary.valid}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#B54708]">Por validar</p>
            <p className="mt-1 font-mono text-lg font-black text-[#B54708]">{documents.summary.pendingValidation}</p>
          </div>
          <div className="rounded-xl border border-slate-200 px-3 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">En riesgo</p>
            <p className="mt-1 font-mono text-lg font-black text-slate-950">
              {documents.summary.missing + documents.summary.expiredOrRejected}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {documents.services.map(service => (
          <div
            key={service.serviceId}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 sm:w-[320px]">
              <div className="flex items-center gap-2">
                <span className="truncate text-[12.5px] font-black text-slate-950">{service.serviceName}</span>
                {service.status === "valid" ? (
                  <CheckCircle2 size={15} className="shrink-0 text-[#067647]" />
                ) : (
                  <FileWarning size={15} className="shrink-0 text-[#B54708]" />
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {service.documents.map(document => {
                const visual = DOCUMENT_STATUS_UI[document.status] ?? DOCUMENT_STATUS_UI.unvalidated;
                return (
                  <span key={document.docType} title={visual.label} className={`rounded-full px-2.5 py-1 text-[10.5px] font-black ${visual.className}`}>
                    {DOCUMENT_TYPE_LABELS[document.docType] ?? document.docType}: {visual.label}
                  </span>
                );
              })}
            </div>
            <div className="flex-grow" />
            <button
              type="button"
              onClick={() => navigate(`/recurring-services/${service.serviceId}`)}
              className="h-8 shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-[11.5px] font-bold text-[#175CD3] transition hover:bg-slate-50"
            >
              Validar documentos
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Operación JSM — el caso que motivó la regla de colapso
   ═══════════════════════════════════════════════════════════════════════════ */

export function OperationsPanel({
  data,
  tab,
  onConfigureJsm,
}: {
  data: DashboardV2Data;
  tab: EvidenceTab;
  onConfigureJsm: () => void;
}) {
  const { kpis } = data;
  const activeWithoutJsm = Math.max(0, kpis.activeServices - kpis.incidents.availableServices);

  if (!tab.hasEvidence) {
    return (
      <EmptyDimension
        title={tab.emptyTitle}
        reason={tab.emptyReason}
        actionLabel={tab.emptyAction}
        onAction={onConfigureJsm}
        icon={DatabaseZap}
        facts={[
          { label: "Snapshots vigentes", value: String(kpis.incidents.availableServices), note: `de ${kpis.activeServices} servicios activos` },
          { label: "Reglas SLA configuradas", value: String(kpis.sla.configuredServices), note: "una regla configurada no es SLA cumplido" },
          { label: "Activos sin medición", value: String(activeWithoutJsm), note: "no aportan incidentes ni SLA" },
        ]}
        restores="Este panel recupera las seis métricas de incidentes y las dos barras de SLA en cuanto exista un snapshot vigente. Mientras no lo haya, ocupa una línea en vez de una pantalla."
      />
    );
  }

  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <DatabaseZap size={16} className="text-[#175CD3]" /> Incidentes, antigüedad y cumplimiento SLA
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-600">
            Lectura consolidada del último snapshot vigente. Una regla configurada no se presenta como SLA cumplido.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700">
          {kpis.incidents.availableServices}/{kpis.activeServices} activos medidos
        </span>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {(
          [
            { label: "Incidentes abiertos", value: kpis.incidents.open, tone: "text-slate-950" },
            { label: "Críticos abiertos", value: kpis.incidents.criticalOpen, tone: "text-[#B42318]" },
            { label: "Altos abiertos", value: kpis.incidents.highOpen, tone: "text-[#B54708]" },
            { label: "Vencidos abiertos", value: kpis.incidents.overdueOpen, tone: "text-[#B42318]" },
            { label: "+30 días abiertos", value: kpis.incidents.unresolvedOver30Days, tone: "text-[#B54708]" },
            { label: "Incidentes observados", value: kpis.incidents.total, tone: "text-[#175CD3]" },
          ] as const
        ).map(item => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className={`mt-2 font-mono text-2xl font-black ${item.tone}`}>{item.value ?? "N/D"}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(
          [
            { label: "Primera respuesta dentro de SLA", value: kpis.sla.firstResponseCompliance },
            { label: "Resolución dentro de SLA", value: kpis.sla.resolutionCompliance },
          ] as const
        ).map(item => (
          <div key={item.label} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-700">{item.label}</span>
              <b className="font-mono text-slate-950">{formatRecurringPercent(item.value)}</b>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#12A08D]" style={{ width: `${item.value ?? 0}%` }} />
            </div>
            {item.value === null && <p className="mt-2 text-[11px] text-slate-600">N/D hasta contar con ciclos SLA medidos.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
