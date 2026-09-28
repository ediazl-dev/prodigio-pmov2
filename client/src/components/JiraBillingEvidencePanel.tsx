import type { RouterOutputs } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, ExternalLink, FileQuestion, ReceiptText } from "lucide-react";
import React from "react";

export type JiraBillingEvidenceData = RouterOutputs["jira"]["billingEvidence"];

type Props = {
  evidence?: JiraBillingEvidenceData;
  loading?: boolean;
  title?: string;
};

function formatAmount(amount: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(amount)}`;
}

function amountsLabel(rows: Array<{ currency: string; amount: number }>) {
  if (rows.length === 0) return "N/D";
  return rows.map(row => formatAmount(row.amount, row.currency)).join(" · ");
}

function formatDate(value: string | null) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function StatusBadge({ status, label }: { status: "billed" | "not_billed" | "unknown"; label: string }) {
  const style = status === "billed"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "not_billed"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${style}`}>{label}</span>;
}

export function JiraBillingEvidencePanel({ evidence, loading = false, title = "Facturación operacional por hito" }: Props) {
  if (loading) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Consultando estado de facturación en Jira…</section>;
  }
  if (!evidence) return null;

  const sourceLabel = evidence.sourceProjectKeys.length > 0 ? evidence.sourceProjectKeys.join(" · ") : "sin proyecto Jira identificado";
  const usesBillingField = evidence.items.some(item => item.billingStatusSource === "jira_custom_field");
  const usesWorkflowFallback = evidence.items.some(item => item.billingStatusSource === "jira_billing_issue_status");
  const statusSourceText = usesBillingField && usesWorkflowFallback
    ? `Estado por hito desde ${evidence.field.name}; los tickets inequívocos sin ese campo usan su workflow como fallback.`
    : usesBillingField
      ? `Estado por hito desde ${evidence.field.name}.`
      : usesWorkflowFallback
        ? "El proyecto no usa Estado de Facturación; se considera el workflow sólo en tickets inequívocos de facturación."
        : "No hay evidencia Jira suficiente para determinar el estado de facturación.";
  return (
    <section aria-labelledby={`jira-billing-${evidence.entityType}-${evidence.entityId}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-start gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><ReceiptText size={19} /></div>
        <div className="min-w-[220px] flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Fuente Jira · sólo lectura</p>
          <h2 id={`jira-billing-${evidence.entityType}-${evidence.entityId}`} className="mt-1 text-[15px] font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            {statusSourceText} Fuente: <b>{sourceLabel}</b>. No equivale a factura tributaria ni acredita cobro.
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${evidence.jiraAvailable ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {evidence.jiraAvailable ? "Jira disponible" : "Jira no disponible"}
        </span>
      </header>

      <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Facturado según Jira" value={amountsLabel(evidence.summary.billedByCurrency)} note={`${evidence.summary.billedItems}/${evidence.summary.totalItems} hito(s)`} tone="green" />
        <Metric label="No facturado según Jira" value={amountsLabel(evidence.summary.notBilledByCurrency)} note={`${evidence.summary.notBilledItems}/${evidence.summary.totalItems} hito(s)`} tone="amber" />
        <Metric label="Estado N/D" value={String(evidence.summary.unknownItems)} note="Sin evidencia de facturación suficiente" tone="slate" />
        <Metric label="Cobertura de monto" value={`${evidence.summary.amountCoverage.withAmount}/${evidence.summary.amountCoverage.total}`} note={evidence.summary.duplicateGroups > 0 ? `${evidence.summary.duplicateGroups} grupo(s) con duplicados` : "Sin duplicados detectados"} tone="blue" />
      </div>

      {evidence.error && <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-5 py-3 text-xs text-rose-800"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{evidence.error}</div>}

      <div className="divide-y divide-slate-100">
        {evidence.items.map(item => (
          <article key={`${item.code}-${item.key}`} className="grid gap-3 px-5 py-3 md:grid-cols-[minmax(170px,1.5fr)_minmax(130px,.8fr)_minmax(170px,1fr)_110px] md:items-center">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-slate-950">{item.code} · {item.title}</p>
              <p className="mt-1 text-[10px] text-slate-500">Vence {formatDate(item.dueDate)} · Jira {item.jiraStatusName ?? "N/D"}</p>
            </div>
            <div>
              <p className="font-mono text-sm font-black text-slate-950">{item.amount != null && item.currency ? formatAmount(item.amount, item.currency) : "Monto N/D"}</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-500">{item.amountSource === "sale_weight" ? "Venta UF × peso" : item.amountSource === "billing_milestone" ? "Hito contractual" : item.amountSource === "billing_schedule" ? "Calendario contractual" : "Sin monto trazable"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={item.billingStatus} label={item.billingStatusLabel} />
              {item.duplicateCandidates.length > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700"><AlertTriangle size={12} /> {item.duplicateCandidates.length} duplicado(s) no sumado(s)</span>}
            </div>
            {item.jiraUrl ? <a href={item.jiraUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-end gap-1 text-[11px] font-black text-cyan-700 hover:text-cyan-900">{item.key}<ExternalLink size={12} /></a> : <span className="text-right text-[10px] font-bold text-slate-400">Sin vínculo Jira</span>}
          </article>
        ))}
        {evidence.items.length === 0 && <div className="flex items-center gap-2 px-5 py-5 text-sm text-slate-600"><FileQuestion size={17} /> No hay hitos de facturación identificados.</div>}
      </div>

      {evidence.warnings.length > 0 && (
        <details className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-[11px] text-amber-900">
          <summary className="cursor-pointer font-black">Advertencias de conciliación ({evidence.warnings.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">{evidence.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        </details>
      )}
      <footer className="flex items-center gap-2 border-t border-slate-200 px-5 py-2.5 text-[10px] text-slate-500">
        <CheckCircle2 size={13} className="text-cyan-700" /> Evidencia Jira actualizada {formatDate(evidence.evidenceAt)}. La planilla corporativa permanece como fuente del análisis financiero histórico y consolidado.
      </footer>
    </section>
  );
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: "green" | "amber" | "slate" | "blue" }) {
  const toneClass = tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : tone === "blue" ? "text-cyan-700" : "text-slate-700";
  return <article className="rounded-xl border border-slate-200 bg-white p-3">
    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
    <p className={`mt-1 font-mono text-lg font-black ${toneClass}`}>{value}</p>
    <p className="mt-1 text-[10px] text-slate-500">{note}</p>
  </article>;
}
