import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Calendar, CheckCircle2, Clock, Loader2, Plus, Sparkles, Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

const C = {
  navy: "#0B1A2E", navy2: "#132B4A", accent: "#3B8EE8",
  green: "#059669", red: "#DC2626",
  bg: "#F4F7FB", border: "#E2E8F0", textPrimary: "#1E293B", textSecondary: "#64748B", textMuted: "#94A3B8",
};

const ITEM_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  informe_mensual: { label: "Informe Mensual", color: "#3B82F6" },
  facturacion: { label: "Facturación", color: "#F59E0B" },
  tarea_programada: { label: "Tarea Programada", color: "#10B981" },
  sla_definition: { label: "Definición SLA", color: "#8B5CF6" },
  coverage_definition: { label: "Cobertura", color: "#EC4899" },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  critical: { label: "Crítica", color: "#DC2626" },
  high: { label: "Alta", color: "#F59E0B" },
  medium: { label: "Media", color: "#3B82F6" },
  low: { label: "Baja", color: "#10B981" },
};

export default function RSWorkPlanStage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: svcData } = trpc.recurringServices.getById.useQuery({ id });
  const { data: stagesData } = trpc.recurringServices.getStages.useQuery({ serviceId: id });
  const { data: workPlan, isLoading } = trpc.recurringServices.getWorkPlan.useQuery({ serviceId: id });

  const stage = stagesData?.find((s: any) => s.stageId === "plan_trabajo");
  const isActive = stage?.status === "in_progress";
  const isCompleted = stage?.status === "completed";
  const svc = svcData?.service;

  const [showDateDialog, setShowDateDialog] = useState(false);
  const [formalStart, setFormalStart] = useState(svc?.formalStartDate ?? "");
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [newItem, setNewItem] = useState({ itemType: "tarea_programada", title: "", description: "", frequency: "mensual", monthNumber: 1 });

  const setDateMutation = trpc.recurringServices.setFormalStartDate.useMutation({
    onSuccess: () => { toast.success("Fecha de inicio guardada"); utils.recurringServices.getById.invalidate({ id }); setShowDateDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  const generateMutation = trpc.recurringServices.generateWorkPlan.useMutation({
    onSuccess: (r) => { toast.success(`Plan generado: ${r.itemCount} ítems, ${r.slaCount} SLAs`); utils.recurringServices.getWorkPlan.invalidate({ serviceId: id }); },
    onError: (e) => toast.error(e.message),
  });

  const saveItemMutation = trpc.recurringServices.saveWorkPlanItem.useMutation({
    onSuccess: () => { toast.success("Ítem guardado"); utils.recurringServices.getWorkPlan.invalidate({ serviceId: id }); setShowItemDialog(false); },
    onError: (e) => toast.error(e.message),
  });

  const deleteItemMutation = trpc.recurringServices.deleteWorkPlanItem.useMutation({
    onSuccess: () => { toast.success("Ítem eliminado"); utils.recurringServices.getWorkPlan.invalidate({ serviceId: id }); },
    onError: (e) => toast.error(e.message),
  });

  const closeMutation = trpc.recurringServices.closeWorkPlanStage.useMutation({
    onSuccess: () => { toast.success("Etapa cerrada"); utils.recurringServices.getById.invalidate({ id }); utils.recurringServices.getStages.invalidate({ serviceId: id }); },
    onError: (e) => toast.error(e.message),
  });

  if (!svc) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={32} className="animate-spin" color={C.accent} /></div>;

  return (
    <div style={{ background: C.bg, fontFamily: "'Inter', sans-serif", color: C.textPrimary, minHeight: "100vh" }}>
      <AppBreadcrumb segments={[
        { label: "Servicios Recurrentes", href: "/recurring-services" },
        { label: svc.serviceName, href: `/recurring-services/${id}` },
        { label: "Plan de Trabajo" },
      ]} />

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 100%)`,
        borderBottom: "3px solid #3B82F6",
        borderRadius: 16, padding: "24px 32px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(`/recurring-services/${id}`)} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
            <ArrowLeft size={16} color="#fff" />
          </button>
          <Clock size={20} color="#3B82F6" />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Plan de Trabajo</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{svc.serviceName} &middot; {svc.clientName}</p>
          </div>
          {isCompleted && (
            <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 10, background: "#DCFCE7", color: "#166534" }}>
              COMPLETADA
            </span>
          )}
        </div>
      </div>

      {/* Formal Start Date */}
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Fecha Formal de Inicio</h3>
            <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
              {svc.formalStartDate
                ? `${new Date(svc.formalStartDate).toLocaleDateString("es-CL")} — Fin estimado: ${svc.endDate ? new Date(svc.endDate).toLocaleDateString("es-CL") : "N/A"}`
                : "No definida"}
            </p>
          </div>
          {isActive && (
            <Button size="sm" variant="outline" onClick={() => { setFormalStart(svc.formalStartDate ?? ""); setShowDateDialog(true); }}>
              <Calendar size={14} className="mr-1" /> {svc.formalStartDate ? "Cambiar" : "Definir"}
            </Button>
          )}
        </div>
      </div>

      {/* Work Plan Items */}
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
            Ítems del Plan ({workPlan?.items.length ?? 0})
          </h3>
          {isActive && (
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" variant="outline" onClick={() => generateMutation.mutate({ serviceId: id })} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Sparkles size={14} className="mr-1" />}
                Generar con IA
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowItemDialog(true)}>
                <Plus size={14} className="mr-1" /> Agregar
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Loader2 size={24} className="animate-spin" color={C.accent} /></div>
        ) : !workPlan?.items.length ? (
          <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 40 }}>
            Genera el plan de trabajo con IA o agrega ítems manualmente
          </p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {workPlan.items.map((item: any) => {
              const typeInfo = ITEM_TYPE_LABELS[item.itemType] ?? { label: item.itemType, color: C.accent };
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#F8FAFC", border: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: typeInfo.color + "15", color: typeInfo.color }}>
                        {typeInfo.label}
                      </span>
                      {item.monthNumber && (
                        <span style={{ fontSize: 9, color: C.textMuted }}>Mes {item.monthNumber}</span>
                      )}
                      {item.frequency && (
                        <span style={{ fontSize: 9, color: C.textMuted }}>&middot; {item.frequency}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>{item.title}</span>
                    {item.description && <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{item.description}</p>}
                  </div>
                  {isActive && (
                    <button onClick={() => deleteItemMutation.mutate({ id: item.id })} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                      <Trash2 size={14} color={C.red} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SLA Config */}
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Configuración SLA</h3>
        {!workPlan?.sla.length ? (
          <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 20 }}>
            Los SLAs se generan automáticamente con el plan de trabajo
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Prioridad", "Primera Respuesta", "Resolución", "Cobertura"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workPlan.sla.map((s: any) => {
                  const pInfo = PRIORITY_LABELS[s.priority] ?? { label: s.priority, color: C.accent };
                  return (
                    <tr key={s.id}>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.bg}` }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: pInfo.color + "15", color: pInfo.color }}>
                          {pInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.bg}`, fontWeight: 600 }}>
                        {s.firstResponseMinutes < 60 ? `${s.firstResponseMinutes} min` : `${Math.round(s.firstResponseMinutes / 60)}h`}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.bg}`, fontWeight: 600 }}>
                        {s.resolutionMinutes < 60 ? `${s.resolutionMinutes} min` : `${Math.round(s.resolutionMinutes / 60)}h`}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.bg}` }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#F1F5F9" }}>
                          {s.coverageType}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Close stage */}
      {isActive && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
          <Button onClick={() => closeMutation.mutate({ serviceId: id })} disabled={closeMutation.isPending} style={{ background: C.green, color: "#fff", fontWeight: 700 }}>
            {closeMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <CheckCircle2 size={16} className="mr-1" />}
            Cerrar Etapa Plan de Trabajo
          </Button>
        </div>
      )}

      {/* Date Dialog */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fecha Formal de Inicio</DialogTitle></DialogHeader>
          <div>
            <Label>Fecha de Inicio</Label>
            <Input type="date" value={formalStart} onChange={(e) => setFormalStart(e.target.value)} style={{ marginTop: 4 }} />
            <p style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
              Duración: {svc.durationMonths} meses. La fecha de fin se calculará automáticamente.
            </p>
            <Button
              onClick={() => setDateMutation.mutate({ serviceId: id, formalStartDate: formalStart })}
              disabled={setDateMutation.isPending || !formalStart}
              className="mt-4 w-full"
              style={{ background: C.accent, color: "#fff" }}
            >
              {setDateMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : null}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Ítem al Plan</DialogTitle></DialogHeader>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <Label>Tipo</Label>
              <Select value={newItem.itemType} onValueChange={(v) => setNewItem({ ...newItem, itemType: v })}>
                <SelectTrigger style={{ marginTop: 4 }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="informe_mensual">Informe Mensual</SelectItem>
                  <SelectItem value="facturacion">Facturación</SelectItem>
                  <SelectItem value="tarea_programada">Tarea Programada</SelectItem>
                  <SelectItem value="sla_definition">Definición SLA</SelectItem>
                  <SelectItem value="coverage_definition">Cobertura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} style={{ marginTop: 4 }} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} style={{ marginTop: 4 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <Label>Frecuencia</Label>
                <Select value={newItem.frequency} onValueChange={(v) => setNewItem({ ...newItem, frequency: v })}>
                  <SelectTrigger style={{ marginTop: 4 }}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Única</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quincenal">Quincenal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mes</Label>
                <Input type="number" min={1} value={newItem.monthNumber} onChange={(e) => setNewItem({ ...newItem, monthNumber: parseInt(e.target.value) || 1 })} style={{ marginTop: 4 }} />
              </div>
            </div>
            <Button
              onClick={() => saveItemMutation.mutate({ serviceId: id, item: newItem as any })}
              disabled={saveItemMutation.isPending || !newItem.title}
              style={{ background: C.accent, color: "#fff" }}
            >
              {saveItemMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <Plus size={16} className="mr-1" />}
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
