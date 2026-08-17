import { CheckCircle2, AlertCircle, SkipForward, ExternalLink, Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface BacklogLogEntry {
  timestamp: string;
  type: "epic" | "story" | "task";
  code: string;
  name: string;
  status: "created" | "skipped" | "error";
  jiraKey: string | null;
  parentKey: string | null;
  errorMsg: string | null;
  index: number;
  total: number;
}

interface MilestoneLogEntry {
  timestamp: string;
  milestoneNumber: number;
  description: string;
  status: "created" | "skipped" | "error";
  jiraKey: string | null;
  errorMsg: string | null;
  index: number;
  total: number;
}

interface BacklogResult {
  success: boolean;
  projectKey: string;
  created: number;
  skipped: number;
  errors: number;
  jiraKeys: string[];
  verified: boolean;
  logEntries: BacklogLogEntry[];
  totals: { epics: number; stories: number; tasks: number; total: number };
  elapsedMs: number;
}

interface MilestoneResult {
  success: boolean;
  projectKey: string;
  created: number;
  skipped: number;
  errors: number;
  jiraKeys: string[];
  verified: boolean;
  logEntries: MilestoneLogEntry[];
  totals: { milestones: number };
  elapsedMs: number;
}

// ─── Fake Progress Hook ──────────────────────────────────────────────────────
function useFakeProgress(isLoading: boolean, estimatedItems: number) {
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState("");

  useEffect(() => {
    if (!isLoading) {
      if (progress > 0) setProgress(100);
      return;
    }
    setProgress(0);
    setCurrentPhase("Conectando con JIRA...");

    const phases = [
      { at: 5, label: "Conectando con JIRA..." },
      { at: 10, label: "Validando proyecto..." },
      { at: 15, label: "Preparando issues..." },
      { at: 25, label: `Creando épicas...` },
      { at: 45, label: `Creando historias de usuario...` },
      { at: 70, label: `Creando tareas...` },
      { at: 85, label: "Verificando issues creados..." },
      { at: 92, label: "Finalizando..." },
    ];

    // Speed based on estimated items (more items = slower progress)
    const baseInterval = Math.max(300, Math.min(1500, estimatedItems * 80));
    let phaseIdx = 0;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev; // Cap at 95% until real result
        const next = prev + Math.random() * 3 + 0.5;
        // Update phase label
        while (phaseIdx < phases.length && next >= phases[phaseIdx].at) {
          setCurrentPhase(phases[phaseIdx].label);
          phaseIdx++;
        }
        return Math.min(next, 95);
      });
    }, baseInterval);

    return () => clearInterval(interval);
  }, [isLoading, estimatedItems]);

  return { progress: isLoading ? Math.min(progress, 95) : (progress > 0 ? 100 : 0), currentPhase };
}

// ─── Milestone Fake Progress ─────────────────────────────────────────────────
function useMilestoneFakeProgress(isLoading: boolean, estimatedItems: number) {
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState("");

  useEffect(() => {
    if (!isLoading) {
      if (progress > 0) setProgress(100);
      return;
    }
    setProgress(0);
    setCurrentPhase("Conectando con JIRA...");

    const phases = [
      { at: 10, label: "Conectando con JIRA..." },
      { at: 20, label: "Validando proyecto..." },
      { at: 40, label: `Creando hitos de pago...` },
      { at: 75, label: "Verificando issues creados..." },
      { at: 90, label: "Finalizando..." },
    ];

    const baseInterval = Math.max(400, Math.min(2000, estimatedItems * 200));
    let phaseIdx = 0;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        const next = prev + Math.random() * 4 + 1;
        while (phaseIdx < phases.length && next >= phases[phaseIdx].at) {
          setCurrentPhase(phases[phaseIdx].label);
          phaseIdx++;
        }
        return Math.min(next, 95);
      });
    }, baseInterval);

    return () => clearInterval(interval);
  }, [isLoading, estimatedItems]);

  return { progress: isLoading ? Math.min(progress, 95) : (progress > 0 ? 100 : 0), currentPhase };
}

// ─── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "created" | "skipped" | "error" }) {
  if (status === "created") return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle2 className="h-3 w-3" /> Creado
    </span>
  );
  if (status === "skipped") return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      <SkipForward className="h-3 w-3" /> Ya existía
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <AlertCircle className="h-3 w-3" /> Error
    </span>
  );
}

function TypeBadge({ type }: { type: "epic" | "story" | "task" }) {
  const colors = {
    epic: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    story: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    task: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
  const labels = { epic: "Épica", story: "Story", task: "Task" };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[type]}`}>
      {labels[type]}
    </span>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────────────────
function ProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          {label}
        </span>
        <span className="font-mono text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #e91e8c, #7c3aed, #3b82f6)",
          }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKLOG PROGRESS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function BacklogProgressPanel({
  isLoading,
  result,
  estimatedItems,
}: {
  isLoading: boolean;
  result: BacklogResult | null;
  estimatedItems: number;
}) {
  const { progress, currentPhase } = useFakeProgress(isLoading, estimatedItems);
  const [showFullLog, setShowFullLog] = useState(false);

  // Loading state
  if (isLoading && !result) {
    return (
      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border animate-in fade-in duration-300">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="h-2 w-2 rounded-full bg-[#e91e8c] animate-pulse" />
          Sincronizando con JIRA — Epic, Story, Task board
        </div>
        <ProgressBar progress={progress} label={currentPhase} />
        <div className="grid grid-cols-3 gap-3">
          <CounterCard label="Épicas" value="..." color="violet" />
          <CounterCard label="Stories" value="..." color="blue" />
          <CounterCard label="Tasks" value="..." color="emerald" />
        </div>
      </div>
    );
  }

  // Result state
  if (!result) return null;

  const displayedLogs = showFullLog ? result.logEntries : result.logEntries.slice(0, 8);

  return (
    <div className="space-y-4 p-4 bg-green-50/50 dark:bg-green-950/10 rounded-lg border border-green-200 dark:border-green-800 animate-in fade-in duration-500">
      {/* Summary Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-400">
              Sección cerrada y sincronizada con JIRA
            </p>
            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
              Proyecto: <span className="font-mono font-medium">{result.projectKey}</span>
              {" · "}Tiempo: {(result.elapsedMs / 1000).toFixed(1)}s
              {result.verified && " · Verificado ✓"}
            </p>
          </div>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-4 gap-2">
        <CounterCard label="Creados" value={result.created} color="green" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
        <CounterCard label="Ya existían" value={result.skipped} color="gray" icon={<SkipForward className="h-3.5 w-3.5" />} />
        <CounterCard label="Errores" value={result.errors} color="red" icon={<AlertCircle className="h-3.5 w-3.5" />} />
        <CounterCard label="Total" value={result.totals.total} color="violet" />
      </div>

      {/* Type breakdown */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span><span className="font-medium text-violet-600">{result.totals.epics}</span> épicas</span>
        <span><span className="font-medium text-blue-600">{result.totals.stories}</span> stories</span>
        <span><span className="font-medium text-emerald-600">{result.totals.tasks}</span> tasks</span>
      </div>

      {/* Log entries */}
      {result.logEntries.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Detalle de operaciones</p>
            {result.logEntries.length > 8 && (
              <button
                onClick={() => setShowFullLog(!showFullLog)}
                className="text-xs text-[#e91e8c] hover:underline"
              >
                {showFullLog ? "Mostrar menos" : `Ver todo (${result.logEntries.length})`}
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5 rounded-md border border-border bg-background p-1.5">
            {displayedLogs.map((entry, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                  entry.status === "error" ? "bg-red-50 dark:bg-red-950/20" : ""
                }`}
              >
                <span className="text-[10px] text-muted-foreground font-mono w-14 flex-shrink-0">
                  {entry.index}/{entry.total}
                </span>
                <TypeBadge type={entry.type} />
                <span className="font-mono text-muted-foreground w-16 flex-shrink-0 truncate">{entry.code}</span>
                <span className="flex-1 truncate">{entry.name}</span>
                <StatusBadge status={entry.status} />
                {entry.jiraKey && (
                  <span className="font-mono text-[10px] text-green-600 flex items-center gap-0.5 flex-shrink-0">
                    <ExternalLink className="h-2.5 w-2.5" />{entry.jiraKey}
                  </span>
                )}
                {entry.errorMsg && (
                  <span className="text-[10px] text-red-500 truncate max-w-32" title={entry.errorMsg}>
                    {entry.errorMsg}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONE PROGRESS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
export function MilestoneProgressPanel({
  isLoading,
  result,
  estimatedItems,
}: {
  isLoading: boolean;
  result: MilestoneResult | null;
  estimatedItems: number;
}) {
  const { progress, currentPhase } = useMilestoneFakeProgress(isLoading, estimatedItems);
  const [showFullLog, setShowFullLog] = useState(false);

  // Loading state
  if (isLoading && !result) {
    return (
      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border animate-in fade-in duration-300">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="h-2 w-2 rounded-full bg-[#e91e8c] animate-pulse" />
          Sincronizando con JIRA — Hito PMO board
        </div>
        <ProgressBar progress={progress} label={currentPhase} />
        <div className="grid grid-cols-1 gap-3">
          <CounterCard label="Hitos" value="..." color="amber" />
        </div>
      </div>
    );
  }

  // Result state
  if (!result) return null;

  const displayedLogs = showFullLog ? result.logEntries : result.logEntries.slice(0, 8);

  return (
    <div className="space-y-4 p-4 bg-green-50/50 dark:bg-green-950/10 rounded-lg border border-green-200 dark:border-green-800 animate-in fade-in duration-500">
      {/* Summary Header */}
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-green-800 dark:text-green-400">
            Hitos sincronizados con JIRA (Hito PMO board)
          </p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
            Proyecto: <span className="font-mono font-medium">{result.projectKey}</span>
            {" · "}Tiempo: {(result.elapsedMs / 1000).toFixed(1)}s
            {result.verified && " · Verificado ✓"}
          </p>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-2">
        <CounterCard label="Creados" value={result.created} color="green" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
        <CounterCard label="Ya existían" value={result.skipped} color="gray" icon={<SkipForward className="h-3.5 w-3.5" />} />
        <CounterCard label="Errores" value={result.errors} color="red" icon={<AlertCircle className="h-3.5 w-3.5" />} />
      </div>

      {/* Log entries */}
      {result.logEntries.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Detalle de operaciones</p>
            {result.logEntries.length > 8 && (
              <button
                onClick={() => setShowFullLog(!showFullLog)}
                className="text-xs text-[#e91e8c] hover:underline"
              >
                {showFullLog ? "Mostrar menos" : `Ver todo (${result.logEntries.length})`}
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-md border border-border bg-background p-1.5">
            {displayedLogs.map((entry, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                  entry.status === "error" ? "bg-red-50 dark:bg-red-950/20" : ""
                }`}
              >
                <span className="text-[10px] text-muted-foreground font-mono w-10 flex-shrink-0">
                  {entry.index}/{entry.total}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Clock className="h-3 w-3" /> Hito {entry.milestoneNumber}
                </span>
                <span className="flex-1 truncate">{entry.description}</span>
                <StatusBadge status={entry.status} />
                {entry.jiraKey && (
                  <span className="font-mono text-[10px] text-green-600 flex items-center gap-0.5 flex-shrink-0">
                    <ExternalLink className="h-2.5 w-2.5" />{entry.jiraKey}
                  </span>
                )}
                {entry.errorMsg && (
                  <span className="text-[10px] text-red-500 truncate max-w-32" title={entry.errorMsg}>
                    {entry.errorMsg}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISK PROGRESS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

interface RiskLogEntry {
  riskCode: string;
  description: string;
  type: string;
  probability: string;
  impact: string;
  status: "created" | "skipped" | "error";
  jiraKey: string | null;
  errorMsg: string | null;
  index: number;
  total: number;
}

interface RiskResult {
  success: boolean;
  projectKey: string;
  created: number;
  skipped: number;
  errors: number;
  jiraKeys: string[];
  logEntries: RiskLogEntry[];
  totals: { confirmed: number; total: number };
  elapsedMs: number;
  spaceUrl?: string;
}

function useRiskFakeProgress(isLoading: boolean, estimatedItems: number) {
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState("");

  useEffect(() => {
    if (!isLoading) {
      if (progress > 0) setProgress(100);
      return;
    }
    setProgress(0);
    setCurrentPhase("Conectando con JIRA...");

    const phases = [
      { at: 8, label: "Conectando con JIRA..." },
      { at: 15, label: "Validando Space del proyecto..." },
      { at: 25, label: "Preparando riesgos confirmados..." },
      { at: 45, label: "Creando issues de riesgos..." },
      { at: 70, label: "Transicionando a estado Identificado..." },
      { at: 85, label: "Verificando issues creados..." },
      { at: 92, label: "Finalizando..." },
    ];

    const baseInterval = Math.max(400, Math.min(2000, estimatedItems * 150));
    let phaseIdx = 0;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        const next = prev + Math.random() * 3 + 0.8;
        while (phaseIdx < phases.length && next >= phases[phaseIdx].at) {
          setCurrentPhase(phases[phaseIdx].label);
          phaseIdx++;
        }
        return Math.min(next, 95);
      });
    }, baseInterval);

    return () => clearInterval(interval);
  }, [isLoading, estimatedItems]);

  return { progress: isLoading ? Math.min(progress, 95) : (progress > 0 ? 100 : 0), currentPhase };
}

function RiskTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    riesgo: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    riesgo_oculto: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    supuesto_no_validado: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    dependencia_externa: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };
  const labels: Record<string, string> = {
    riesgo: "Técnico", riesgo_oculto: "Oculto",
    supuesto_no_validado: "Supuesto no validado", dependencia_externa: "Dependencia externa",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[type] || "bg-gray-100 text-gray-700"}`}>
      {labels[type] || type}
    </span>
  );
}

export function RiskProgressPanel({
  isLoading,
  result,
  estimatedItems,
}: {
  isLoading: boolean;
  result: RiskResult | null;
  estimatedItems: number;
}) {
  const { progress, currentPhase } = useRiskFakeProgress(isLoading, estimatedItems);
  const [showFullLog, setShowFullLog] = useState(false);

  // Loading state
  if (isLoading && !result) {
    return (
      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border animate-in fade-in duration-300">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
          Sincronizando riesgos con JIRA — Riesgos PMO board
        </div>
        <ProgressBar progress={progress} label={currentPhase} />
        <div className="grid grid-cols-2 gap-3">
          <CounterCard label="Riesgos confirmados" value="..." color="amber" />
          <CounterCard label="En proceso" value="..." color="blue" />
        </div>
      </div>
    );
  }

  // Result state
  if (!result) return null;

  const hasErrors = result.errors > 0;
  const borderColor = hasErrors
    ? "border-amber-200 dark:border-amber-800"
    : "border-green-200 dark:border-green-800";
  const bgColor = hasErrors
    ? "bg-amber-50/50 dark:bg-amber-950/10"
    : "bg-green-50/50 dark:bg-green-950/10";

  const displayedLogs = showFullLog ? result.logEntries : result.logEntries.slice(0, 10);

  return (
    <div className={`space-y-4 p-4 ${bgColor} rounded-lg border ${borderColor} animate-in fade-in duration-500`}>
      {/* Summary Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          {hasErrors
            ? <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            : <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={`text-sm font-medium ${hasErrors ? "text-amber-800 dark:text-amber-400" : "text-green-800 dark:text-green-400"}`}>
              {hasErrors
                ? "Riesgos sincronizados con JIRA (con errores)"
                : "Riesgos sincronizados con JIRA (Riesgos PMO board)"
              }
            </p>
            <p className={`text-xs mt-0.5 ${hasErrors ? "text-amber-600 dark:text-amber-500" : "text-green-600 dark:text-green-500"}`}>
              Proyecto: <span className="font-mono font-medium">{result.projectKey}</span>
              {" · "}Tiempo: {(result.elapsedMs / 1000).toFixed(1)}s
            </p>
          </div>
        </div>
        {result.spaceUrl && (
          <a
            href={result.spaceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> Ver en JIRA
          </a>
        )}
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-2">
        <CounterCard label="Creados" value={result.created} color="green" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
        <CounterCard label="Ya exist\u00edan" value={result.skipped} color="gray" icon={<SkipForward className="h-3.5 w-3.5" />} />
        <CounterCard label="Errores" value={result.errors} color="red" icon={<AlertCircle className="h-3.5 w-3.5" />} />
      </div>

      {/* Log entries */}
      {result.logEntries.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Detalle de operaciones</p>
            {result.logEntries.length > 10 && (
              <button
                onClick={() => setShowFullLog(!showFullLog)}
                className="text-xs text-orange-600 hover:underline"
              >
                {showFullLog ? "Mostrar menos" : `Ver todo (${result.logEntries.length})`}
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto space-y-0.5 rounded-md border border-border bg-background p-1.5">
            {displayedLogs.map((entry, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                  entry.status === "error" ? "bg-red-50 dark:bg-red-950/20" : ""
                }`}
              >
                <span className="text-[10px] text-muted-foreground font-mono w-10 flex-shrink-0">
                  {entry.index}/{entry.total}
                </span>
                <RiskTypeBadge type={entry.type} />
                <span className="font-mono text-muted-foreground w-12 flex-shrink-0">{entry.riskCode}</span>
                <span className="flex-1 truncate">{entry.description}</span>
                <StatusBadge status={entry.status} />
                {entry.jiraKey && (
                  <span className="font-mono text-[10px] text-green-600 flex items-center gap-0.5 flex-shrink-0">
                    <ExternalLink className="h-2.5 w-2.5" />{entry.jiraKey}
                  </span>
                )}
                {entry.errorMsg && (
                  <span className="text-[10px] text-red-500 truncate max-w-32" title={entry.errorMsg}>
                    {entry.errorMsg}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JIRA SETUP PROGRESS PANEL (Space Creation - Etapa 2)
// ═══════════════════════════════════════════════════════════════════════════════
interface SetupStep {
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

function useSetupFakeProgress(isLoading: boolean) {
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<SetupStep[]>([
    { label: "Validando permisos JIRA", status: "pending" },
    { label: "Creando proyecto en JIRA", status: "pending" },
    { label: "Aplicando configuración PPDC", status: "pending" },
    { label: "Creando tableros Kanban", status: "pending" },
    { label: "Vinculando con PMO", status: "pending" },
  ]);

  useEffect(() => {
    if (!isLoading) {
      if (progress > 0) {
        setProgress(100);
        setSteps(prev => prev.map(s => ({ ...s, status: "done" as const })));
      }
      return;
    }
    setProgress(0);
    setSteps([
      { label: "Validando permisos JIRA", status: "running" },
      { label: "Creando proyecto en JIRA", status: "pending" },
      { label: "Aplicando configuración PPDC", status: "pending" },
      { label: "Creando tableros Kanban", status: "pending" },
      { label: "Vinculando con PMO", status: "pending" },
    ]);

    const timings = [2000, 4000, 7000, 10000];
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    timings.forEach((t, i) => {
      timeouts.push(setTimeout(() => {
        setSteps(prev => prev.map((s, j) => ({
          ...s,
          status: j <= i ? "done" as const : j === i + 1 ? "running" as const : s.status,
        })));
        setProgress(Math.min(((i + 1) / 5) * 95, 95));
      }, t));
    });

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 2 + 0.3;
      });
    }, 500);

    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(progressInterval);
    };
  }, [isLoading]);

  return { progress: isLoading ? Math.min(progress, 95) : (progress > 0 ? 100 : 0), steps };
}

export function JiraSetupProgressPanel({
  isLoading,
  result,
  error,
}: {
  isLoading: boolean;
  result: { created: boolean; spaceName: string; spaceKey: string; jiraProjectUrl: string | null; message: string } | null;
  error: string | null;
}) {
  const { progress, steps } = useSetupFakeProgress(isLoading);

  // Loading state
  if (isLoading && !result) {
    return (
      <div className="space-y-4 p-5 bg-muted/30 rounded-lg border border-border animate-in fade-in duration-300">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
          Creando Space JIRA con configuración corporativa PPDC
        </div>
        <ProgressBar progress={progress} label={steps.find(s => s.status === "running")?.label || "Procesando..."} />
        <div className="space-y-2 mt-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-xs">
              {step.status === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : step.status === "running" ? (
                <Loader2 className="h-4 w-4 text-purple-600 animate-spin flex-shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
              )}
              <span className={step.status === "running" ? "text-foreground font-medium" : step.status === "done" ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Este proceso puede tomar entre 10 y 30 segundos. No cierres esta página.
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-3 p-4 bg-red-50/50 dark:bg-red-950/10 rounded-lg border border-red-200 dark:border-red-800 animate-in fade-in duration-500">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-400">Error al crear el Space JIRA</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (!result) return null;

  return (
    <div className={`space-y-4 p-4 rounded-lg border animate-in fade-in duration-500 ${
      result.created
        ? "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800"
        : "bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800"
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          {result.created
            ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            : <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={`text-sm font-medium ${result.created ? "text-green-800 dark:text-green-400" : "text-amber-800 dark:text-amber-400"}`}>
              {result.created ? "Space creado exitosamente en JIRA" : "Space registrado — pendiente de permisos"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{result.message}</p>
          </div>
        </div>
        {result.jiraProjectUrl && (
          <a href={result.jiraProjectUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Abrir en JIRA
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-2 rounded-md bg-background border border-border">
          <p className="text-[10px] text-muted-foreground">Nombre</p>
          <p className="text-sm font-medium">{result.spaceName}</p>
        </div>
        <div className="p-2 rounded-md bg-background border border-border">
          <p className="text-[10px] text-muted-foreground">Key JIRA</p>
          <p className="text-sm font-mono font-medium">{result.spaceKey}</p>
        </div>
      </div>
      {result.created && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Configuración aplicada</p>
          <div className="space-y-1">
            {[
              "Categoría PPDC HIBRIDO",
              "Owner: Yanahí Takiana Villegas García",
              "4 Schemes PPDC corporativos",
              "5 Tableros Kanban creados",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                <span className="text-green-700 dark:text-green-400">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Counter Card ────────────────────────────────────────────────────────────
function CounterCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    green: "text-green-600 dark:text-green-400",
    gray: "text-gray-500 dark:text-gray-400",
    red: "text-red-600 dark:text-red-400",
    violet: "text-violet-600 dark:text-violet-400",
    blue: "text-blue-600 dark:text-blue-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-background border border-border">
      {icon && <span className={colorMap[color] || ""}>{icon}</span>}
      <div>
        <p className={`text-lg font-bold leading-none ${colorMap[color] || ""}`}>
          {typeof value === "number" ? value : value}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}
