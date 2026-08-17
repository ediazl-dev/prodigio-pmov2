import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Clock, ExternalLink, KeyRound, Loader2, RefreshCw, ShieldAlert, ShieldCheck, User, Zap } from "lucide-react";
import { C, headerGradient, cardStyle, headerKpiCard, headerKpiLabel, headerKpiValue, footerStyle, footerText } from "./adminStyles";

export default function AdminJiraToken() {
  const [newToken, setNewToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);

  const tokenHealth = trpc.jira.tokenHealth.useQuery(undefined, { refetchInterval: 5 * 60 * 1000, retry: false });
  const updateToken = trpc.jira.updateToken.useMutation({
    onSuccess: (data) => { toast.success(data.message); setNewToken(""); setShowTokenInput(false); tokenHealth.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const status = tokenHealth.data?.status ?? "loading";
  const isHealthy = status === "active";
  const isExpired = status === "expired";
  const isForbidden = status === "forbidden";

  const statusMap: Record<string, { color: string; label: string; Icon: any }> = {
    active: { color: C.green, label: "Activo", Icon: ShieldCheck },
    expired: { color: C.red, label: "Expirado", Icon: ShieldAlert },
    forbidden: { color: C.gold, label: "Sin Permisos", Icon: AlertCircle },
    error: { color: C.g400, label: "Error", Icon: AlertCircle },
    loading: { color: C.g300, label: "Verificando...", Icon: Loader2 },
  };
  const cfg = statusMap[status] ?? statusMap.error;

  return (
    <div style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy, minHeight: "100vh" }}>
      {/* ── HEADER ── */}
      <div style={{ ...headerGradient, padding: "32px 36px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span style={{ background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>ADMINISTRACIÓN</span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <KeyRound className="h-6 w-6" style={{ color: C.accent }} /> Token JIRA
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>Monitoreo y gestión del API Token de Atlassian JIRA</p>
          </div>
          <Button onClick={() => tokenHealth.refetch()} disabled={tokenHealth.isFetching} style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, fontWeight: 700, fontSize: 12, padding: "8px 18px", display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw className={`h-4 w-4 ${tokenHealth.isFetching ? "animate-spin" : ""}`} /> Verificar
          </Button>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <div style={headerKpiCard}>
            <div style={headerKpiLabel}>Estado</div>
            <div style={{ ...headerKpiValue, color: cfg.color, fontSize: 16 }}>{cfg.label}</div>
          </div>
          {tokenHealth.data?.latencyMs != null && (
            <div style={headerKpiCard}>
              <div style={headerKpiLabel}>Latencia</div>
              <div style={headerKpiValue}>{tokenHealth.data.latencyMs}ms</div>
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Alert banner */}
        {(isExpired || isForbidden) && (
          <div style={{ ...cardStyle, padding: 16, display: "flex", alignItems: "flex-start", gap: 12, background: isExpired ? `${C.red}08` : `${C.gold}08`, border: `1px solid ${isExpired ? C.red : C.gold}30` }}>
            <ShieldAlert className="h-5 w-5" style={{ color: isExpired ? C.red : C.gold, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: isExpired ? C.red : C.gold }}>{isExpired ? "Token JIRA Expirado" : "Token sin Permisos Suficientes"}</h3>
              <p style={{ fontSize: 12, color: C.g400, marginTop: 4 }}>{tokenHealth.data?.message}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Button size="sm" onClick={() => setShowTokenInput(true)} style={{ background: isExpired ? C.red : C.gold, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                  <KeyRound className="h-3.5 w-3.5 mr-1" /> Actualizar Token
                </Button>
                <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: C.accent, padding: "4px 12px", border: `1px solid ${C.accent}40`, borderRadius: 6, textDecoration: "none" }}>
                  <ExternalLink className="h-3.5 w-3.5" /> Generar en Atlassian
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Status Card */}
        <div style={cardStyle}>
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.g200}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${cfg.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <cfg.Icon className={`h-5 w-5 ${status === "loading" ? "animate-spin" : ""}`} style={{ color: cfg.color }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Estado del Token</h3>
              <p style={{ fontSize: 11, color: C.g400 }}>Conexión con la API de Atlassian JIRA</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: `${cfg.color}18`, color: cfg.color }}>{cfg.label}</span>
          </div>
          <div style={{ padding: "20px 24px" }}>
            {tokenHealth.isLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 0", color: C.g400 }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ marginRight: 8 }} /> Verificando estado del token...
              </div>
            ) : tokenHealth.data ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { icon: <User className="h-4 w-4" />, label: "Usuario Autenticado", value: tokenHealth.data.user ? <>{tokenHealth.data.user.displayName}<br /><span style={{ fontSize: 10, color: C.g400 }}>{tokenHealth.data.user.emailAddress}</span></> : "No autenticado" },
                  { icon: <Zap className="h-4 w-4" />, label: "Latencia", value: `${tokenHealth.data.latencyMs}ms` },
                  { icon: <Clock className="h-4 w-4" />, label: "Última Verificación", value: new Date(tokenHealth.data.checkedAt).toLocaleString("es-CL") },
                  { icon: isHealthy ? <CheckCircle2 className="h-4 w-4" style={{ color: C.green }} /> : <AlertCircle className="h-4 w-4" style={{ color: C.red }} />, label: "Mensaje", value: tokenHealth.data.message },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, background: C.g100 }}>
                    <span style={{ color: C.g400, marginTop: 2 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{item.label}</p>
                      <p style={{ fontSize: 12, color: C.g400, marginTop: 2 }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Update Token Card */}
        <div style={cardStyle}>
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.g200}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, display: "flex", alignItems: "center", gap: 8 }}><KeyRound className="h-5 w-5" style={{ color: C.accent }} /> Actualizar API Token</h3>
            <p style={{ fontSize: 12, color: C.g400, marginTop: 4 }}>Ingresa un nuevo API Token de Atlassian JIRA. El token se validará antes de ser aceptado.</p>
          </div>
          <div style={{ padding: "20px 24px" }}>
            {showTokenInput || !isHealthy ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Nuevo API Token</label>
                  <Input type="password" placeholder="ATATT3xFfGF0..." value={newToken} onChange={(e) => setNewToken(e.target.value)} className="mt-1" />
                  <p style={{ fontSize: 11, color: C.g400, marginTop: 4 }}>
                    Genera un token en{" "}
                    <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: "underline" }}>Atlassian Account Settings</a>
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={() => updateToken.mutate({ token: newToken })} disabled={newToken.length < 10 || updateToken.isPending} style={{ background: C.accent, color: "#fff", border: "none" }}>
                    {updateToken.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validando...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Validar y Guardar</>}
                  </Button>
                  {isHealthy && <Button variant="outline" onClick={() => { setShowTokenInput(false); setNewToken(""); }}>Cancelar</Button>}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 12, color: C.g400 }}>El token actual está funcionando correctamente.</p>
                <button onClick={() => setShowTokenInput(true)} style={{ fontSize: 12, fontWeight: 600, color: C.accent, background: "none", border: `1px solid ${C.accent}40`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>Cambiar Token</button>
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div style={{ ...cardStyle, padding: 16, display: "flex", alignItems: "flex-start", gap: 12, background: `${C.accent}08`, border: `1px solid ${C.accent}30` }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${C.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertCircle className="h-4 w-4" style={{ color: C.accent }} />
          </div>
          <div style={{ fontSize: 12, color: C.navy }}>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>Sobre los API Tokens de JIRA</p>
            <ul style={{ listStyle: "disc", paddingLeft: 16, color: C.g400, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Los API Tokens de Atlassian no tienen fecha de expiración fija, pero pueden ser revocados manualmente.</li>
              <li>Si cambias la contraseña de tu cuenta Atlassian, los tokens existentes seguirán funcionando.</li>
              <li>El sistema verifica automáticamente el estado del token cada 5 minutos.</li>
              <li>Si el token falla, se mostrará una alerta en esta página y en el badge "JIRA Conectado" de los proyectos.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={footerStyle}>
        <span style={footerText}>Prodigio PMO — Token JIRA</span>
        <span style={footerText}>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
