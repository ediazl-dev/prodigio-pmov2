import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { CalendarRange, Loader2, Save, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const C = {
  cardBg: "#FFFFFF",
  border: "#E2E8F0",
  textPrimary: "#1E293B",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  accent: "#e91e8c",
  amber: "#D97706",
  amberBg: "#FEF3C7",
  green: "#059669",
};

/** Propuesta y baseline ejecutivo: Jira aporta observaciones, pero la aprobación contractual es humana. */
export function BaselineExecutiveCard({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portfolioConsole.getBaseline.useQuery({ projectId });
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [approvalNotes, setApprovalNotes] = useState("");
  const isDraft = data?.source?.sourceStatus === "draft";

  useEffect(() => {
    if (!data?.milestones) return;
    const initial: Record<number, string> = {};
    data.milestones.forEach((milestone: any) => {
      if (milestone.baselineDate) initial[milestone.id] = String(milestone.baselineDate).slice(0, 10);
    });
    setEdits(initial);
  }, [data]);

  const updateMutation = trpc.portfolioConsole.updateMilestoneBaseline.useMutation({
    onSuccess: () => {
      toast.success("Fecha propuesta actualizada");
      utils.portfolioConsole.getBaseline.invalidate({ projectId });
    },
    onError: (error) => toast.error(error.message),
  });

  const createMutation = trpc.portfolioConsole.createBaselineFromJira.useMutation({
    onSuccess: (result) => {
      toast.success(`Propuesta creada: ${result.milestonesImported} hitos mapeados desde Jira`);
      utils.portfolioConsole.getBaseline.invalidate({ projectId });
      utils.portfolioConsole.getPortfolioConsole.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const approveMutation = trpc.portfolioConsole.approveBaselineProposal.useMutation({
    onSuccess: () => {
      toast.success("Baseline aprobado con confirmación humana");
      setApprovalNotes("");
      utils.portfolioConsole.getBaseline.invalidate({ projectId });
      utils.portfolioConsole.getPortfolioConsole.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const dirty = data?.milestones?.some((milestone: any) => {
    const original = milestone.baselineDate ? String(milestone.baselineDate).slice(0, 10) : "";
    return (edits[milestone.id] ?? "") !== original;
  }) ?? false;
  const hasMissingBaseline = data?.milestones?.some((milestone: any) => !milestone.baselineDate) ?? false;

  const handleSave = async () => {
    if (!data?.milestones) return;
    const changed = data.milestones.filter((milestone: any) => {
      const original = milestone.baselineDate ? String(milestone.baselineDate).slice(0, 10) : "";
      const edited = edits[milestone.id] ?? "";
      return edited !== original && edited !== "";
    });
    for (const milestone of changed) {
      await updateMutation.mutateAsync({ projectId, milestoneId: milestone.id, baselineDate: edits[milestone.id] });
    }
  };

  return (
    <div style={{ background: C.cardBg, borderRadius: 14, padding: "18px 24px", boxShadow: "0 2px 16px rgba(10,22,40,.08)", border: `1px solid ${C.border}`, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #D97706, #F59E0B)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CalendarRange style={{ width: 18, height: 18, color: "#fff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>Baseline Ejecutivo</p>
          <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>Baseline contractual, planificación Jira, cierre Jira y aceptación del cliente se conservan como evidencias separadas.</p>
        </div>
        {data?.source && (
          <span style={{ fontSize: 10, fontWeight: 700, color: isDraft ? C.amber : C.green, background: isDraft ? C.amberBg : "#ECFDF5", border: `1px solid ${isDraft ? "#FDE68A" : "#A7F3D0"}`, borderRadius: 999, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
            {isDraft ? <TriangleAlert style={{ width: 12, height: 12 }} /> : <ShieldCheck style={{ width: 12, height: 12 }} />}
            {isDraft ? "Propuesta provisional" : "Aprobado"} · {data.source.baselineVersion}
          </span>
        )}
      </div>

      {isLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 12, padding: "12px 0" }}>
          <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> Cargando baseline…
        </div>
      )}

      {!isLoading && !data && (
        <div style={{ background: C.amberBg, border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>Sin baseline ejecutivo aprobado</p>
            <p style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>Genere una propuesta desde los hitos aprobados durante el onboarding. Las fechas Jira serán referencia operativa y deberán revisarse antes de aprobar el baseline contractual.</p>
          </div>
          {canManage && (
            <Button size="sm" disabled={createMutation.isPending} onClick={() => createMutation.mutate({ projectId })} style={{ background: C.amber, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, padding: "8px 16px", borderRadius: 8 }}>
              {createMutation.isPending ? <Loader2 className="animate-spin" style={{ width: 14, height: 14, marginRight: 6 }} /> : null}
              Generar propuesta desde Jira
            </Button>
          )}
        </div>
      )}

      {!isLoading && data && (
        <>
          {isDraft && (
            <div style={{ background: C.amberBg, border: "1px solid #FDE68A", borderRadius: 10, padding: "11px 14px", marginBottom: 12, color: "#92400E", fontSize: 11 }}>
              <strong>Propuesta pendiente:</strong> revise cada fecha contractual. Jira no aprueba el baseline y un cierre Jira no equivale a aceptación del cliente.
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={headerStyle}>Hito</th>
                  <th style={headerStyle}>Título</th>
                  <th style={headerStyle}>{isDraft ? "Baseline propuesto" : "Baseline contractual"}</th>
                  <th style={headerStyle}>Plan Jira</th>
                  <th style={headerStyle}>Cierre Jira</th>
                  <th style={headerStyle}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.milestones.map((milestone: any) => (
                  <tr key={milestone.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: C.textPrimary, fontFamily: "monospace" }}>{milestone.milestoneCode}</td>
                    <td style={{ padding: "8px 10px", color: C.textSecondary, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={milestone.title}>{milestone.title}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {canManage && isDraft ? (
                        <Input type="date" value={edits[milestone.id] ?? ""} onChange={(event) => setEdits((previous) => ({ ...previous, [milestone.id]: event.target.value }))} style={{ fontSize: 12, height: 32, width: 150 }} />
                      ) : (
                        <span style={{ color: milestone.baselineDate ? C.textPrimary : C.amber, fontWeight: 600 }}>{milestone.baselineDate ? String(milestone.baselineDate).slice(0, 10) : "[PENDIENTE]"}</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px", color: C.textSecondary }}>{milestone.jiraDueDate ? String(milestone.jiraDueDate).slice(0, 10) : "[PENDIENTE EN JIRA]"}</td>
                    <td style={{ padding: "8px 10px", color: C.textSecondary }}>{milestone.jiraClosedDate ? String(milestone.jiraClosedDate).slice(0, 10) : "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "3px 8px", color: milestone.semanticStatus === "fulfilled" ? C.green : milestone.semanticStatus === "delayed" ? "#DC2626" : C.textSecondary, background: milestone.semanticStatus === "fulfilled" ? "#ECFDF5" : milestone.semanticStatus === "delayed" ? "#FEF2F2" : "#F1F5F9" }}>
                        {milestone.semanticStatus === "fulfilled" ? "Cumplido" : milestone.semanticStatus === "delayed" ? "Atrasado" : milestone.semanticStatus === "blocked" ? "Bloqueado" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canManage && isDraft && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <label style={{ flex: 1, minWidth: 260, fontSize: 11, color: C.textSecondary }}>
                Nota de aprobación obligatoria
                <Input value={approvalNotes} onChange={(event) => setApprovalNotes(event.target.value)} placeholder="Confirme la evidencia contractual revisada" style={{ marginTop: 5, fontSize: 12, height: 34 }} />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <Button size="sm" disabled={!dirty || updateMutation.isPending} onClick={handleSave} style={{ background: dirty ? C.accent : "#CBD5E1", color: "#fff", border: "none", fontWeight: 700, fontSize: 12, padding: "8px 18px", borderRadius: 8 }}>
                  {updateMutation.isPending ? <Loader2 className="animate-spin" style={{ width: 14, height: 14, marginRight: 6 }} /> : <Save style={{ width: 14, height: 14, marginRight: 6 }} />}
                  Guardar cambios
                </Button>
                <Button size="sm" disabled={dirty || hasMissingBaseline || approvalNotes.trim().length < 10 || approveMutation.isPending} onClick={() => approveMutation.mutate({ projectId, sourceId: data.source.id, approvalNotes: approvalNotes.trim() })} style={{ background: C.green, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, padding: "8px 18px", borderRadius: 8 }}>
                  {approveMutation.isPending ? <Loader2 className="animate-spin" style={{ width: 14, height: 14, marginRight: 6 }} /> : <ShieldCheck style={{ width: 14, height: 14, marginRight: 6 }} />}
                  Aprobar baseline
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const headerStyle = {
  textAlign: "left" as const,
  padding: "8px 10px",
  color: C.textMuted,
  fontWeight: 700,
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
};
