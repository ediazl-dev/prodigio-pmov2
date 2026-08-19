import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle, Clock, Database } from "lucide-react";
import { C, headerGradient, cardStyle, thStyle, tdStyle, badgeStyle } from "./adminStyles";

function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function statusBadge(status: string) {
  if (status === "applied") {
    return (
      <span style={badgeStyle(`${C.green}18`, C.green)}>
        <CheckCircle2 className="h-3 w-3" style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
        Exitosa
      </span>
    );
  }
  return (
    <span style={badgeStyle(`${C.red}18`, C.red)}>
      <XCircle className="h-3 w-3" style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
      Error
    </span>
  );
}

function originLabel(triggeredBy: string | null | undefined): string {
  if (triggeredBy === "cron") return "Automática (cron)";
  if (triggeredBy === "manual") return "Manual";
  return triggeredBy || "-";
}

export default function AdminFinancialSync() {
  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.financial.syncLogs.useQuery({ limit: 100 });
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const syncNow = trpc.financial.syncNow.useMutation({
    onSuccess: (outcome) => {
      setFeedback({
        kind: "success",
        text: `Sincronización aplicada: ${outcome.inputDeals} Deals leídos, ${outcome.insert} insertados, ${outcome.update} actualizados.`,
      });
      utils.financial.syncLogs.invalidate();
    },
    onError: (error) => {
      setFeedback({ kind: "error", text: `La sincronización falló: ${error.message}` });
      utils.financial.syncLogs.invalidate();
    },
  });

  const total = logs?.length ?? 0;
  const successCount = logs?.filter((l: any) => l.status === "applied").length ?? 0;
  const errorCount = logs?.filter((l: any) => l.status === "error").length ?? 0;
  const lastSync = logs && logs.length > 0 ? logs[0] : null;

  return (
    <div style={{ background: C.g100, fontFamily: "'Poppins', system-ui, sans-serif", color: C.navy, minHeight: "100vh" }}>
      {/* ── HEADER ── */}
      <div style={{ ...headerGradient, padding: "32px 36px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span style={{ background: "rgba(233,30,140,.15)", border: "1px solid rgba(233,30,140,.35)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>ADMINISTRACIÓN</span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <RefreshCw className="h-6 w-6" style={{ color: C.accent }} /> Sincronización Financiera
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>
              Historial de ejecuciones de la sincronización de datos financieros desde la planilla corporativa (cron diario 03:00 UTC)
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 10, background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.15)" }}>{total} registros</span>
            <button
              type="button"
              onClick={() => { setFeedback(null); syncNow.mutate(); }}
              disabled={syncNow.isPending}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 12, fontWeight: 700, padding: "9px 18px", borderRadius: 10,
                background: syncNow.isPending ? "rgba(233,30,140,.4)" : C.accent,
                color: "#fff", border: "none", cursor: syncNow.isPending ? "not-allowed" : "pointer",
                transition: "transform .15s ease-out, opacity .15s",
                opacity: syncNow.isPending ? 0.7 : 1,
              }}
            >
              <RefreshCw className={`h-4 w-4 ${syncNow.isPending ? "animate-spin" : ""}`} />
              {syncNow.isPending ? "Sincronizando..." : "Sincronizar ahora"}
            </button>
          </div>
        </div>
        {/* KPI cards */}
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 16px", minWidth: 140 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,.5)" }}>Última sincronización</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              <Clock className="h-3.5 w-3.5" style={{ color: C.accent }} />
              {lastSync ? formatDateTime(lastSync.createdAt) : "Sin registros"}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 16px", minWidth: 110 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,.5)" }}>Exitosas</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#4ADE80", marginTop: 2 }}>{successCount}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 16px", minWidth: 110 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(255,255,255,.5)" }}>Con error</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: errorCount > 0 ? "#F87171" : "rgba(255,255,255,.4)", marginTop: 2 }}>{errorCount}</div>
          </div>
        </div>
        {feedback && (
          <div
            role="status"
            style={{
              marginTop: 16, padding: "10px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
              background: feedback.kind === "success" ? "rgba(74,222,128,.12)" : "rgba(248,113,113,.12)",
              border: `1px solid ${feedback.kind === "success" ? "rgba(74,222,128,.4)" : "rgba(248,113,113,.4)"}`,
              color: feedback.kind === "success" ? "#4ADE80" : "#F87171",
            }}
          >
            {feedback.kind === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {feedback.text}
          </div>
        )}
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.g200}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Database className="h-4 w-4" style={{ color: C.accent }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Historial de ejecuciones</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 170 }}>Fecha y Hora</th>
                  <th style={{ ...thStyle, width: 110 }}>Estado</th>
                  <th style={{ ...thStyle, width: 100 }}>Deals leídos</th>
                  <th style={{ ...thStyle, width: 90 }}>Insertados</th>
                  <th style={{ ...thStyle, width: 100 }}>Actualizados</th>
                  <th style={{ ...thStyle, width: 140 }}>Origen</th>
                  <th style={thStyle}>Mensaje de error</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "32px 0", color: C.g400 }}>Cargando historial de sincronizaciones...</td></tr>
                ) : !logs || logs.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "32px 0", color: C.g400 }}>Aún no hay ejecuciones registradas. La primera corrida del cron será a las 03:00 UTC.</td></tr>
                ) : logs.map((log: any) => (
                  <tr key={log.id} style={{ transition: "background .15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = C.g100)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: C.g400 }}>{formatDateTime(log.createdAt)}</td>
                    <td style={tdStyle}>{statusBadge(log.status)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{log.inputDeals}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: C.green }}>{log.insertCount}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: C.blue2 }}>{log.updateCount}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 11, color: C.g400 }}>{originLabel(log.triggeredBy)}</span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 320 }}>
                      {log.errorMessage ? (
                        <span style={{ fontSize: 11, color: C.red, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={log.errorMessage}>{log.errorMessage}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: C.g300 }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
