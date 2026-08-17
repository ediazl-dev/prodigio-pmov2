import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, CheckCircle2, Loader2, AlertTriangle, FileText, Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { Input } from "@/components/ui/input";

const C = {
  navy: "#0B1A2E", navy2: "#132B4A", accent: "#3B8EE8",
  green: "#059669", red: "#DC2626", gold: "#F59E0B",
  bg: "#F4F7FB", border: "#E2E8F0", textPrimary: "#1E293B", textSecondary: "#64748B", textMuted: "#94A3B8",
};

export default function RSClosureStage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: svcData } = trpc.recurringServices.getById.useQuery({ id });
  const { data: stagesData } = trpc.recurringServices.getStages.useQuery({ serviceId: id });
  const { data: dashboard } = trpc.recurringServices.getExecutionDashboard.useQuery({ serviceId: id });

  const stage = stagesData?.find((s: any) => s.stageId === "cierre");
  const isActive = stage?.status === "in_progress";
  const isCompleted = stage?.status === "completed";
  const svc = svcData?.service;

  const [showPenaltyDialog, setShowPenaltyDialog] = useState(false);
  const [penalty, setPenalty] = useState({ reason: "", description: "", amount: 0, monthNumber: 1 });

  const createPenaltyMutation = trpc.recurringServices.createPenalty.useMutation({
    onSuccess: () => { toast.success("Multa registrada"); utils.recurringServices.getExecutionDashboard.invalidate({ serviceId: id }); setShowPenaltyDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  const closeMutation = trpc.recurringServices.closeService.useMutation({
    onSuccess: () => {
      toast.success("Servicio cerrado exitosamente");
      utils.recurringServices.getById.invalidate({ id });
      utils.recurringServices.getStages.invalidate({ serviceId: id });
      utils.recurringServices.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!svc) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={32} className="animate-spin" color={C.accent} /></div>;

  const metrics = dashboard?.metrics;
  const penalties = dashboard?.penalties ?? [];

  return (
    <div style={{ background: C.bg, fontFamily: "'Inter', sans-serif", color: C.textPrimary, minHeight: "100vh" }}>
      <AppBreadcrumb segments={[
        { label: "Servicios Recurrentes", href: "/recurring-services" },
        { label: svc.serviceName, href: `/recurring-services/${id}` },
        { label: "Cierre" },
      ]} />

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 100%)`,
        borderBottom: "3px solid #8B5CF6",
        borderRadius: 16, padding: "24px 32px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(`/recurring-services/${id}`)} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
            <ArrowLeft size={16} color="#fff" />
          </button>
          <CheckCircle2 size={20} color="#8B5CF6" />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Cierre del Servicio</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{svc.serviceName} &middot; {svc.clientName}</p>
          </div>
          {isCompleted && (
            <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 10, background: "#DCFCE7", color: "#166534" }}>
              COMPLETADA
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Resumen del Contrato</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div style={{ padding: "12px 16px", borderRadius: 8, background: "#F8FAFC" }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.textMuted }}>Duración</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{svc.durationMonths} meses</div>
            <div style={{ fontSize: 11, color: C.textSecondary }}>
              {svc.formalStartDate ? new Date(svc.formalStartDate).toLocaleDateString("es-CL") : "N/A"} — {svc.endDate ? new Date(svc.endDate).toLocaleDateString("es-CL") : "N/A"}
            </div>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: 8, background: "#F8FAFC" }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.textMuted }}>Monto Total</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>
              {svc.currency} {svc.totalContractAmount ? parseFloat(svc.totalContractAmount).toLocaleString() : "—"}
            </div>
            <div style={{ fontSize: 11, color: C.textSecondary }}>
              Facturado: {svc.currency} {metrics?.totalBilled?.toLocaleString() ?? "0"}
            </div>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: 8, background: "#F8FAFC" }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.textMuted }}>Avance Tareas</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>
              {metrics?.completionRate ?? 0}%
            </div>
            <div style={{ fontSize: 11, color: C.textSecondary }}>
              {metrics?.completedItems ?? 0} / {metrics?.totalItems ?? 0} completadas
            </div>
          </div>
        </div>
      </div>

      {/* Penalties */}
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
            <AlertTriangle size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} color={C.gold} />
            Multas ({penalties.length})
          </h3>
          {isActive && (
            <Button size="sm" variant="outline" onClick={() => setShowPenaltyDialog(true)}>
              <Plus size={14} className="mr-1" /> Registrar Multa
            </Button>
          )}
        </div>
        {penalties.length === 0 ? (
          <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 20 }}>Sin multas registradas</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {penalties.map((p: any) => (
              <div key={p.id} style={{ padding: "12px 16px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#991B1B" }}>{p.reason}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{p.currency} {parseFloat(p.amount).toLocaleString()}</span>
                </div>
                {p.description && <p style={{ fontSize: 11, color: "#7F1D1D", marginTop: 4 }}>{p.description}</p>}
                <p style={{ fontSize: 10, color: "#B91C1C", marginTop: 4 }}>Mes {p.monthNumber} &middot; {new Date(p.createdAt).toLocaleDateString("es-CL")}</p>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 0" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>
                Total multas: {svc.currency} {penalties.reduce((s: number, p: any) => s + parseFloat(p.amount ?? 0), 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Close service */}
      {isActive && (
        <div style={{
          background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px",
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Cierre Formal</h3>
          <p style={{ fontSize: 12, color: C.textSecondary, marginBottom: 16 }}>
            Al cerrar el servicio, se marcará como completado y no se podrán realizar más cambios.
            Asegúrate de que todas las cuotas estén facturadas y las multas registradas.
          </p>
          <Button
            onClick={() => closeMutation.mutate({ serviceId: id })}
            disabled={closeMutation.isPending}
            style={{ background: "#8B5CF6", color: "#fff", fontWeight: 700 }}
          >
            {closeMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <CheckCircle2 size={16} className="mr-1" />}
            Cerrar Servicio
          </Button>
        </div>
      )}

      {isCompleted && (
        <div style={{
          background: "#F0FDF4", borderRadius: 12, border: "1px solid #BBF7D0", padding: "20px 24px",
          textAlign: "center",
        }}>
          <CheckCircle2 size={32} color={C.green} style={{ margin: "0 auto 8px" }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#166534" }}>Servicio Cerrado</h3>
          <p style={{ fontSize: 12, color: "#15803D", marginTop: 4 }}>
            Este servicio ha sido cerrado formalmente el {stage?.completedAt ? new Date(stage.completedAt).toLocaleDateString("es-CL") : "—"}
          </p>
        </div>
      )}

      {/* Penalty Dialog */}
      <Dialog open={showPenaltyDialog} onOpenChange={setShowPenaltyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Multa</DialogTitle></DialogHeader>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <Label>Razón</Label>
              <Input value={penalty.reason} onChange={(e) => setPenalty({ ...penalty, reason: e.target.value })} placeholder="Ej: Incumplimiento SLA Crítico" style={{ marginTop: 4 }} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={penalty.description} onChange={(e) => setPenalty({ ...penalty, description: e.target.value })} placeholder="Detalle de la multa..." style={{ marginTop: 4 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <Label>Monto ({svc.currency})</Label>
                <Input type="number" min={0} value={penalty.amount} onChange={(e) => setPenalty({ ...penalty, amount: parseFloat(e.target.value) || 0 })} style={{ marginTop: 4 }} />
              </div>
              <div>
                <Label>Mes</Label>
                <Input type="number" min={1} max={svc.durationMonths} value={penalty.monthNumber} onChange={(e) => setPenalty({ ...penalty, monthNumber: parseInt(e.target.value) || 1 })} style={{ marginTop: 4 }} />
              </div>
            </div>
            <Button
              onClick={() => createPenaltyMutation.mutate({ serviceId: id, penaltyDate: new Date().toISOString().slice(0, 10), description: `${penalty.reason}${penalty.description ? " - " + penalty.description : ""} (Mes ${penalty.monthNumber})`, amount: penalty.amount, currency: svc.currency ?? "USD" })}
              disabled={createPenaltyMutation.isPending || !penalty.reason || penalty.amount <= 0}
              style={{ background: C.red, color: "#fff" }}
            >
              {createPenaltyMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <AlertTriangle size={16} className="mr-1" />}
              Registrar Multa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
