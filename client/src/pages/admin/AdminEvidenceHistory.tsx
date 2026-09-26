import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileClock,
  FileText,
  Filter,
  FolderOpen,
  History,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  C,
  cardStyle,
  footerStyle,
  footerText,
  headerGradient,
  headerKpiCard,
  headerKpiLabel,
  headerKpiValue,
  pageBackground,
  tdStyle,
  thStyle,
} from "./adminStyles";

type EvidenceStatus = "all" | "pending" | "expired" | "attached" | "discarded";
type DocumentType = "all" | "minute" | "acceptance" | "recovery_plan";
type CoverageLifecycle = "all" | "open" | "historical" | "unconfirmed";
type CoverageEntityType = "all" | "project" | "recurring_service";
type CoverageStatus = "all" | "gaps" | "compliant" | "pending_validation" | "missing" | "overdue" | "not_applicable" | "unconfirmed" | "historical_gap";
type CoverageItem = RouterOutputs["executiveEvidenceAdmin"]["coverage"]["items"][number];
type CoverageRequirement = CoverageItem["requirements"][number];

const HISTORY_STATUS_LABELS: Record<Exclude<EvidenceStatus, "all">, string> = {
  pending: "Pendiente",
  expired: "Expirado",
  attached: "Adjuntado",
  discarded: "Descartado",
};

const DOCUMENT_LABELS: Record<Exclude<DocumentType, "all">, string> = {
  minute: "Minuta",
  acceptance: "Acta de aceptación",
  recovery_plan: "Plan de recuperación",
};

const HISTORY_STATUS_COLORS: Record<Exclude<EvidenceStatus, "all">, { background: string; color: string; border: string }> = {
  pending: { background: "#FFF7E6", color: "#9A6700", border: "#F3D596" },
  expired: { background: "#FFF0F0", color: C.red, border: "#F0B8B8" },
  attached: { background: "#EAF8F2", color: C.teal, border: "#A7DCCF" },
  discarded: { background: C.g150, color: C.g400, border: C.g300 },
};

const COVERAGE_STATUS: Record<CoverageRequirement["status"], { label: string; className: string }> = {
  compliant: { label: "Cumple", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  pending_validation: { label: "Pendiente de validación", className: "border-amber-200 bg-amber-50 text-amber-800" },
  missing: { label: "Faltante", className: "border-rose-200 bg-rose-50 text-rose-700" },
  overdue: { label: "Vencido", className: "border-red-300 bg-red-50 text-red-800" },
  not_applicable: { label: "No aplica", className: "border-slate-200 bg-slate-50 text-slate-500" },
  unconfirmed: { label: "Por confirmar", className: "border-sky-200 bg-sky-50 text-sky-700" },
  historical_gap: { label: "Brecha histórica", className: "border-violet-200 bg-violet-50 text-violet-700" },
};

function formatDate(value: string | Date | null | undefined, includeTime = true) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "N/D";
  return date.toLocaleString("es-CL", includeTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "medium" });
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "N/D";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function HistoryStatusBadge({ status }: { status: Exclude<EvidenceStatus, "all"> }) {
  const style = HISTORY_STATUS_COLORS[status];
  return <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, border: `1px solid ${style.border}`, background: style.background, color: style.color, padding: "3px 9px", fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{HISTORY_STATUS_LABELS[status]}</span>;
}

function CoverageBadge({ status }: { status: CoverageRequirement["status"] }) {
  const style = COVERAGE_STATUS[status];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style.className}`}>{style.label}</span>;
}

function KpiCard({ label, value, note, icon: Icon, tone = "sky" }: { label: string; value: string | number; note: string; icon: typeof BarChart3; tone?: "sky" | "emerald" | "amber" | "rose" | "violet" }) {
  const colors = {
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[.08em]">{label}</span><Icon className="h-4 w-4 opacity-70" /></div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{note}</p>
    </div>
  );
}

function RequirementRow({ requirement }: { requirement: CoverageRequirement }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{requirement.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{requirement.detail}</p>
        </div>
        <CoverageBadge status={requirement.status} />
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-400">{requirement.rationale}</p>
      {requirement.dueDate && <p className="mt-2 text-[11px] font-medium text-slate-500">Fecha exigible: {formatDate(requirement.dueDate, false)}</p>}
      {requirement.evidence.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {requirement.evidence.map(item => (
            <span key={item.id} className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">
              <FileCheck2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.fileName || item.label}</span>
              {item.validation && <span className="text-slate-400">· {item.validation}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CoverageEntityCard({ item }: { item: CoverageItem }) {
  const percent = item.coverage.percentage;
  const isHistorical = item.lifecycle === "historical";
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${isHistorical ? "border-violet-200 bg-violet-50 text-violet-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{item.lifecycleLabel}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.entityType === "project" ? "Proyecto" : "Servicio recurrente"}</span>
              {item.dealId && <span className="font-mono text-[10px] text-slate-400">{item.dealId}</span>}
            </div>
            <h3 className="mt-3 break-words text-base font-bold text-slate-900">{item.entityName}</h3>
            <p className="mt-1 text-xs text-slate-500">{item.clientName} · {item.ownerName || "Responsable N/D"}</p>
            <p className="mt-2 max-w-3xl text-[11px] leading-5 text-slate-400">{item.lifecycleReason}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[430px]">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-400">Cobertura</p><p className="mt-1 text-xl font-extrabold text-slate-900">{percent == null ? "N/D" : `${percent}%`}</p></div>
            <div className="rounded-lg bg-emerald-50 p-3"><p className="text-[10px] uppercase tracking-wide text-emerald-700">Cumplen</p><p className="mt-1 text-xl font-extrabold text-slate-900">{item.coverage.compliant}/{item.coverage.required}</p></div>
            <div className="rounded-lg bg-amber-50 p-3"><p className="text-[10px] uppercase tracking-wide text-amber-800">Por validar</p><p className="mt-1 text-xl font-extrabold text-slate-900">{item.coverage.pendingValidation}</p></div>
            <div className="rounded-lg bg-sky-50 p-3"><p className="text-[10px] uppercase tracking-wide text-sky-700">Por confirmar</p><p className="mt-1 text-xl font-extrabold text-slate-900">{item.coverage.unconfirmed}</p></div>
          </div>
        </div>

        {item.lifecycle === "open" && item.activeActions.length > 0 && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="flex items-center gap-2 text-xs font-bold text-rose-800"><AlertTriangle className="h-4 w-4" /> Acciones activas</p>
            <div className="mt-2 space-y-2">
              {item.activeActions.slice(0, 3).map(action => (
                <div key={action.id} className="flex flex-col justify-between gap-2 rounded-md bg-white/70 p-2.5 sm:flex-row sm:items-center">
                  <div><p className="text-xs font-semibold text-slate-800">{action.label}</p><p className="mt-0.5 text-[11px] text-slate-500">{action.impact}</p></div>
                  <Link href={action.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-sky-700 hover:underline">Resolver en detalle <ExternalLink className="h-3.5 w-3.5" /></Link>
                </div>
              ))}
              {item.activeActions.length > 3 && <p className="text-[11px] font-medium text-rose-700">+ {item.activeActions.length - 3} acción(es) adicional(es) en el detalle</p>}
            </div>
          </div>
        )}

        {isHistorical && item.historicalObservations.length > 0 && (
          <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-3">
            <p className="flex items-center gap-2 text-xs font-bold text-violet-800"><Archive className="h-4 w-4" /> Antecedentes del expediente</p>
            <p className="mt-1 text-[11px] leading-5 text-violet-700">Estas brechas no generan acciones operativas automáticas; quedan visibles para completar el expediente histórico.</p>
          </div>
        )}
      </div>
      <details className="border-t border-slate-200 bg-slate-50/60 group">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:px-5">
          Ver {item.requirements.length} requisito(s) y evidencia · Última evidencia {formatDate(item.latestEvidenceAt, false)}
        </summary>
        <div className="grid gap-3 px-4 pb-4 sm:px-5 md:grid-cols-2">
          {item.requirements.map(requirement => <RequirementRow key={requirement.id} requirement={requirement} />)}
        </div>
      </details>
    </article>
  );
}

export default function AdminEvidenceHistory() {
  const { user } = useAuth();
  const canManage = (user as any)?.role === "admin";
  const [activeTab, setActiveTab] = useState("coverage");

  const [coveragePage, setCoveragePage] = useState(1);
  const coveragePageSize = 20;
  const [lifecycle, setLifecycle] = useState<CoverageLifecycle>("open");
  const [entityType, setEntityType] = useState<CoverageEntityType>("all");
  const [coverageStatus, setCoverageStatus] = useState<CoverageStatus>("gaps");
  const [client, setClient] = useState("all");
  const [owner, setOwner] = useState("all");
  const [coverageSearch, setCoverageSearch] = useState("");
  const [debouncedCoverageSearch, setDebouncedCoverageSearch] = useState("");

  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 20;
  const [historyStatus, setHistoryStatus] = useState<EvidenceStatus>("pending");
  const [documentType, setDocumentType] = useState<DocumentType>("all");
  const [projectId, setProjectId] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");
  const [discardTarget, setDiscardTarget] = useState<any>(null);
  const [discardReason, setDiscardReason] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCoverageSearch(coverageSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [coverageSearch]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedHistorySearch(historySearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [historySearch]);
  useEffect(() => setCoveragePage(1), [lifecycle, entityType, coverageStatus, client, owner, debouncedCoverageSearch]);
  useEffect(() => setHistoryPage(1), [historyStatus, documentType, projectId, debouncedHistorySearch]);

  const coverageInput = useMemo(() => ({
    page: coveragePage,
    pageSize: coveragePageSize,
    lifecycle,
    entityType,
    coverageStatus,
    ...(client !== "all" ? { client } : {}),
    ...(owner !== "all" ? { owner } : {}),
    ...(debouncedCoverageSearch ? { search: debouncedCoverageSearch } : {}),
  }), [coveragePage, coveragePageSize, lifecycle, entityType, coverageStatus, client, owner, debouncedCoverageSearch]);

  const historyInput = useMemo(() => ({
    page: historyPage,
    pageSize: historyPageSize,
    status: historyStatus,
    ...(documentType !== "all" ? { documentType } : {}),
    ...(projectId !== "all" ? { projectId: Number(projectId) } : {}),
    ...(debouncedHistorySearch ? { search: debouncedHistorySearch } : {}),
  }), [historyPage, historyPageSize, historyStatus, documentType, projectId, debouncedHistorySearch]);

  const utils = trpc.useUtils();
  const coverageQuery = trpc.executiveEvidenceAdmin.coverage.useQuery(coverageInput, { enabled: activeTab === "coverage", refetchOnWindowFocus: true });
  const listQuery = trpc.executiveEvidenceAdmin.list.useQuery(historyInput, { enabled: activeTab === "history", refetchOnWindowFocus: true });
  const historySummaryQuery = trpc.executiveEvidenceAdmin.summary.useQuery(undefined, { enabled: activeTab === "history", refetchOnWindowFocus: true });
  const projectsQuery = trpc.executiveEvidenceAdmin.projects.useQuery(undefined, { enabled: activeTab === "history", refetchOnWindowFocus: true });

  const discardMutation = trpc.executiveEvidenceAdmin.discard.useMutation({
    onSuccess: async () => {
      toast.success("Documento pendiente descartado");
      setDiscardTarget(null);
      setDiscardReason("");
      await Promise.all([utils.executiveEvidenceAdmin.list.invalidate(), utils.executiveEvidenceAdmin.summary.invalidate(), utils.executiveEvidenceAdmin.coverage.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const restoreMutation = trpc.executiveEvidenceAdmin.restore.useMutation({
    onSuccess: async () => {
      toast.success("Documento restaurado como pendiente");
      await Promise.all([utils.executiveEvidenceAdmin.list.invalidate(), utils.executiveEvidenceAdmin.summary.invalidate(), utils.executiveEvidenceAdmin.coverage.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });

  const refreshAll = async () => {
    if (activeTab === "coverage") await coverageQuery.refetch();
    else await Promise.all([listQuery.refetch(), historySummaryQuery.refetch(), projectsQuery.refetch()]);
  };

  const coverageData = coverageQuery.data;
  const coverageTotalPages = coverageData?.pagination.totalPages ?? 1;
  const historyItems = listQuery.data?.items ?? [];
  const historyTotal = listQuery.data?.total ?? 0;
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize));
  const historySummary = historySummaryQuery.data;

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden" style={pageBackground}>
      <header style={{ ...headerGradient, padding: "30px clamp(18px, 3vw, 36px) 26px" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-sky-400/30 bg-sky-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-sky-300">Reportes</span>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-extrabold text-white sm:text-[26px]"><ShieldCheck className="h-6 w-6" style={{ color: C.accent }} /> Cobertura y cumplimiento documental</h1>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-white/55">Responde qué expediente cumple, qué evidencia falta, qué requiere validación y qué brechas históricas deben preservarse.</p>
            {!canManage && <p className="mt-2 text-xs font-semibold text-sky-200">Modo de consulta: la gestión de recibos técnicos está reservada a administradores.</p>}
          </div>
          <Button variant="outline" onClick={refreshAll} disabled={coverageQuery.isFetching || listQuery.isFetching} className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <RefreshCw className={`mr-2 h-4 w-4 ${(coverageQuery.isFetching || listQuery.isFetching) ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>
        {activeTab === "coverage" && (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: "Entidades evaluadas", value: coverageData?.summary.entities ?? 0, note: "Según filtros actuales" },
              { label: "Cobertura medible", value: coverageData?.summary.averageCoveragePct == null ? "N/D" : `${coverageData.summary.averageCoveragePct}%`, note: "Sólo requisitos exigibles" },
              { label: "Con brechas activas", value: coverageData?.summary.entitiesWithActiveGaps ?? 0, note: "Proyectos/servicios abiertos" },
              { label: "Expedientes históricos", value: coverageData?.summary.historicalFilesWithGaps ?? 0, note: "Brechas sin acción automática" },
              { label: "Pendientes de validar", value: coverageData?.summary.pendingValidation ?? 0, note: "Archivo presente, no acreditado" },
            ].map(card => <div key={card.label} style={headerKpiCard}><div style={headerKpiLabel}>{card.label}</div><div style={headerKpiValue}>{card.value}</div><p className="mt-1 text-[10px] text-white/40">{card.note}</p></div>)}
          </div>
        )}
      </header>

      <main className="flex min-w-0 flex-col gap-5 p-4 sm:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
            <TabsTrigger value="coverage" className="px-4 py-2"><BarChart3 className="h-4 w-4" /> Cobertura documental</TabsTrigger>
            <TabsTrigger value="history" className="px-4 py-2"><History className="h-4 w-4" /> Historial de cargas</TabsTrigger>
          </TabsList>

          <TabsContent value="coverage" className="mt-3 space-y-5">
            <section style={{ ...cardStyle, padding: "16px 18px" }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: C.navy }}><Filter className="h-4 w-4" /> Alcance y filtros</h2><p className="mt-1 text-[11px] text-slate-500">Corte {formatDate(coverageData?.cutoffAt, false)} · Abiertos e históricos se evalúan por separado.</p></div>
                <button type="button" onClick={() => { setLifecycle("open"); setEntityType("all"); setCoverageStatus("gaps"); setClient("all"); setOwner("all"); setCoverageSearch(""); }} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"><X className="h-3.5 w-3.5" /> Restablecer</button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={coverageSearch} onChange={event => setCoverageSearch(event.target.value)} placeholder="Nombre, cliente, Deal o PMO-ID" className="pl-9" /></div>
                <Select value={lifecycle} onValueChange={value => setLifecycle(value as CoverageLifecycle)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Abiertos</SelectItem><SelectItem value="historical">Históricos</SelectItem><SelectItem value="all">Todos</SelectItem><SelectItem value="unconfirmed">Por confirmar</SelectItem></SelectContent></Select>
                <Select value={entityType} onValueChange={value => setEntityType(value as CoverageEntityType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Proyectos y servicios</SelectItem><SelectItem value="project">Sólo proyectos</SelectItem><SelectItem value="recurring_service">Sólo servicios recurrentes</SelectItem></SelectContent></Select>
                <Select value={coverageStatus} onValueChange={value => setCoverageStatus(value as CoverageStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gaps">Con brechas o pendientes</SelectItem><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="compliant">Cumplimiento completo</SelectItem><SelectItem value="pending_validation">Pendiente de validación</SelectItem><SelectItem value="missing">Faltante</SelectItem><SelectItem value="overdue">Vencido</SelectItem><SelectItem value="unconfirmed">Por confirmar</SelectItem><SelectItem value="historical_gap">Brecha histórica</SelectItem></SelectContent></Select>
                <Select value={client} onValueChange={setClient}><SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los clientes</SelectItem>{(coverageData?.options.clients ?? []).map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
                <Select value={owner} onValueChange={setOwner}><SelectTrigger><SelectValue placeholder="Responsable" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los responsables</SelectItem>{(coverageData?.options.owners ?? []).map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard label="Abiertos" value={coverageData?.summary.open ?? 0} note="Activos y pausados" icon={FolderOpen} tone="emerald" />
              <KpiCard label="Históricos" value={coverageData?.summary.historical ?? 0} note="Completados o cancelados" icon={Archive} tone="violet" />
              <KpiCard label="Actas faltantes" value={coverageData?.summary.closedMilestonesWithoutAcceptance ?? 0} note="Cierres exigibles sin aceptación" icon={FileClock} tone="rose" />
              <KpiCard label="Reportes vencidos" value={coverageData?.summary.overdueServiceReports ?? 0} note="Períodos persistidos no cumplidos" icon={Clock3} tone="amber" />
              <KpiCard label="Por confirmar" value={coverageData?.summary.unconfirmed ?? 0} note="Entidades sin estado operativo" icon={CircleHelp} tone="sky" />
            </section>

            {(coverageData?.quality.orphanSowCount ?? 0) > 0 && (
              <section className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
                <p className="font-bold">Calidad de datos: {coverageData?.quality.orphanSowCount} SoW históricos sin entidad vigente</p>
                <p className="mt-1 text-xs leading-5">Se preservan para auditoría, pero no se asignan a proyectos ni afectan la cobertura de entidades activas.</p>
              </section>
            )}

            {coverageQuery.isLoading && <section style={{ ...cardStyle, padding: 40 }} className="flex items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw className="h-5 w-5 animate-spin" /> Consolidando evidencia documental...</section>}
            {coverageQuery.error && <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{coverageQuery.error.message}</section>}
            {!coverageQuery.isLoading && !coverageQuery.error && (coverageData?.items.length ?? 0) === 0 && (
              <section style={{ ...cardStyle, padding: 44 }} className="text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" /><p className="mt-3 font-semibold text-slate-800">No hay entidades para estos filtros</p><p className="mt-1 text-xs text-slate-500">Este resultado corresponde sólo al alcance seleccionado; cambia estado o ciclo de vida para revisar el resto.</p></section>
            )}
            <section className="space-y-3">
              {(coverageData?.items ?? []).map(item => <CoverageEntityCard key={`${item.entityType}:${item.entityId}`} item={item} />)}
            </section>
            {(coverageData?.pagination.total ?? 0) > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">{coverageData?.pagination.total} entidad(es) · página {coverageData?.pagination.page} de {coverageTotalPages}</p>
                <div className="flex gap-2"><Button variant="outline" size="sm" disabled={coveragePage <= 1 || coverageQuery.isFetching} onClick={() => setCoveragePage(value => value - 1)} aria-label="Página anterior de cobertura"><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" disabled={coveragePage >= coverageTotalPages || coverageQuery.isFetching} onClick={() => setCoveragePage(value => value + 1)} aria-label="Página siguiente de cobertura"><ChevronRight className="h-4 w-4" /></Button></div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-3 space-y-5">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                { key: "pending" as const, label: "Pendientes vigentes", value: historySummary?.pending ?? 0, icon: Clock3 },
                { key: "expired" as const, label: "Pendientes expirados", value: historySummary?.expired ?? 0, icon: AlertTriangle },
                { key: "attached" as const, label: "Adjuntados", value: historySummary?.attached ?? 0, icon: CheckCircle2 },
                { key: "discarded" as const, label: "Descartados", value: historySummary?.discarded ?? 0, icon: Trash2 },
                { key: "all" as const, label: "Total histórico", value: historySummary?.total ?? 0, icon: FileText },
              ].map(card => <button key={card.key} type="button" onClick={() => setHistoryStatus(card.key)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500" aria-pressed={historyStatus === card.key}><div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">{card.label}<card.icon className="h-4 w-4" /></div><div className="mt-2 text-2xl font-extrabold text-slate-900">{card.value}</div></button>)}
            </section>

            <section style={{ ...cardStyle, padding: "16px 18px" }}>
              <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: C.navy }}><Filter className="h-4 w-4" /> Historial técnico de cargas</h2><p className="mt-1 text-[11px] text-slate-500">Audita recibos, adjuntos, expiraciones y descartes. Esta pestaña no calcula cumplimiento.</p></div></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Proyecto, archivo o usuario" className="pl-9" /></div>
                <Select value={historyStatus} onValueChange={value => setHistoryStatus(value as EvidenceStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pendientes vigentes</SelectItem><SelectItem value="expired">Pendientes expirados</SelectItem><SelectItem value="attached">Adjuntados</SelectItem><SelectItem value="discarded">Descartados</SelectItem><SelectItem value="all">Todos los estados</SelectItem></SelectContent></Select>
                <Select value={documentType} onValueChange={value => setDocumentType(value as DocumentType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos</SelectItem><SelectItem value="minute">Minutas</SelectItem><SelectItem value="acceptance">Actas de aceptación</SelectItem><SelectItem value="recovery_plan">Planes de recuperación</SelectItem></SelectContent></Select>
                <Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue placeholder="Proyecto" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los proyectos</SelectItem>{(projectsQuery.data ?? []).map(project => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}</SelectContent></Select>
              </div>
            </section>

            <section style={{ ...cardStyle, overflow: "hidden" }} className="min-w-0 max-w-full">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5"><div><p className="text-sm font-bold" style={{ color: C.navy }}>Recibos y adjuntos</p><p className="text-[11px] text-slate-500">{historyTotal} registro{historyTotal === 1 ? "" : "s"} para los filtros actuales</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={historyPage <= 1 || listQuery.isFetching} onClick={() => setHistoryPage(value => value - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-24 text-center text-xs text-slate-500">Página {historyPage} de {historyTotalPages}</span><Button variant="outline" size="sm" disabled={historyPage >= historyTotalPages || listQuery.isFetching} onClick={() => setHistoryPage(value => value + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></Button></div></div>
              <div className="max-w-full overflow-x-auto"><table className="min-w-[1120px] w-full border-collapse"><thead><tr><th style={thStyle}>Carga</th><th style={thStyle}>Proyecto</th><th style={thStyle}>Documento</th><th style={thStyle}>Archivo</th><th style={thStyle}>Responsable</th><th style={thStyle}>Estado</th><th style={thStyle}>Trazabilidad</th><th style={{ ...thStyle, textAlign: "right" }}>{canManage ? "Acciones" : "Acceso"}</th></tr></thead><tbody>
                {listQuery.isLoading && <tr><td colSpan={8} style={{ ...tdStyle, padding: 30, textAlign: "center" }}><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-slate-400" />Cargando historial...</td></tr>}
                {!listQuery.isLoading && listQuery.error && <tr><td colSpan={8} style={{ ...tdStyle, padding: 30, color: C.red, textAlign: "center" }}>{listQuery.error.message}</td></tr>}
                {!listQuery.isLoading && !listQuery.error && historyItems.length === 0 && <tr><td colSpan={8} style={{ ...tdStyle, padding: 38, textAlign: "center" }}><FileClock className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="font-semibold text-slate-700">No hay cargas técnicas para estos filtros</p><p className="mt-1 text-xs text-slate-500">Esto no significa que el expediente esté completo; revisa la pestaña Cobertura documental.</p></td></tr>}
                {historyItems.map(item => <tr key={item.id} className="hover:bg-slate-50/80"><td style={tdStyle}><div className="font-semibold">{formatDate(item.createdAt)}</div><div className="mt-1 text-[10px] text-slate-400">Recibo #{item.id}</div></td><td style={tdStyle}><Link href={`/projects/${item.projectId}`} className="inline-flex max-w-[230px] items-start gap-1 font-semibold text-sky-700 hover:underline"><FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="break-words">{item.projectName || `Proyecto ${item.projectId}`}</span></Link><div className="mt-1 text-[10px] text-slate-400">PMO-{item.projectId} · baseline #{item.sourceId}</div></td><td style={tdStyle}><div className="font-semibold">{DOCUMENT_LABELS[item.documentType]}</div>{item.attachedEntityId && <div className="mt-1 text-[10px] text-slate-400">Registro #{item.attachedEntityId}</div>}</td><td style={tdStyle}><div className="max-w-[210px] break-all font-medium">{item.fileName}</div><div className="mt-1 text-[10px] text-slate-400">{formatBytes(item.sizeBytes)} · {item.mimeType}</div></td><td style={tdStyle}><div className="font-medium">{item.uploadedByName || `Usuario ${item.uploadedBy}`}</div>{item.discardedByName && <div className="mt-1 text-[10px] text-slate-400">Descartó: {item.discardedByName}</div>}</td><td style={tdStyle}><HistoryStatusBadge status={item.status} /><div className="mt-2 text-[10px] text-slate-400">{item.status === "pending" && `Vence ${formatDate(item.expiresAt)}`}{item.status === "expired" && `Expiró ${formatDate(item.expiresAt)}`}{item.status === "attached" && `Adjuntado ${formatDate(item.attachedAt)}`}{item.status === "discarded" && `Descartado ${formatDate(item.discardedAt)}`}</div></td><td style={tdStyle}>{item.discardReason ? <p className="max-w-[220px] break-words text-xs text-slate-600">{item.discardReason}</p> : <p className="text-xs text-slate-400">{item.status === "attached" ? "Vinculado al registro formal" : "Sin observaciones"}</p>}</td><td style={{ ...tdStyle, textAlign: "right" }}>{canManage && item.canDiscard && <Button variant="outline" size="sm" onClick={() => { setDiscardTarget(item); setDiscardReason(""); }} className="border-red-200 text-red-700 hover:bg-red-50"><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Descartar</Button>}{canManage && item.canRestore && <Button variant="outline" size="sm" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate({ id: item.id })}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restaurar</Button>}{(!canManage || (!item.canDiscard && !item.canRestore)) && <span className="text-[10px] text-slate-400">Sólo lectura</span>}</td></tr>)}
              </tbody></table></div>
            </section>
          </TabsContent>
        </Tabs>
      </main>

      <footer style={footerStyle} className="gap-3"><span style={footerText}>Prodigio Tech · Cobertura y cumplimiento documental</span><span style={footerText}>Corte {formatDate(coverageData?.cutoffAt ?? new Date(), false)}</span></footer>

      <Dialog open={canManage && Boolean(discardTarget)} onOpenChange={open => { if (!open) { setDiscardTarget(null); setDiscardReason(""); } }}>
        <DialogContent><DialogHeader><DialogTitle>Descartar documento pendiente</DialogTitle><DialogDescription>El recibo quedará invalidado y no podrá adjuntarse a un acta, minuta o plan. El archivo no se elimina del storage y la acción quedará auditada.</DialogDescription></DialogHeader><div className="space-y-3 py-2"><div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-800">{discardTarget?.fileName}</p><p className="mt-1 text-xs text-slate-500">{discardTarget?.projectName || `Proyecto ${discardTarget?.projectId}`}</p></div><div><label htmlFor="discard-reason" className="mb-1.5 block text-sm font-medium text-slate-700">Razón del descarte</label><Textarea id="discard-reason" value={discardReason} onChange={event => setDiscardReason(event.target.value)} maxLength={500} placeholder="Ej.: archivo duplicado o cargado por error" /><p className="mt-1 text-right text-[10px] text-slate-400">{discardReason.trim().length}/500</p></div></div><DialogFooter><Button variant="outline" onClick={() => { setDiscardTarget(null); setDiscardReason(""); }}>Cancelar</Button><Button variant="destructive" disabled={discardReason.trim().length < 5 || discardMutation.isPending} onClick={() => { if (discardTarget && discardReason.trim().length >= 5) discardMutation.mutate({ id: discardTarget.id, reason: discardReason.trim() }); }}>{discardMutation.isPending ? "Descartando..." : "Descartar documento"}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
