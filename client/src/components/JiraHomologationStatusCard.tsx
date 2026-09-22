import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FolderSync,
  Landmark,
  ListChecks,
  Loader2,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

type HomologationException = {
  id: number;
  domain: string;
  sourceKey: string | null;
  reason: string;
  severity: string;
  title: string;
  whatHappened: string;
  impact: string;
  recommendedAction: string;
  blocksSync: boolean;
};

type JiraReconciliationRun = {
  id: number;
  source: string;
  status: string;
  inputCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errorMessage: string | null;
  finishedAt: Date | string | null;
  createdAt: Date | string;
  details: { jiraRead?: { requestedCount?: number; returnedCount?: number } } | null;
};

type HomologationGap = {
  kind: "governance" | "document" | "mapping" | "financial";
  severity: "info" | "warning" | "blocking";
  label: string;
  explanation: string;
  recommendedAction: string;
  blocksSync: boolean;
};

type CoverageItem = {
  key: string;
  label: string;
  status: "available" | "partial" | "missing";
  detail: string;
};

type FinancialStatus = {
  status: "available" | "not_found" | "unlinked";
  dealId: string | null;
  dealSource: "project_field" | "contract_link" | "name_match" | null;
  formallyLinked: boolean;
  sourceLabel: string | null;
  syncedAt: Date | string | null;
  currency: "UF" | null;
  contractedUf: number | null;
  budgetUf: number | null;
  consumedUf: number | null;
  projectedCostUf: number | null;
  projectedMarginUf: number | null;
  projectedMarginPct: number | null;
  capacityProjectedUf: number | null;
};

export type JiraHomologationStatus = {
  project: { dealId: string | null; projectName: string };
  onboarding: { status: string; jiraProjectKey: string } | null;
  latestRun: { status: string; finishedAt: Date | string | null; createdAt: Date | string } | null;
  latestReconciliation: JiraReconciliationRun | null;
  reconciliationHistory: JiraReconciliationRun[];
  history: {
    recentRuns: JiraReconciliationRun[];
    totalRuns: number;
    hasMore: boolean;
    visibleLimit: number;
    statusCounts: { applied: number; partial: number; error: number; running: number };
  };
  counts: {
    risks: { imported: number; mapped: number };
    wbs: { imported: number; mapped: number };
    documents: { sow: number; gantt: number; milestoneAcceptances: number };
    openExceptions: number;
  };
  financial: FinancialStatus;
  coverage: CoverageItem[];
  gaps: HomologationGap[];
  exceptions: HomologationException[];
  pending: string[];
};

const DOMAIN_LABELS: Record<string, string> = {
  milestones: "Hitos",
  risks: "Riesgos",
  planning: "Backlog",
  documents: "Documentos",
  finance: "Finanzas",
};

const RUN_STATUS_LABELS: Record<string, string> = {
  applied: "Completada",
  partial: "Completada con revisión",
  error: "No completada",
  running: "En curso",
};

const RUN_SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  scheduled: "Programada",
  retry: "Reintento",
};

function formatRunDate(value: Date | string | null | undefined) {
  if (!value) return "N/D";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "N/D" : date.toLocaleString("es-CL");
}

function formatUf(value: number | null) {
  if (value == null) return "N/D";
  return `UF ${new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

function formatPercent(value: number | null) {
  if (value == null) return "N/D";
  return new Intl.NumberFormat("es-CL", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

function runStatusClasses(status: string) {
  if (status === "applied") return "bg-emerald-100 text-emerald-800";
  if (status === "error") return "bg-red-100 text-red-800";
  if (status === "running") return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}

function CountTile({ icon: Icon, label, value, detail }: {
  icon: typeof ShieldAlert;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className="mt-2 text-lg font-extrabold text-slate-900">{value}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

function RunRow({ run }: { run: JiraReconciliationRun }) {
  return (
    <div className="grid gap-2 px-3 py-3 text-[10px] text-slate-700 sm:grid-cols-[150px_82px_150px_1fr] sm:items-center">
      <span className="font-semibold text-slate-700">{formatRunDate(run.finishedAt ?? run.createdAt)}</span>
      <span>{RUN_SOURCE_LABELS[run.source] ?? run.source}</span>
      <span className={`w-fit rounded-full px-2 py-0.5 font-bold ${runStatusClasses(run.status)}`}>{RUN_STATUS_LABELS[run.status] ?? run.status}</span>
      <span className="text-slate-600">
        Jira {run.details?.jiraRead?.returnedCount ?? 0}/{run.details?.jiraRead?.requestedCount ?? run.inputCount}
        {` · ${run.updatedCount} actualizados · ${run.createdCount} creados · ${run.errorCount} casos a revisar`}
        {run.errorMessage ? ` · ${run.errorMessage}` : ""}
      </span>
    </div>
  );
}

function FinancialEvidence({ financial }: { financial: FinancialStatus }) {
  const evidenceLabel = financial.dealSource === "project_field"
    ? "Vinculado en la ficha del proyecto"
    : financial.dealSource === "contract_link"
      ? "Vinculado mediante contrato financiero"
    : financial.dealSource === "name_match" && financial.status === "available"
      ? "Detectado en el nombre · coincide con la planilla"
      : "Asociación financiera pendiente";
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-800">
            <CircleDollarSign className="h-4 w-4 text-[#e91e8c]" aria-hidden="true" />
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.08em]">Evidencia financiera disponible</h3>
          </div>
          <p className="mt-1 text-sm font-extrabold text-slate-900">{financial.dealId ?? "Deal N/D"}</p>
          <p className="mt-0.5 text-[10px] text-slate-600">{evidenceLabel}</p>
        </div>
        <div className="text-right text-[10px] text-slate-500">
          <p>{financial.sourceLabel ?? "Sin fila financiera coincidente"}</p>
          <p>Corte: {formatRunDate(financial.syncedAt)}</p>
        </div>
      </div>
      {financial.status === "available" ? (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <CountTile icon={Landmark} label="Contratado" value={formatUf(financial.contractedUf)} detail="Valor de venta sincronizado" />
            <CountTile icon={CircleDollarSign} label="Costo utilizado" value={formatUf(financial.consumedUf)} detail="Costo consumido a la fecha" />
            <CountTile icon={ListChecks} label="Presupuesto costo" value={formatUf(financial.budgetUf)} detail="Base presupuestaria" />
            <CountTile icon={Clock3} label="Costo proyectado" value={formatUf(financial.projectedCostUf)} detail="Proyección financiera" />
            <CountTile icon={Clock3} label="Capacity proyectada" value={formatUf(financial.capacityProjectedUf)} detail="Plan de capacidad vigente" />
            <CountTile icon={CheckCircle2} label="Margen proyectado" value={formatPercent(financial.projectedMarginPct)} detail={formatUf(financial.projectedMarginUf)} />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
            Estas cifras provienen de la planilla financiera. No representan facturación SII ni cobros; esos conceptos sólo se muestran cuando existen facturas o pagos verificables.
          </p>
        </>
      ) : (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-900">
          No hay cifras financieras verificables para este proyecto. Se mantiene N/D en vez de asumir cero.
        </p>
      )}
    </div>
  );
}

export function JiraHomologationStatusCardBody({
  status,
  canImport,
  isImporting = false,
  onImport,
  onOpenHistory,
}: {
  status: JiraHomologationStatus;
  canImport: boolean;
  isImporting?: boolean;
  onImport?: () => void;
  onOpenHistory?: () => void;
}) {
  const onboardingReady = status.onboarding?.status === "ready";
  const synchronizedAt = status.latestReconciliation?.finishedAt
    ?? status.latestReconciliation?.createdAt
    ?? status.latestRun?.finishedAt
    ?? status.latestRun?.createdAt;
  const blockingGaps = status.gaps.filter((gap) => gap.blocksSync).length;
  const availableCoverage = status.coverage.filter((item) => item.status === "available").length;

  return (
    <section className="mb-5 rounded-[14px] border border-slate-200 bg-white p-5 shadow-[0_2px_16px_rgba(10,22,40,0.08)]" aria-labelledby="jira-homologation-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FolderSync className="h-5 w-5 text-[#e91e8c]" aria-hidden="true" />
            <h2 id="jira-homologation-title" className="text-sm font-extrabold text-slate-800">Homologación y sincronización Jira → PMO</h2>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${onboardingReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {onboardingReady ? "VÍNCULO LISTO" : "VÍNCULO PENDIENTE"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500">
            La sincronización sólo lee Jira, actualiza el modelo local y conserva baseline y actas. Nunca crea, edita ni transiciona issues en Jira.
          </p>
        </div>
        {canImport ? (
          <Button
            size="sm"
            onClick={onImport}
            disabled={!onboardingReady || isImporting}
            className="bg-[#e91e8c] text-white hover:bg-[#c51678] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100"
          >
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />}
            {isImporting ? "Sincronizando…" : "Sincronizar ahora"}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <CountTile icon={ShieldAlert} label="Riesgos Jira" value={status.counts.risks.mapped > 0 ? `${status.counts.risks.imported}/${status.counts.risks.mapped}` : String(status.counts.risks.imported)} detail={status.counts.risks.mapped > 0 ? "Importados / mappings aprobados" : "Registros con clave Jira · sin mappings exigidos"} />
        <CountTile icon={ListChecks} label="Backlog canónico" value={status.counts.wbs.mapped > 0 ? `${status.counts.wbs.imported}/${status.counts.wbs.mapped}` : String(status.counts.wbs.imported)} detail={status.counts.wbs.mapped > 0 ? "Importados / mappings aprobados" : "Registros con clave Jira · sin mappings exigidos"} />
        <CountTile icon={FileCheck2} label="Evidencia documental" value={`${status.counts.documents.sow + status.counts.documents.gantt + status.counts.documents.milestoneAcceptances}`} detail={`${status.counts.documents.sow} SoW · ${status.counts.documents.gantt} Gantt · ${status.counts.documents.milestoneAcceptances} actas`} />
      </div>

      <FinancialEvidence financial={status.financial} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-600">
        <span><strong>Última lectura Jira:</strong> {formatRunDate(synchronizedAt)}</span>
        <span className={`inline-flex items-center gap-1 font-bold ${blockingGaps > 0 ? "text-red-700" : "text-emerald-700"}`}>
          {blockingGaps > 0 ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
          {blockingGaps > 0 ? `${blockingGaps} condición(es) bloqueante(s)` : "La sincronización no está bloqueada"}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-700">Cobertura y acciones pendientes</h3>
          <span className="text-[10px] font-semibold text-slate-500">{availableCoverage}/{status.coverage.length} fuentes disponibles</span>
        </div>
        {status.gaps.length === 0 ? (
          <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-900">No existen acciones pendientes para completar la homologación.</p>
        ) : (
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {status.gaps.map((gap) => (
              <article key={`${gap.kind}-${gap.label}`} className={`rounded-lg border p-3 ${gap.blocksSync ? "border-red-200 bg-red-50" : gap.severity === "info" ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[11px] font-extrabold text-slate-900">{gap.label}</h4>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${gap.blocksSync ? "bg-red-100 text-red-800" : "bg-white text-slate-700"}`}>{gap.blocksSync ? "BLOQUEA" : "NO BLOQUEA"}</span>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-700">{gap.explanation}</p>
                <p className="mt-2 text-[10px] font-semibold text-slate-800"><span className="text-slate-500">Siguiente acción:</span> {gap.recommendedAction}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      {status.exceptions.length > 0 ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-700">Casos que requieren revisión</h3>
            <span className="text-[10px] text-slate-500">{status.counts.openExceptions} abierto(s)</span>
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {status.exceptions.slice(0, 8).map((exception) => (
              <article key={exception.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[11px] font-extrabold text-slate-900">{exception.title}</h4>
                  <span className="font-mono text-[9px] text-slate-500">{DOMAIN_LABELS[exception.domain] ?? exception.domain} · {exception.sourceKey ?? "Origen N/D"}</span>
                </div>
                <p className="mt-2"><strong>Qué ocurrió:</strong> {exception.whatHappened}</p>
                <p className="mt-1"><strong>Efecto:</strong> {exception.impact}</p>
                <p className="mt-1"><strong>Qué hacer:</strong> {exception.recommendedAction}</p>
                <p className={`mt-2 font-bold ${exception.blocksSync ? "text-red-700" : "text-emerald-700"}`}>{exception.blocksSync ? "Este caso bloquea la sincronización." : "Este caso no bloquea el resto de la sincronización."}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 px-3 py-2">
          <div>
            <h3 className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-700">Historial de sincronización</h3>
            <p className="mt-0.5 text-[9px] text-slate-500">Se muestran las {Math.min(status.history.visibleLimit, status.history.totalRuns)} corridas más recientes de {status.history.totalRuns}.</p>
          </div>
          {onOpenHistory && status.history.totalRuns > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenHistory} className="h-7 bg-white text-[10px]">Ver las {status.history.totalRuns} corridas</Button>
          ) : null}
        </div>
        {status.history.recentRuns.length === 0 ? (
          <p className="px-3 py-4 text-[10px] text-slate-500">Aún no existen sincronizaciones manuales o programadas.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {status.history.recentRuns.map((run) => <RunRow key={run.id} run={run} />)}
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 bg-white px-3 py-2 text-[9px] text-slate-500">
          <span>{status.history.statusCounts.applied} completadas</span>
          <span>{status.history.statusCounts.partial} con revisión</span>
          <span>{status.history.statusCounts.error} no completadas</span>
        </div>
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
        SoW y Gantt se almacenan como documentos del proyecto. Las actas permanecen asociadas a su hito contractual; un cierre Jira no equivale a aceptación del cliente, facturación SII ni cobro.
      </p>
    </section>
  );
}

function JiraHomologationHistoryDialog({ projectId, open, onOpenChange }: { projectId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [page, setPage] = React.useState(1);
  const [source, setSource] = React.useState<"all" | "manual" | "scheduled" | "retry">("all");
  const [runStatus, setRunStatus] = React.useState<"all" | "applied" | "partial" | "error" | "running">("all");
  const historyQuery = trpc.jira.getExistingProjectImportHistory.useQuery(
    { projectId, page, pageSize: 10, source, status: runStatus },
    { enabled: open },
  );
  const history = historyQuery.data;
  const updateSource = (value: string) => { setSource(value as typeof source); setPage(1); };
  const updateStatus = (value: string) => { setRunStatus(value as typeof runStatus); setPage(1); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-hidden bg-white text-slate-900 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Historial completo de sincronización Jira</DialogTitle>
          <DialogDescription>Registro local auditable. La consulta no realiza escrituras en Jira.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <label className="grid gap-1 text-[10px] font-bold text-slate-600">Origen
              <Select value={source} onValueChange={updateSource}>
                <SelectTrigger size="sm" className="w-[150px] bg-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="manual">Manual</SelectItem><SelectItem value="scheduled">Programada</SelectItem><SelectItem value="retry">Reintento</SelectItem></SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-[10px] font-bold text-slate-600">Resultado
              <Select value={runStatus} onValueChange={updateStatus}>
                <SelectTrigger size="sm" className="w-[190px] bg-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="applied">Completada</SelectItem><SelectItem value="partial">Con revisión</SelectItem><SelectItem value="error">No completada</SelectItem><SelectItem value="running">En curso</SelectItem></SelectContent>
              </Select>
            </label>
          </div>
          <div className="flex items-center gap-2" aria-label="Navegación del historial">
            <span className="text-[10px] text-slate-500">Página {history?.page ?? page} de {history?.totalPages ?? 1}</span>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 bg-white" disabled={page <= 1 || historyQuery.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 bg-white" disabled={!history || page >= history.totalPages || historyQuery.isFetching} onClick={() => setPage((current) => current + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="max-h-[58vh] overflow-y-auto rounded-lg border border-slate-200" aria-live="polite">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando historial…</div>
          ) : historyQuery.error ? (
            <p className="px-4 py-6 text-xs text-red-700">No fue posible leer el historial: {historyQuery.error.message}</p>
          ) : !history?.items.length ? (
            <p className="px-4 py-6 text-xs text-slate-500">No hay corridas para estos filtros.</p>
          ) : (
            <div className="divide-y divide-slate-100">{history.items.map((run) => <RunRow key={run.id} run={run as JiraReconciliationRun} />)}</div>
          )}
        </div>
        <p className="text-[10px] text-slate-500">{history?.total ?? 0} corrida(s) encontradas · 10 por página · más reciente primero.</p>
      </DialogContent>
    </Dialog>
  );
}

export function JiraHomologationStatusCard({ projectId, canImport }: { projectId: number; canImport: boolean }) {
  const utils = trpc.useUtils();
  const statusQuery = trpc.jira.getExistingProjectImportStatus.useQuery({ projectId });
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const operationIdRef = React.useRef<string | null>(null);
  const syncMutation = trpc.jira.syncExistingProjectNow.useMutation({
    onSuccess: async (result) => {
      if (result.reused) toast.success("Esta operación ya había sido procesada; no se duplicaron cambios.");
      else if (result.status === "partial") toast.warning(`Sincronización aplicada con ${result.exceptions} casos que requieren revisión.`);
      else toast.success("Sincronización Jira completada.");
      await statusQuery.refetch();
      await utils.projects.get.invalidate({ id: projectId });
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => { operationIdRef.current = null; },
  });

  const synchronizeNow = () => {
    if (syncMutation.isPending) return;
    const operationId = operationIdRef.current ?? `manual:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
    operationIdRef.current = operationId;
    syncMutation.mutate({ projectId, operationId });
  };

  if (statusQuery.isLoading) return <div className="mb-5 h-44 animate-pulse rounded-[14px] border border-slate-200 bg-white" aria-label="Cargando estado de homologación Jira" />;
  if (statusQuery.error) return <div className="mb-5 rounded-[14px] border border-red-200 bg-red-50 p-4 text-xs text-red-800">No fue posible leer el estado de homologación: {statusQuery.error.message}</div>;
  if (!statusQuery.data) return null;

  return (
    <>
      <JiraHomologationStatusCardBody
        status={statusQuery.data as JiraHomologationStatus}
        canImport={canImport}
        isImporting={syncMutation.isPending}
        onImport={synchronizeNow}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      {historyOpen ? <JiraHomologationHistoryDialog projectId={projectId} open={historyOpen} onOpenChange={setHistoryOpen} /> : null}
    </>
  );
}
