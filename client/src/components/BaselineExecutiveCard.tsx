import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { CalendarRange, Loader2, Save, ShieldCheck } from "lucide-react";
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
  teal: "#0D9488",
};

/** Card de Baseline Ejecutivo: muestra hitos contractuales con baselineDate editable,
 *  o permite crear el baseline desde los hitos del tablero Jira si no existe. */
export function BaselineExecutiveCard({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portfolioConsole.getBaseline.useQuery({ projectId });
  const [edits, setEdits] = useState<Record<number, string>>({});

  useEffect(() => {
    if (data?.milestones) {
      const initial: Record<number, string> = {};
      data.milestones.forEach((m: any) => {
        if (m.baselineDate) initial[m.id] = String(m.baselineDate).slice(0, 10);
      });
      setEdits(initial);
    }
  }, [data]);

  const updateMutation = trpc.portfolioConsole.updateMilestoneBaseline.useMutation({
    onSuccess: () => {
      toast.success("Fecha baseline actualizada");
      utils.portfolioConsole.getBaseline.invalidate({ projectId });
      utils.portfolioConsole.getPortfolioConsole.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.portfolioConsole.createBaselineFromJira.useMutation({
    onSuccess: (r) => {
      toast.success(`Baseline creado: ${r.hitosImportados} hitos importados desde Jira`);
      utils.portfolioConsole.getBaseline.invalidate({ projectId });
      utils.portfolioConsole.getPortfolioConsole.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const dirty = data?.milestones?.some((m: any) => {
    const original = m.baselineDate ? String(m.baselineDate).slice(0, 10) : "";
    return (edits[m.id] ?? "") !== original;
  });

  const handleSave = async () => {
    if (!data?.milestones) return;
    const changed = data.milestones.filter((m: any) => {
      const original = m.baselineDate ? String(m.baselineDate).slice(0, 10) : "";
      const edited = edits[m.id] ?? "";
      return edited !== original && edited !== "";
    });
    for (const m of changed) {
      await updateMutation.mutateAsync({ milestoneId: m.id, baselineDate: edits[m.id] });
    }
  };

  return (
    <div style={{
      background: C.cardBg, borderRadius: 14, padding: "18px 24px",
      boxShadow: "0 2px 16px rgba(10,22,40,.08)", border: `1px solid ${C.border}`, marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #D97706, #F59E0B)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CalendarRange style={{ width: 18, height: 18, color: "#fff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>Baseline Ejecutivo</p>
          <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
            Fechas comprometidas contractualmente por hito. La Consola de Gobierno y el motor de gobernanza usan esta línea base.
          </p>
        </div>
        {data?.source && (
          <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 999, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
            <ShieldCheck style={{ width: 12, height: 12 }} /> Aprobado · {data.source.baselineVersion}
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
            <p style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>
              Este proyecto se evalúa en la Consola con veredicto IA y datos Jira/financieros. Crea el baseline importando los hitos del tablero Jira (sus fechas duedate quedan como línea base inicial editable).
            </p>
          </div>
          {canManage && (
            <Button
              size="sm"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate({ projectId })}
              style={{ background: C.amber, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, padding: "8px 16px", borderRadius: 8 }}
            >
              {createMutation.isPending ? <Loader2 className="animate-spin" style={{ width: 14, height: 14, marginRight: 6 }} /> : null}
              Crear baseline desde Jira
            </Button>
          )}
        </div>
      )}

      {!isLoading && data && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: C.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Hito</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: C.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Título</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: C.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Baseline contractual</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: C.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Fecha Jira</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: C.textMuted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.milestones.map((m: any) => (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: C.textPrimary, fontFamily: "monospace" }}>{m.milestoneCode}</td>
                    <td style={{ padding: "8px 10px", color: C.textSecondary, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.title}>{m.title}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {canManage ? (
                        <Input
                          type="date"
                          value={edits[m.id] ?? ""}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [m.id]: e.target.value }))}
                          style={{ fontSize: 12, height: 32, width: 150 }}
                        />
                      ) : (
                        <span style={{ color: C.textPrimary, fontWeight: 600 }}>{m.baselineDate ? String(m.baselineDate).slice(0, 10) : "—"}</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px", color: C.textSecondary }}>{m.jiraDueDate ? String(m.jiraDueDate).slice(0, 10) : "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "3px 8px",
                        color: m.semanticStatus === "fulfilled" ? C.green : m.semanticStatus === "delayed" ? "#DC2626" : C.textSecondary,
                        background: m.semanticStatus === "fulfilled" ? "#ECFDF5" : m.semanticStatus === "delayed" ? "#FEF2F2" : "#F1F5F9",
                      }}>
                        {m.semanticStatus === "fulfilled" ? "Cumplido" : m.semanticStatus === "delayed" ? "Atrasado" : m.semanticStatus === "blocked" ? "Bloqueado" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canManage && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <Button
                size="sm"
                disabled={!dirty || updateMutation.isPending}
                onClick={handleSave}
                style={{ background: dirty ? C.accent : "#CBD5E1", color: "#fff", border: "none", fontWeight: 700, fontSize: 12, padding: "8px 18px", borderRadius: 8 }}
              >
                {updateMutation.isPending ? <Loader2 className="animate-spin" style={{ width: 14, height: 14, marginRight: 6 }} /> : <Save style={{ width: 14, height: 14, marginRight: 6 }} />}
                Guardar cambios
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
