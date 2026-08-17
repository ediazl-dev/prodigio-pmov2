import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertTriangle, CheckCircle2, Lock, ShieldCheck, FileCheck, Loader2, Info,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface StageClosurePanelProps {
  projectId: number;
  stageId: string;
  stageName: string;
  stageStatus: string;
  /** Additional requirement check before allowing closure (e.g., SoW must have approved doc) */
  additionalRequirement?: {
    met: boolean;
    label: string;
    description: string;
  };
  onClosed?: () => void;
  /** Callback with JIRA risk results when risks stage is closed */
  onJiraResults?: (data: any) => void;
  /** Callback when closure starts (mutation pending) */
  onClosingStart?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  sow: "Statement of Work",
  jira: "JIRA",
  risks: "Riesgos",
  planning: "Planificación",
  design: "Avance Proyecto",
  closure: "Cierre del Proyecto",
};

export default function StageClosurePanel({
  projectId,
  stageId,
  stageName,
  stageStatus,
  additionalRequirement,
  onClosed,
  onJiraResults,
  onClosingStart,
}: StageClosurePanelProps) {
  const { user } = useAuth();
  const canManage = user && ["admin", "pmo"].includes(user.role);
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: closure, refetch: refetchClosure } = trpc.stages.getClosure.useQuery(
    { projectId, stageId },
    { enabled: stageStatus !== "locked" }
  );

  const formalCloseMutation = trpc.stages.formalClose.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Etapa ${stageName} cerrada formalmente`);
      // Pass JIRA risk results to parent if callback provided
      if (data?.jiraRiskResults && onJiraResults) {
        onJiraResults(data.jiraRiskResults);
      } else if (data?.jiraRiskResults) {
        // Fallback: show toast if no callback
        const jr = data.jiraRiskResults;
        if (jr.created > 0) {
          const skippedMsg = jr.skipped > 0 ? ` (${jr.skipped} omitidos por no estar confirmados)` : "";
          toast.success(`${jr.created} riesgos confirmados creados en JIRA como "Identificado"${skippedMsg}`, { duration: 10000 });
        } else if (jr.total > 0) {
          toast.info(`No se pudieron crear los riesgos en JIRA. Verifique que el Space JIRA esté configurado correctamente.`, { duration: 8000 });
        } else if (jr.skipped > 0) {
          toast.warning(`Ningún riesgo fue confirmado para crear en JIRA. ${jr.skipped} riesgos omitidos. Confirme los riesgos en la matriz antes de cerrar.`, { duration: 10000 });
        }
      }
      refetchClosure();
      onClosed?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleClose = () => {
    if (!confirmed) {
      toast.error("Debe confirmar el disclaimer antes de cerrar la etapa.");
      return;
    }
    onClosingStart?.();
    formalCloseMutation.mutate({
      projectId,
      stageId,
      confirmed: true,
      notes: notes.trim() || undefined,
    });
  };

  // Already closed
  if (closure) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Etapa Cerrada Formalmente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Cerrada por <strong>{closure.closedByName}</strong> el {new Date(closure.closedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md p-3">
            <p className="text-xs text-emerald-800 dark:text-emerald-300 italic">
              "{closure.confirmationText}"
            </p>
          </div>
          {closure.notes && (
            <div className="text-xs text-muted-foreground">
              <strong>Observaciones:</strong> {closure.notes}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Stage not in progress or completed
  if (stageStatus === "locked") {
    return (
      <Card className="border-muted opacity-60">
        <CardContent className="py-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-4 w-4" /> La sección de cierre estará disponible cuando la etapa esté en progreso.
        </CardContent>
      </Card>
    );
  }

  // Stage already completed but no formal closure record (legacy)
  if (stageStatus === "completed" && !closure) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-4 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
          <Info className="h-4 w-4" /> Esta etapa fue completada sin cierre formal registrado.
        </CardContent>
      </Card>
    );
  }

  // Show closure form (only for admin/pmo)
  if (!canManage) {
    return (
      <Card className="border-muted">
        <CardContent className="py-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-4 w-4" /> Solo el Gerente de Proyecto (Admin/PMO) puede cerrar esta etapa.
        </CardContent>
      </Card>
    );
  }

  const requirementMet = !additionalRequirement || additionalRequirement.met;

  return (
    <Card className="border-blue-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-blue-600" /> Cierre Formal de Etapa: {STAGE_LABELS[stageId] || stageName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Additional requirement indicator */}
        {additionalRequirement && (
          <div className={`flex items-center gap-2 text-xs p-2 rounded-md ${
            additionalRequirement.met
              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
          }`}>
            {additionalRequirement.met
              ? <CheckCircle2 className="h-3.5 w-3.5" />
              : <AlertTriangle className="h-3.5 w-3.5" />
            }
            <span>{additionalRequirement.label}: {additionalRequirement.description}</span>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Disclaimer de Cierre Formal
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                El Gerente de Proyecto confirma que la información presentada en esta etapa corresponde a lo acordado con el cliente y ha sido validada para proceder con el cierre formal.
              </p>
            </div>
          </div>
        </div>

        {/* Confirmation checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            disabled={!requirementMet}
          />
          <span className="text-xs text-foreground leading-relaxed group-hover:text-blue-600 transition-colors">
            Confirmo que la información de esta etapa ha sido revisada y corresponde a lo acordado con el cliente. Entiendo que este cierre es irreversible y desbloquea la siguiente etapa del proyecto.
          </span>
        </label>

        {/* Optional notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Observaciones de cierre (opcional)</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Agregar observaciones o comentarios sobre el cierre de esta etapa..."
            className="text-xs min-h-[60px] resize-none"
            disabled={!requirementMet}
          />
        </div>

        {/* Close button */}
        <Button
          onClick={handleClose}
          disabled={!confirmed || !requirementMet || formalCloseMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
        >
          {formalCloseMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Cerrando etapa y sincronizando JIRA...</>
          ) : (
            <><ShieldCheck className="h-4 w-4 mr-2" /> Cerrar Etapa Formalmente</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
