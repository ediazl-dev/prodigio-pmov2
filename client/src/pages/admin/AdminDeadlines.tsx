import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Calendar, Clock, Info, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { C, headerGradient, cardStyle, headerKpiCard, headerKpiLabel, headerKpiValue, footerStyle, footerText } from "./adminStyles";

const STAGE_ICONS: Record<string, string> = { sow: "📄", jira: "🔧", risks: "⚠️", planning: "📋", design: "🏗️", closure: "✅" };
const STAGE_BORDERS: Record<string, string> = { sow: C.accent, jira: C.blue, risks: C.gold, planning: C.green, design: C.teal, closure: C.teal2 };

interface DeadlineForm { stageId: string; maxBusinessDays: number; label: string; description: string; }

export default function AdminDeadlines() {
  const { user } = useAuth();
  const canEdit = (user as any)?.role === "admin";
  const { data: deadlines, isLoading, refetch } = trpc.deadlines.list.useQuery();
  const { data: holidays } = trpc.holidays.list.useQuery();
  const bulkUpdate = trpc.deadlines.bulkUpdate.useMutation();
  const [forms, setForms] = useState<DeadlineForm[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (deadlines && deadlines.length > 0) {
      setForms(deadlines.map((d) => ({ stageId: d.stageId, maxBusinessDays: d.maxBusinessDays, label: d.label, description: d.description ?? "" })));
    }
  }, [deadlines]);

  const updateField = (idx: number, field: keyof DeadlineForm, value: string | number) => {
    setForms((prev) => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await bulkUpdate.mutateAsync({ deadlines: forms.map((f) => ({ stageId: f.stageId as any, maxBusinessDays: f.maxBusinessDays, label: f.label, description: f.description || undefined })) });
      toast.success("Plazos actualizados correctamente"); setHasChanges(false); refetch();
    } catch (err: any) { toast.error(err.message || "Error al guardar"); }
  };

  const holidaysByYear: Record<number, number> = {};
  holidays?.forEach((h) => { holidaysByYear[h.year] = (holidaysByYear[h.year] || 0) + 1; });

  if (isLoading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: C.accent }} /></div>;

  return (
    <div style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy, minHeight: "100vh" }}>
      {/* ── HEADER ── */}
      <div style={{ ...headerGradient, padding: "32px 36px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span style={{ background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>REPORTES</span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <Clock className="h-6 w-6" style={{ color: C.accent }} /> Plazos Máximos por Etapa
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>{canEdit ? "Consulta y configura los días hábiles máximos permitidos para completar cada etapa" : "Consulta los días hábiles máximos vigentes para completar cada etapa"}</p>
          </div>
          {canEdit && <Button onClick={handleSave} disabled={!hasChanges || bulkUpdate.isPending} style={{ background: hasChanges ? C.accent : C.g400, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, padding: "8px 18px", display: "flex", alignItems: "center", gap: 6, opacity: hasChanges ? 1 : .5 }}>
            {bulkUpdate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar Cambios
          </Button>}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          {[
            { label: "Etapas", value: forms.length },
            { label: "Feriados Cargados", value: holidays?.length ?? 0 },
          ].map((k) => (
            <div key={k.label} style={headerKpiCard}>
              <div style={headerKpiLabel}>{k.label}</div>
              <div style={headerKpiValue}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Info card */}
        <div style={{ ...cardStyle, padding: 16, display: "flex", alignItems: "flex-start", gap: 12, background: `${C.accent}08`, border: `1px solid ${C.accent}30` }}>
          <Info className="h-5 w-5" style={{ color: C.accent, flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: C.navy }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>Cálculo de Días Hábiles</p>
            <p style={{ color: C.g400 }}>Los plazos se calculan en <strong>días hábiles</strong> (lunes a viernes), excluyendo los feriados oficiales de Chile. El conteo inicia cuando el Gerente de Proyecto abre por primera vez la etapa correspondiente.</p>
          </div>
        </div>

        {!canEdit && <div style={{ ...cardStyle, padding: 14, fontSize: 12, color: C.g400 }}><strong style={{ color: C.navy }}>Modo de consulta.</strong> Los plazos sólo pueden ser modificados por un administrador.</div>}

        {/* Stage cards */}
        {forms.map((form, idx) => (
          <div key={form.stageId} style={{ ...cardStyle, borderLeft: `4px solid ${STAGE_BORDERS[form.stageId] ?? C.g300}`, padding: "18px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "200px 100px 1fr 1fr", gap: 16, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>{STAGE_ICONS[form.stageId] ?? "📌"}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{form.label}</p>
                  <p style={{ fontSize: 10, color: C.g400, textTransform: "uppercase", letterSpacing: ".06em" }}>{form.stageId}</p>
                </div>
              </div>
              <div>
                <Label style={{ fontSize: 10, color: C.g400 }}>Días Hábiles</Label>
                <Input disabled={!canEdit} type="number" min={1} max={365} value={form.maxBusinessDays} onChange={(e) => updateField(idx, "maxBusinessDays", parseInt(e.target.value) || 1)} className="mt-1 text-center font-bold text-lg" />
              </div>
              <div>
                <Label style={{ fontSize: 10, color: C.g400 }}>Etiqueta</Label>
                <Input disabled={!canEdit} value={form.label} onChange={(e) => updateField(idx, "label", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label style={{ fontSize: 10, color: C.g400 }}>Descripción</Label>
                <Textarea disabled={!canEdit} value={form.description} onChange={(e) => updateField(idx, "description", e.target.value)} className="mt-1 resize-none" rows={1} placeholder="Descripción del plazo..." />
              </div>
            </div>
          </div>
        ))}

        {/* Holidays */}
        <div style={{ ...cardStyle, padding: "20px 24px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Calendar className="h-5 w-5" style={{ color: C.accent }} /> Feriados de Chile Cargados
          </h3>
          <p style={{ fontSize: 12, color: C.g400, marginBottom: 16 }}>Feriados oficiales que se excluyen del cálculo de días hábiles.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {Object.entries(holidaysByYear).sort(([a], [b]) => Number(a) - Number(b)).map(([year, count]) => (
              <div key={year} style={{ background: C.g100, borderRadius: 10, padding: "12px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>{count}</p>
                <p style={{ fontSize: 11, color: C.g400 }}>Feriados {year}</p>
              </div>
            ))}
          </div>
          {holidays && holidays.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Feriados {new Date().getFullYear()}:</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
                {holidays.filter((h) => h.year === new Date().getFullYear()).map((h, i) => {
                  const dateStr = String(h.date).split("T")[0];
                  const dateObj = new Date(dateStr + "T12:00:00");
                  const dayOfWeek = dateObj.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "6px 10px", borderRadius: 8, background: isWeekend ? C.g100 : `${C.accent}08`, color: isWeekend ? C.g400 : C.navy }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: isWeekend ? C.g400 : C.accent, whiteSpace: "nowrap" }}>
                        {dayNames[dayOfWeek]} {dateObj.getDate().toString().padStart(2, "0")} {monthNames[dateObj.getMonth()]}
                      </span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                      {isWeekend && <span style={{ fontSize: 10, color: C.g400, marginLeft: "auto", flexShrink: 0 }}>(fin de semana)</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={footerStyle}>
        <span style={footerText}>Prodigio PMO — Reporte de Plazos Máximos</span>
        <span style={footerText}>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
