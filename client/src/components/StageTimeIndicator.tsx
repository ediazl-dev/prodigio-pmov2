import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Clock, Timer, AlertTriangle, CheckCircle2, Pause, CalendarDays, TrendingUp,
} from "lucide-react";

interface StageTimeIndicatorProps {
  projectId: number;
  stageId: string;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgClass: string;
  borderClass: string;
  barColor: string;
  icon: typeof Clock;
}> = {
  on_track: {
    label: "En tiempo",
    color: "#059669",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/20",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    barColor: "#10b981",
    icon: TrendingUp,
  },
  caution: {
    label: "Precaución",
    color: "#ca8a04",
    bgClass: "bg-yellow-50 dark:bg-yellow-950/20",
    borderClass: "border-yellow-200 dark:border-yellow-800",
    barColor: "#eab308",
    icon: Clock,
  },
  warning: {
    label: "Alerta",
    color: "#ea580c",
    bgClass: "bg-orange-50 dark:bg-orange-950/20",
    borderClass: "border-orange-200 dark:border-orange-800",
    barColor: "#f97316",
    icon: AlertTriangle,
  },
  overdue: {
    label: "Vencido",
    color: "#dc2626",
    bgClass: "bg-red-50 dark:bg-red-950/20",
    borderClass: "border-red-200 dark:border-red-800",
    barColor: "#ef4444",
    icon: AlertTriangle,
  },
  paused: {
    label: "Pausado",
    color: "#d97706",
    bgClass: "bg-amber-50 dark:bg-amber-950/20",
    borderClass: "border-amber-200 dark:border-amber-800",
    barColor: "#f59e0b",
    icon: Pause,
  },
  completed: {
    label: "Completado",
    color: "#059669",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/20",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    barColor: "#10b981",
    icon: CheckCircle2,
  },
  not_started: {
    label: "No iniciada",
    color: "#6b7280",
    bgClass: "bg-gray-50 dark:bg-gray-950/20",
    borderClass: "border-gray-200 dark:border-gray-800",
    barColor: "#9ca3af",
    icon: Clock,
  },
};

export default function StageTimeIndicator({ projectId, stageId }: StageTimeIndicatorProps) {
  const { data: timeData } = trpc.stageOpenings.timeRemaining.useQuery({ projectId });

  const timeInfo = timeData?.find((t: any) => t.stageId === stageId);
  if (!timeInfo) return null;

  const config = STATUS_CONFIG[timeInfo.status] ?? STATUS_CONFIG.not_started;
  const StatusIcon = config.icon;

  // Not started - minimal display
  if (timeInfo.status === "not_started") {
    return (
      <Card className={`border ${config.borderClass} ${config.bgClass}`}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">
              Plazo asignado: <strong>{timeInfo.totalBusinessDays} días hábiles</strong>
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Completed stage
  if (timeInfo.status === "completed") {
    const used = timeInfo.usedBusinessDays ?? 0;
    const total = timeInfo.maxBusinessDays;
    const percentUsed = total > 0 ? Math.round((used / total) * 100) : 0;
    const withinBudget = used <= total;

    return (
      <Card className={`border ${config.borderClass} ${config.bgClass}`}>
        <CardContent className="py-3 px-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Etapa Completada
              </span>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              withinBudget
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              {withinBudget ? "Dentro del plazo" : "Excedió el plazo"}
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Plazo</p>
              <p className="text-sm font-bold text-foreground">{total}d</p>
              <p className="text-[10px] text-muted-foreground">hábiles</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Utilizado</p>
              <p className={`text-sm font-bold ${withinBudget ? "text-emerald-600" : "text-red-600"}`}>{used}d</p>
              <p className="text-[10px] text-muted-foreground">hábiles</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Diferencia</p>
              <p className={`text-sm font-bold ${withinBudget ? "text-emerald-600" : "text-red-600"}`}>
                {withinBudget ? `-${total - used}d` : `+${used - total}d`}
              </p>
              <p className="text-[10px] text-muted-foreground">{withinBudget ? "ahorro" : "exceso"}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="h-2 bg-white/60 dark:bg-gray-800/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(percentUsed, 100)}%`,
                  backgroundColor: withinBudget ? "#10b981" : "#ef4444",
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-muted-foreground">
                {percentUsed}% del plazo utilizado
              </span>
              {timeInfo.openedAt && timeInfo.closedAt && (
                <span className="text-[9px] text-muted-foreground">
                  {new Date(timeInfo.openedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
                  {" → "}
                  {new Date(timeInfo.closedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
                </span>
              )}
            </div>
          </div>

          {/* Extra info */}
          {(timeInfo.extraDays > 0 || timeInfo.pausedDays > 0) && (
            <div className="flex gap-3 text-[10px] text-muted-foreground pt-1 border-t border-emerald-200/50 dark:border-emerald-800/50">
              {timeInfo.extraDays > 0 && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> +{timeInfo.extraDays}d extensión
                </span>
              )}
              {timeInfo.pausedDays > 0 && (
                <span className="flex items-center gap-1">
                  <Pause className="h-3 w-3" /> +{timeInfo.pausedDays}d pausa
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Paused stage
  if (timeInfo.isPaused) {
    const used = timeInfo.usedBusinessDays ?? 0;
    const total = timeInfo.totalBusinessDays;

    return (
      <Card className={`border ${config.borderClass} ${config.bgClass}`}>
        <CardContent className="py-3 px-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pause className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Etapa Pausada
              </span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Tiempo detenido
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Plazo</p>
              <p className="text-sm font-bold text-foreground">{total}d</p>
              <p className="text-[10px] text-muted-foreground">hábiles</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Utilizado</p>
              <p className="text-sm font-bold text-amber-600">{used}d</p>
              <p className="text-[10px] text-muted-foreground">hábiles</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">En pausa</p>
              <p className="text-sm font-bold text-amber-600">{timeInfo.pausedDays}d</p>
              <p className="text-[10px] text-muted-foreground">hábiles</p>
            </div>
          </div>

          <div>
            <div className="h-2 bg-white/60 dark:bg-gray-800/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 animate-pulse"
                style={{
                  width: `${total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0}%`,
                  backgroundColor: "#f59e0b",
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // In progress (on_track, caution, warning, overdue)
  const remaining = timeInfo.remainingBusinessDays ?? 0;
  const used = timeInfo.usedBusinessDays ?? 0;
  const total = timeInfo.totalBusinessDays;
  const percentUsed = total > 0 ? Math.round((used / total) * 100) : 0;
  const deadlineStr = timeInfo.deadlineDate
    ? new Date(timeInfo.deadlineDate).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  return (
    <Card className={`border ${config.borderClass} ${config.bgClass}`}>
      <CardContent className="py-3 px-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className="h-4 w-4" style={{ color: config.color }} />
            <span className="text-xs font-semibold" style={{ color: config.color }}>
              {config.label}
            </span>
          </div>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: config.color + "18",
              color: config.color,
            }}
          >
            {remaining <= 0
              ? `Vencido hace ${Math.abs(remaining)} días`
              : `${remaining} días restantes`
            }
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Plazo</p>
            <p className="text-sm font-bold text-foreground">{total}d</p>
            <p className="text-[10px] text-muted-foreground">hábiles</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Utilizado</p>
            <p className="text-sm font-bold" style={{ color: config.color }}>{used}d</p>
            <p className="text-[10px] text-muted-foreground">hábiles</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Restante</p>
            <p className="text-sm font-bold" style={{ color: config.color }}>
              {remaining <= 0 ? `${Math.abs(remaining)}d` : `${remaining}d`}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {remaining <= 0 ? "vencido" : "hábiles"}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="h-2 bg-white/60 dark:bg-gray-800/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(percentUsed, 100)}%`,
                backgroundColor: config.barColor,
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">
              {percentUsed}% consumido
              {timeInfo.extraDays > 0 ? ` · +${timeInfo.extraDays}d ext.` : ""}
              {timeInfo.pausedDays > 0 ? ` · +${timeInfo.pausedDays}d pausa` : ""}
            </span>
            {deadlineStr && (
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Timer className="h-2.5 w-2.5" /> Vence: {deadlineStr}
              </span>
            )}
          </div>
        </div>

        {/* Opening date */}
        {timeInfo.openedAt && (
          <div className="text-[10px] text-muted-foreground pt-1 border-t" style={{ borderColor: config.color + "20" }}>
            <CalendarDays className="h-3 w-3 inline mr-1" />
            Inicio: {new Date(timeInfo.openedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
