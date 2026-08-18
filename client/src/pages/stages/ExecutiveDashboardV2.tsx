import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  GitBranch,
  Loader2,
  ShieldAlert,
  Target,
  TrendingUp,
} from "lucide-react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";

const colors = {
  VERDE: "bg-emerald-600",
  AMARILLO: "bg-amber-500",
  ROJO: "bg-rose-600",
} as const;

const statusLabels = {
  fulfilled: "Cumplido",
  pending: "Pendiente",
  delayed: "Atrasado",
  blocked: "Bloqueado",
} as const;

type SemanticStatus = keyof typeof statusLabels;
type ContractMilestone = {
  id: number;
  milestoneCode: string;
  title: string;
  billingWeight: number | string;
  jiraIssueKey: string;
  jiraDueDate?: string | null;
  semanticStatus: SemanticStatus;
  isCritical?: boolean | number | null;
};

type FinancialSnapshot = {
  utilizadoUFPorc?: number | null;
  presupuestoUF?: number | null;
  utilizadoUF?: number | null;
  margenProyectadoPorc?: number | null;
  margenTargetPorc?: number | null;
  porcentajeAvanceProyecto?: number | null;
  notas?: string | null;
} | null;

type FinancialAlert = {
  type: "critical" | "warning" | "info" | "success";
  category: string;
  title: string;
  description: string;
  value?: string;
};

function percent(value?: number | null) {
  return value == null ? "N/D" : `${(Number(value) * 100).toFixed(0)}%`;
}

function uf(value?: number | null) {
  return value == null ? "N/D" : `${Number(value).toLocaleString("es-CL", { maximumFractionDigits: 0 })} UF`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

const alertTone = {
  critical: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
} as const;

export default function ExecutiveDashboardV2() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const dashboard = trpc.advance.getExecutiveDashboardV2.useQuery({ projectId }, { retry: false });

  if (dashboard.isLoading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando evidencia ejecutiva…</div>;
  }

  if (dashboard.error || !dashboard.data) {
    const pilotUnavailable = dashboard.error?.data?.code === "FORBIDDEN";
    return <div className="p-8"><AppBreadcrumb segments={[{ label: "Proyectos", href: "/projects" }, { label: "Dashboard Ejecutivo v2" }]} /><Card className="mt-6 border-amber-200 bg-amber-50"><CardContent className="p-6 flex gap-3"><AlertTriangle className="shrink-0 text-amber-600" /><div><b>{pilotUnavailable ? "Piloto ejecutivo no habilitado." : "Baseline ejecutivo no disponible."}</b><p className="text-sm text-muted-foreground mt-1">{pilotUnavailable ? "Esta versión está controlada para el piloto Tanner mientras se valida el modelo contractual." : "Esta vista se habilita cuando existe un SoW contractual aprobado y mapeado con hitos Jira."}</p></div></CardContent></Card></div>;
  }

  const { project, source, contractual } = dashboard.data;
  const financial = dashboard.data.financial as FinancialSnapshot;
  const financialAlerts = (dashboard.data.financialAlerts ?? []) as FinancialAlert[];
  const actualSpend = financial?.utilizadoUFPorc != null ? Number(financial.utilizadoUFPorc) * 100 : null;
  const marginGap = financial?.margenProyectadoPorc != null && financial?.margenTargetPorc != null
    ? (Number(financial.margenProyectadoPorc) - Number(financial.margenTargetPorc)) * 100
    : null;
  const milestones = contractual.milestones as ContractMilestone[];
  const attentionMilestones = milestones.filter((milestone) => milestone.semanticStatus === "delayed" || milestone.semanticStatus === "blocked" || (milestone.semanticStatus === "pending" && milestone.jiraDueDate)).slice(0, 3);
  const hasFinancialPressure = actualSpend != null && actualSpend >= 90;
  const decisionCopy = contractual.semaphore === "ROJO"
    ? "Requiere intervención ejecutiva: hay evidencia contractual u operativa que compromete el plan."
    : contractual.semaphore === "AMARILLO"
      ? "Requiere seguimiento de comité: la evidencia exige medidas preventivas antes del siguiente hito."
      : "La evidencia contractual y operativa se mantiene dentro de los umbrales acordados.";

  return <div className="p-4 md:p-8 space-y-6 pb-12">
    <AppBreadcrumb segments={[{ label: "Proyectos", href: "/projects" }, { label: project.name, href: `/projects/${projectId}` }, { label: "Dashboard Ejecutivo v2" }]} />

    <section className="rounded-2xl bg-slate-950 p-6 md:p-8 text-white shadow-sm overflow-hidden relative">
      <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold tracking-[.18em] uppercase text-pink-300">Piloto contractual · Tanner</p>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">SoW {source.baselineVersion} es el baseline contractual; Jira {source.jiraProjectKey} aporta el estado y las fechas operativas de los hitos conciliados.</p>
        </div>
        <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur"><span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${colors[contractual.semaphore as keyof typeof colors] ?? colors.AMARILLO}`} />Semáforo {contractual.semaphore}</div>
      </div>
    </section>

    <section className={`rounded-2xl border p-5 md:p-6 ${contractual.semaphore === "ROJO" ? "border-rose-200 bg-rose-50" : contractual.semaphore === "AMARILLO" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3"><ShieldAlert className={`mt-0.5 h-5 w-5 shrink-0 ${contractual.semaphore === "ROJO" ? "text-rose-600" : contractual.semaphore === "AMARILLO" ? "text-amber-600" : "text-emerald-600"}`} /><div><p className="text-xs font-bold tracking-[.14em] uppercase text-muted-foreground">Lectura para comité</p><p className="mt-1 font-semibold text-foreground">{decisionCopy}</p></div></div>
        <div className="text-sm text-muted-foreground md:text-right"><span className="block font-medium text-foreground">Evidencia vigente</span>Baseline SoW + sincronización Jira</div>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs uppercase text-muted-foreground font-semibold">Avance contractual</p><Target className="h-4 w-4 text-primary" /></div><p className="text-3xl font-bold mt-3">{contractual.progressPct.toFixed(0)}%</p><Progress className="mt-3" value={contractual.progressPct} /><p className="text-sm text-muted-foreground mt-3">{contractual.fulfilledWeight.toFixed(0)} de {contractual.totalWeight.toFixed(0)} puntos contractuales</p></CardContent></Card>
      <Card><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs uppercase text-muted-foreground font-semibold">Uso de presupuesto</p><CircleDollarSign className="h-4 w-4 text-primary" /></div><p className={`text-3xl font-bold mt-3 ${hasFinancialPressure ? "text-rose-600" : ""}`}>{actualSpend == null ? "N/D" : `${actualSpend.toFixed(0)}%`}</p><p className="text-sm text-muted-foreground mt-3">{uf(financial?.utilizadoUF)} de {uf(financial?.presupuestoUF)}</p></CardContent></Card>
      <Card><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs uppercase text-muted-foreground font-semibold">Margen proyectado</p><TrendingUp className="h-4 w-4 text-primary" /></div><p className={`text-3xl font-bold mt-3 ${(financial?.margenProyectadoPorc ?? 0) < 0 ? "text-rose-600" : ""}`}>{percent(financial?.margenProyectadoPorc)}</p><p className="text-sm text-muted-foreground mt-3">{marginGap == null ? "Sin target comparable" : `${marginGap >= 0 ? "+" : ""}${marginGap.toFixed(1)} pp vs. target`}</p></CardContent></Card>
      <Card><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs uppercase text-muted-foreground font-semibold">Alertas de hito</p><Clock3 className="h-4 w-4 text-primary" /></div><p className={`text-3xl font-bold mt-3 ${contractual.delayedCount || contractual.overduePendingCount ? "text-rose-600" : ""}`}>{contractual.delayedCount + contractual.overduePendingCount}</p><p className="text-sm text-muted-foreground mt-3">{contractual.delayedCount} atrasado(s) · {contractual.overduePendingCount} vencido(s)</p></CardContent></Card>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.65fr_.85fr]">
      <Card><CardContent className="p-5 md:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><h2 className="font-semibold">Evidencia contractual y operativa</h2></div><p className="mt-1 text-sm text-muted-foreground">Peso desde SoW; estado y fecha desde Jira. Cada fila mantiene trazabilidad al hito operativo.</p></div><Badge variant="outline" className="h-fit w-fit">{source.baselineVersion} aprobado</Badge></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3 pr-4">Hito SoW</th><th className="pb-3 pr-4">Peso</th><th className="pb-3 pr-4">Jira</th><th className="pb-3 pr-4">Fecha operativa</th><th className="pb-3">Estado</th></tr></thead><tbody>{milestones.map((milestone) => <tr key={milestone.id} className="border-b last:border-0"><td className="py-3 pr-4 font-medium">{milestone.milestoneCode} · {milestone.title}{milestone.isCritical ? <Badge variant="outline" className="ml-2 text-[10px]">Crítico</Badge> : null}</td><td className="py-3 pr-4">{Number(milestone.billingWeight).toFixed(0)}%</td><td className="py-3 pr-4"><span className="inline-flex items-center gap-1"><GitBranch className="h-3.5 w-3.5" />{milestone.jiraIssueKey}</span></td><td className="py-3 pr-4">{formatDate(milestone.jiraDueDate)}</td><td className="py-3"><Badge className={milestone.semanticStatus === "fulfilled" ? "bg-emerald-600" : milestone.semanticStatus === "delayed" ? "bg-rose-600" : milestone.semanticStatus === "blocked" ? "bg-violet-600" : "bg-slate-500"}>{statusLabels[milestone.semanticStatus]}</Badge></td></tr>)}</tbody></table></div>
        <a className="inline-flex mt-5 text-sm font-medium text-primary hover:underline" href={source.contractFileUrl} target="_blank" rel="noreferrer"><CheckCircle2 className="mr-1 h-4 w-4" />Abrir SoW contractual de referencia</a>
      </CardContent></Card>

      <div className="space-y-6">
        <Card><CardContent className="p-5"><h2 className="font-semibold">Foco inmediato</h2><p className="mt-1 text-sm text-muted-foreground">Hitos que requieren seguimiento de comité según la evidencia disponible.</p><div className="mt-4 space-y-3">{attentionMilestones.length ? attentionMilestones.map((milestone) => <div key={milestone.id} className="rounded-xl border bg-muted/30 p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{milestone.milestoneCode} · {milestone.title}</p><Badge className={milestone.semanticStatus === "delayed" ? "bg-rose-600" : milestone.semanticStatus === "blocked" ? "bg-violet-600" : "bg-slate-500"}>{statusLabels[milestone.semanticStatus]}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{milestone.jiraIssueKey} · {formatDate(milestone.jiraDueDate)} · {Number(milestone.billingWeight).toFixed(0)}% contractual</p></div>) : <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">No hay hitos pendientes de atención inmediata.</p>}</div></CardContent></Card>
        <Card><CardContent className="p-5"><h2 className="font-semibold">Alertas financieras</h2><p className="mt-1 text-sm text-muted-foreground">Lectura derivada del Deal {source.dealId}; no reemplaza la evidencia contractual.</p><div className="mt-4 space-y-3">{financialAlerts.length ? financialAlerts.slice(0, 3).map((alert, index) => <div key={`${alert.category}-${index}`} className={`rounded-xl border p-3 ${alertTone[alert.type]}`}><div className="flex justify-between gap-2"><p className="text-sm font-semibold">{alert.title}</p>{alert.value ? <span className="text-sm font-bold">{alert.value}</span> : null}</div><p className="mt-1 text-xs leading-relaxed opacity-80">{alert.description}</p></div>) : <p className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">No hay alerta financiera vigente o la fuente aún no posee datos comparables.</p>}</div></CardContent></Card>
      </div>
    </section>

    <footer className="rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><span>Baseline: SoW {source.baselineVersion} · Deal {source.dealId} · Jira {source.jiraProjectKey}</span><span>Los porcentajes provienen del SoW; Jira sólo aporta evidencia operativa.</span></footer>
  </div>;
}
