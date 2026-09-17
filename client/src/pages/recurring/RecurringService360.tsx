import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Banknote,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  DatabaseZap,
  FileCheck2,
  FileWarning,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

type Health = "critical" | "attention" | "stable" | "no_data";

const HEALTH: Record<Health, { label: string; text: string; bg: string; border: string }> = {
  critical: { label: "Crítico", text: "text-red-800", bg: "bg-red-50", border: "border-red-200" },
  attention: { label: "Requiere atención", text: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200" },
  stable: { label: "Estable", text: "text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200" },
  no_data: { label: "Sin datos", text: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" },
};

const REPORT_STATUS: Record<string, string> = {
  accepted: "Aceptado",
  delivered: "Entregado",
  completed_without_evidence: "Completado sin evidencia",
  rejected: "Rechazado",
  waived: "Eximido",
  overdue: "Vencido",
  planned: "Planificado",
  unscheduled_evidence: "Evidencia sin hito",
};

const DOCUMENT_STATUS: Record<string, string> = {
  valid: "Vigente",
  pending: "Pendiente de validación",
  unvalidated: "Presente sin validar",
  expired: "Vencido",
  rejected: "Rechazado",
  missing: "Faltante",
};

function money(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value)}`;
}

function percent(value: number | null) {
  return value === null ? "N/D" : `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value)}%`;
}

function date(value: string | null) {
  if (!value) return "N/D";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("es-CL");
}

function Metric({ label, value, detail, tone = "text-slate-950" }: { label: string; value: string | number; detail?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone}`}>{value}</p>
      {detail && <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>}
    </div>
  );
}

function EmptyEvidence({ children }: { children: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{children}</div>;
}

export function RecurringService360({ serviceId }: { serviceId: number }) {
  const cutOffDate = new Date().toISOString().slice(0, 10);
  const query = trpc.recurringServices.dashboardV2.useQuery({ serviceId, cutOffDate });

  if (query.isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Loader2 size={16} className="animate-spin" /> Construyendo vista 360°…</div>
      </section>
    );
  }

  if (query.error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 text-red-700" size={18} />
          <div><p className="font-bold text-red-900">No fue posible cargar la vista 360°</p><p className="mt-1 text-sm text-red-700">{query.error.message}</p></div>
        </div>
      </section>
    );
  }

  const data = query.data;
  const service = data?.matrix[0];
  if (!data || !service) return <EmptyEvidence>El servicio no forma parte del universo disponible para la fecha de corte.</EmptyEvidence>;

  const health = HEALTH[service.health as Health];
  const finance = data.financeAnalytics.services[0];
  const deliverables = data.deliverables.rows[0];
  const documents = data.documents.services[0];
  const quality = service.quality;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.06)]">
      <div className="bg-[#0A1628] px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Vista 360°</span>
              <Badge className={`${health.bg} ${health.text} border ${health.border}`}>{health.label}</Badge>
              <Badge className="border border-white/15 bg-white/10 text-white">Corte {date(data.metadata.cutOffDate)}</Badge>
            </div>
            <h2 className="mt-3 text-xl font-black tracking-tight sm:text-2xl">Control integral del servicio</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">Finanzas, entregables, formalidad, incidentes, SLA y calidad de datos en una lectura trazable.</p>
          </div>
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching} className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            {query.isFetching ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Actualizar lectura
          </Button>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[9px] font-bold uppercase text-slate-400">Cobertura evidencia</p><p className="mt-1 text-2xl font-black">{service.evidenceCoveragePercent}%</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[9px] font-bold uppercase text-slate-400">Calidad de datos</p><p className="mt-1 text-2xl font-black">{quality.score}%</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[9px] font-bold uppercase text-slate-400">Reportes vencidos</p><p className="mt-1 text-2xl font-black">{service.reports.overdue}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[9px] font-bold uppercase text-slate-400">Incidentes abiertos</p><p className="mt-1 text-2xl font-black">{service.incidents.open ?? "N/D"}</p></div>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <div className="overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 sm:px-6">
          <TabsList className="h-auto min-w-max justify-start gap-1 bg-transparent py-3">
            <TabsTrigger value="summary"><Gauge size={14} /> Resumen</TabsTrigger>
            <TabsTrigger value="finance"><CircleDollarSign size={14} /> Financiero</TabsTrigger>
            <TabsTrigger value="deliverables"><CalendarCheck2 size={14} /> Entregables</TabsTrigger>
            <TabsTrigger value="sla"><DatabaseZap size={14} /> SLA e incidentes</TabsTrigger>
            <TabsTrigger value="evidence"><FileCheck2 size={14} /> Evidencias</TabsTrigger>
          </TabsList>
        </div>

        <div className="p-4 sm:p-6">
          <TabsContent value="summary" className="mt-0 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Estado de salud" value={health.label} tone={health.text} />
              <Metric label="Tipo de servicio" value={service.serviceType} />
              <Metric label="Etapa vigente" value={service.currentStage} />
              <Metric label="Deal" value={service.dealId ?? "N/D"} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><AlertTriangle size={16} className="text-amber-600" /> Señales de gestión</h3>
                {service.healthSignals.length === 0 ? <div className="mt-3"><EmptyEvidence>Sin alertas activas para la evidencia disponible.</EmptyEvidence></div> : (
                  <ul className="mt-3 space-y-2">{service.healthSignals.map(signal => <li key={signal.code} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>{signal.code}</b> · {signal.message}</li>)}</ul>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><ShieldCheck size={16} className="text-[#175CD3]" /> Calidad de datos</h3>
                <div className="mt-3 grid grid-cols-2 gap-2"><Metric label="Dimensiones confiables" value={`${quality.trustedDimensions}/${quality.totalDimensions}`} /><Metric label="Hallazgos" value={quality.issues.length} /></div>
                {quality.issues.length > 0 && <ul className="mt-3 space-y-2">{quality.issues.map(issue => <li key={issue.code} className="text-xs leading-5 text-slate-600"><b className="text-slate-900">{issue.dimension}:</b> {issue.message}</li>)}</ul>}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="finance" className="mt-0 space-y-4">
            {Object.values(service.financeByCurrency).length === 0 ? <EmptyEvidence>Sin planificación financiera para este servicio.</EmptyEvidence> : (
              <div className="grid gap-3 lg:grid-cols-2">{Object.values(service.financeByCurrency).map(row => (
                <article key={row.currency} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between"><Badge className="bg-[#0A1628] text-white">{row.currency}</Badge>{row.overdueItems > 0 && <span className="text-xs font-bold text-red-700">{row.overdueItems} cuota(s) vencida(s)</span>}</div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Contratado" value={money(row.contracted, row.currency)} /><Metric label="Programado" value={money(row.scheduled, row.currency)} /><Metric label="Facturado" value={money(row.invoiced, row.currency)} tone="text-[#175CD3]" /><Metric label="Cobrado" value={money(row.collected, row.currency)} tone="text-emerald-700" /></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><span>CxC <b>{money(row.accountsReceivable, row.currency)}</b></span><span>Pendiente <b>{money(row.pending, row.currency)}</b></span><span className={row.overdue > 0 ? "text-red-700" : ""}>Vencido <b>{money(row.overdue, row.currency)}</b></span></div>
                </article>
              ))}</div>
            )}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Banknote size={16} /> Reconciliación por Deal</h3>
              <p className="mt-2 text-sm text-slate-600">Estado: <b className="text-slate-950">{finance?.reconciliationStatus ?? "N/D"}</b>. Evidencias verificadas: <b>{finance?.verifiedEvidenceByCurrency.reduce((sum, row) => sum + row.items, 0) ?? 0}</b>.</p>
              {finance?.corporateReference ? <p className="mt-2 text-xs text-slate-500">Referencia corporativa: {finance.corporateReference.valorVentaUF === null ? "N/D" : money(finance.corporateReference.valorVentaUF, "UF")} · sincronizada {date(finance.corporateReference.syncedAt)}</p> : <p className="mt-2 text-xs text-amber-700">No existe una referencia financiera corporativa única para este Deal.</p>}
            </div>
          </TabsContent>

          <TabsContent value="deliverables" className="mt-0">
            {!deliverables || deliverables.cells.length === 0 ? <EmptyEvidence>No existen reportes mensuales planificados o evidencias registradas.</EmptyEvidence> : (
              <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">Período</th><th className="px-4 py-3">Vencimiento</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Entrega</th><th className="px-4 py-3">Aceptación</th><th className="px-4 py-3">Puntualidad</th></tr></thead><tbody>{deliverables.cells.map((cell, index) => <tr key={`${cell.period}-${cell.evidenceId ?? cell.workPlanItemId ?? index}`} className="border-t border-slate-100"><td className="px-4 py-3 font-bold text-slate-900">{cell.period}</td><td className="px-4 py-3">{date(cell.dueDate)}</td><td className="px-4 py-3"><Badge variant="outline">{REPORT_STATUS[cell.status] ?? cell.status}</Badge></td><td className="px-4 py-3">{date(cell.deliveredAt)}</td><td className="px-4 py-3">{date(cell.acceptedAt)}</td><td className="px-4 py-3">{cell.deliveryTiming === "on_time" ? "A tiempo" : cell.deliveryTiming === "late" ? "Atrasado" : "N/D"}</td></tr>)}</tbody></table></div>
            )}
          </TabsContent>

          <TabsContent value="sla" className="mt-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Incidentes observados" value={service.incidents.total ?? "N/D"} /><Metric label="Abiertos" value={service.incidents.open ?? "N/D"} /><Metric label="Críticos" value={service.incidents.criticalOpen ?? "N/D"} tone="text-red-700" /><Metric label="Vencidos" value={service.incidents.overdueOpen ?? "N/D"} tone="text-red-700" /></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Abiertos +30 días" value={service.incidents.unresolvedOver30Days ?? "N/D"} /><Metric label="Primera respuesta" value={percent(service.sla.firstResponseCompliance)} /><Metric label="Resolución" value={percent(service.sla.resolutionCompliance)} /><Metric label="Reglas configuradas" value={service.sla.configuredRules} /></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p><b className="text-slate-900">Disponibilidad:</b> {service.incidents.availability}</p><p className="mt-1"><b className="text-slate-900">Última medición:</b> {date(service.incidents.observedAt)}</p></div>
          </TabsContent>

          <TabsContent value="evidence" className="mt-0 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {documents?.documents.map(document => (
                <article key={document.docType} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-black capitalize text-slate-950">{document.status === "valid" ? <CheckCircle2 size={16} className="text-emerald-600" /> : <FileWarning size={16} className="text-amber-600" />}{document.docType}</h3><Badge variant="outline">{DOCUMENT_STATUS[document.status] ?? document.status}</Badge></div>
                  <p className="mt-3 text-xs text-slate-500">Vigencia: {date(document.validUntil)} · Validado: {date(document.validatedAt)}</p>
                </article>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Controles documentales" value={data.evidenceInventory.documentControls} /><Metric label="Evidencias de reporte" value={data.evidenceInventory.reportEvidence} /><Metric label="Evidencias financieras" value={data.evidenceInventory.financialEvidence} /><Metric label="Snapshots JSM" value={data.evidenceInventory.jsmSnapshots} /></div>
            <p className="flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14} /> La evidencia faltante permanece visible como N/D o pendiente; la vista no infiere cumplimiento.</p>
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
