import { FileText } from "lucide-react";
import { C, headerGradient, cardStyle, footerStyle, footerText } from "./adminStyles";

export default function AdminTemplates() {
  return (
    <div style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy, minHeight: "100vh" }}>
      <div style={{ ...headerGradient, padding: "32px 36px 28px" }}>
        <span style={{ background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>ADMINISTRACIÓN</span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginTop: 8 }}>Plantillas</h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>Gestión de plantillas corporativas del PMO</p>
      </div>
      <div style={{ padding: "28px 36px" }}>
        <div style={{ ...cardStyle, padding: "64px 0", textAlign: "center" }}>
          <FileText className="h-12 w-12" style={{ margin: "0 auto 12px", color: C.g300 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: C.g400 }}>Módulo de Plantillas</p>
          <p style={{ fontSize: 12, color: C.g300, marginTop: 4 }}>Próximamente disponible</p>
        </div>
      </div>
      <div style={footerStyle}><span style={footerText}>Prodigio PMO — Plantillas</span><span style={footerText}>{new Date().getFullYear()}</span></div>
    </div>
  );
}
