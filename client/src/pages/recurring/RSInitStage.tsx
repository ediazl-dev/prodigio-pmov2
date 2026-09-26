import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, ArrowRight, CheckCircle2, FileText, Loader2, Lock,
  Plus, Sparkles, Trash2, Upload, X, DollarSign, Building2,
  Phone, Mail, Calendar, BarChart3, AlertTriangle, Lightbulb,
  ClipboardList, RefreshCw,
} from "lucide-react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import {
  C, headerGradient, pageBackground, cardStyle, sectionTitle,
  badgeStyle, headerKpiCard, headerKpiLabel, headerKpiValue,
  thStyle, tdStyle,
} from "@/pages/admin/adminStyles";
import { RECURRING_SERVICE_TYPE_LABELS } from "@shared/recurringServiceTypes";

/* ─── Step indicator ─────────────────────────────────────────────── */
function StepIndicator({ currentStep, step1Done }: { currentStep: 1 | 2; step1Done: boolean }) {
  const steps = [
    { num: 1, label: "Datos Generales y Plan de Cobro" },
    { num: 2, label: "Documentación e Integración CRM" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
      {steps.map((s, i) => {
        const done = s.num === 1 ? step1Done : false;
        const active = s.num === currentStep;
        return (
          <div key={s.num} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, flex: 1,
              padding: "14px 18px", borderRadius: 12,
              background: active ? "rgba(59,142,232,.08)" : done ? "rgba(26,122,74,.06)" : "#fff",
              border: `1.5px solid ${active ? C.accent : done ? C.green : C.g200}`,
              transition: "all .2s",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                background: done ? C.green : active ? C.accent : C.g200,
                color: done || active ? "#fff" : C.g400,
              }}>
                {done ? <CheckCircle2 size={14} /> : s.num}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: active ? C.accent : done ? C.green : C.g400 }}>
                  Paso {s.num}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginTop: 1 }}>{s.label}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 32, height: 2, background: step1Done ? C.green : C.g200, margin: "0 4px" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

export default function RSInitStage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.recurringServices.getById.useQuery({ id });
  const { data: stagesData } = trpc.recurringServices.getStages.useQuery({ serviceId: id });

  const stage = stagesData?.find((s: any) => s.stageId === "inicializacion");
  const isCompleted = stage?.status === "completed";
  const isActive = stage?.status === "in_progress";

  const step1Done = !!data?.service?.initStep1Confirmed;
  const [viewStep, setViewStep] = useState<1 | 2>(1);

  // Auto-advance to step 2 if step 1 is confirmed
  useEffect(() => {
    if (step1Done && viewStep === 1) setViewStep(2);
  }, [step1Done]);

  // ─── Billing plan state ───
  const [showBillingDialog, setShowBillingDialog] = useState(false);
  const [billingMonths, setBillingMonths] = useState<{ monthNumber: number; amount: number; dueDate: string }[]>([]);

  const saveBillingMutation = trpc.recurringServices.saveBillingPlan.useMutation({
    onSuccess: () => { toast.success("Plan de cobro guardado"); utils.recurringServices.getById.invalidate({ id }); setShowBillingDialog(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmStep1Mutation = trpc.recurringServices.confirmInitStep1.useMutation({
    onSuccess: () => { toast.success("Paso 1 confirmado"); utils.recurringServices.getById.invalidate({ id }); setViewStep(2); },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Document upload ───
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<string>("propuesta_tecnica");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const uploadMutation = trpc.recurringServices.uploadDocument.useMutation({
    onSuccess: () => { toast.success("Documento subido"); utils.recurringServices.getById.invalidate({ id }); setShowUploadDialog(false); setUploadFile(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = trpc.recurringServices.deleteDocument.useMutation({
    onSuccess: () => { toast.success("Documento eliminado"); utils.recurringServices.getById.invalidate({ id }); },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Pipedrive sync ───
  const [showPipedriveDialog, setShowPipedriveDialog] = useState(false);
  const [pdDealId, setPdDealId] = useState("");

  const syncPipedriveMutation = trpc.recurringServices.syncPipedrive.useMutation({
    onSuccess: (result) => {
      toast.success(`Datos sincronizados: ${result.contactName || "Deal"} (${result.activitiesCount + result.emailsCount} interacciones)`);
      utils.recurringServices.getById.invalidate({ id });
      setShowPipedriveDialog(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── AI Summary ───
  const aiSummaryMutation = trpc.recurringServices.generatePipedriveAiSummary.useMutation({
    onSuccess: () => { toast.success("Análisis agéntico generado"); utils.recurringServices.getById.invalidate({ id }); },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Close stage ───
  const closeMutation = trpc.recurringServices.closeInitializationStage.useMutation({
    onSuccess: () => { toast.success("Etapa de Inicialización cerrada"); utils.recurringServices.getById.invalidate({ id }); utils.recurringServices.getStages.invalidate({ serviceId: id }); },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Billing helpers ───
  const initBillingPlan = useCallback(() => {
    if (!data?.service) return;
    const svc = data.service;
    const existing = data.billingMonths;
    if (existing && existing.length > 0) {
      setBillingMonths(existing.map((m: any) => ({
        monthNumber: m.monthNumber,
        amount: parseFloat(m.amount) || 0,
        dueDate: m.dueDate || "",
      })));
    } else {
      setBillingMonths(Array.from({ length: svc.durationMonths }, (_, i) => ({
        monthNumber: i + 1,
        amount: svc.billingType === "cuota_fija" && svc.fixedMonthlyAmount ? parseFloat(svc.fixedMonthlyAmount) : 0,
        dueDate: "",
      })));
    }
    setShowBillingDialog(true);
  }, [data]);

  const handleUpload = async () => {
    if (!uploadFile) return toast.error("Selecciona un archivo");
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        serviceId: id,
        docType: uploadDocType as any,
        fileName: uploadFile.name,
        fileBase64: base64,
        mimeType: uploadFile.type || "application/pdf",
      });
    };
    reader.readAsDataURL(uploadFile);
  };

  const handleSyncPipedrive = () => {
    const dealToSync = pdDealId || svc?.dealId || "";
    if (!dealToSync) return toast.error("Ingresa un Deal ID");
    syncPipedriveMutation.mutate({ serviceId: id, dealId: dealToSync });
  };

  // ─── Loading ───
  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={32} className="animate-spin" color={C.accent} /></div>;
  }
  if (!data) return null;
  const svc = data.service;

  const saveBillingPlan = () => {
    if (!svc.currency || !["UF", "USD", "CLP"].includes(svc.currency)) {
      toast.error("La ficha no tiene una moneda contractual válida. Corrígela antes de guardar el plan de cobro.");
      return;
    }
    const currency = svc.currency as "UF" | "USD" | "CLP";
    saveBillingMutation.mutate({ serviceId: id, months: billingMonths.map(month => ({ ...month, currency })) });
  };

  const billingTotal = data.billingMonths?.reduce((s: number, m: any) => s + (parseFloat(m.amount) || 0), 0) ?? 0;

  const docTypes: Record<string, string> = {
    propuesta_tecnica: "Propuesta Técnica",
    pl: "P&L",
    sow: "Statement of Work",
    contrato: "Contrato",
    otro: "Otro",
  };

  return (
    <div style={pageBackground}>
      <AppBreadcrumb segments={[
        { label: "Servicios Recurrentes", href: "/recurring-services" },
        { label: svc.serviceName, href: `/recurring-services/${id}` },
        { label: "Inicialización" },
      ]} />

      {/* ═══ Header ═══ */}
      <div style={{ ...headerGradient, borderRadius: 16, padding: "24px 32px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(`/recurring-services/${id}`)} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
            <ArrowLeft size={16} color="#fff" />
          </button>
          <ClipboardList size={20} color={C.accent} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-.3px" }}>Inicialización del Servicio</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{svc.serviceName} &middot; {svc.clientName}</p>
          </div>
          {isCompleted && (
            <span style={badgeStyle("#DCFCE7", "#166534")}>
              <CheckCircle2 size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />COMPLETADA
            </span>
          )}
        </div>
        {/* Header KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
          <div style={headerKpiCard}>
            <div style={headerKpiLabel}>Cliente</div>
            <div style={{ ...headerKpiValue, fontSize: 14 }}>{svc.clientName}</div>
          </div>
          <div style={headerKpiCard}>
            <div style={headerKpiLabel}>Duración</div>
            <div style={headerKpiValue}>{svc.durationMonths} <span style={{ fontSize: 11, fontWeight: 400 }}>meses</span></div>
          </div>
          <div style={headerKpiCard}>
            <div style={headerKpiLabel}>Tipo Cobro</div>
            <div style={{ ...headerKpiValue, fontSize: 14 }}>{svc.billingType === "cuota_fija" ? "Cuota Fija" : "Cuotas Variables"}</div>
          </div>
          <div style={headerKpiCard}>
            <div style={headerKpiLabel}>Moneda</div>
            <div style={headerKpiValue}>{svc.currency || "USD"}</div>
          </div>
        </div>
      </div>

      {/* ═══ Step Indicator ═══ */}
      <StepIndicator currentStep={viewStep} step1Done={step1Done} />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PASO 1: Datos Generales + Estructura de Cobro                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {viewStep === 1 && (
        <>
          {/* Service info card */}
          <div style={{ ...cardStyle, padding: "20px 24px", marginBottom: 16 }}>
            <h3 style={{ ...sectionTitle, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={16} color={C.accent} /> Información General del Servicio
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em", marginBottom: 4 }}>Cliente</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{svc.clientName}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em", marginBottom: 4 }}>Deal ID</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{svc.dealId || <span style={{ color: C.g300 }}>Sin vincular</span>}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em", marginBottom: 4 }}>Servicio Contratado</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{svc.serviceName}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em", marginBottom: 4 }}>Tipo de Servicio</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{RECURRING_SERVICE_TYPE_LABELS[svc.serviceType as keyof typeof RECURRING_SERVICE_TYPE_LABELS] ?? svc.serviceType}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em", marginBottom: 4 }}>Duración</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{svc.durationMonths} meses</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em", marginBottom: 4 }}>Fecha Inicio Estimada</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{svc.estimatedStartDate || <span style={{ color: C.g300 }}>No definida</span>}</div>
              </div>
            </div>
          </div>

          {/* Billing plan card */}
          <div style={{ ...cardStyle, padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ ...sectionTitle, display: "flex", alignItems: "center", gap: 8 }}>
                <DollarSign size={16} color={C.accent} /> Estructura de Cobro y Plan de Pagos
              </h3>
              {isActive && !step1Done && (
                <Button size="sm" variant="outline" onClick={initBillingPlan} style={{ fontSize: 12 }}>
                  <Plus size={14} className="mr-1" /> {data.billingMonths.length > 0 ? "Editar Plan" : "Configurar Plan"}
                </Button>
              )}
            </div>

            {data.billingMonths.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <DollarSign size={32} color={C.g300} style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 13, color: C.g400, marginBottom: 4 }}>No hay plan de cobro configurado</p>
                <p style={{ fontSize: 11, color: C.g300 }}>
                  {svc.billingType === "cuota_fija"
                    ? `Configura ${svc.durationMonths} cuotas de ${svc.currency} ${svc.fixedMonthlyAmount ? parseFloat(svc.fixedMonthlyAmount).toLocaleString() : "0"}`
                    : `Ingresa los montos individuales para ${svc.durationMonths} meses`}
                </p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                  <div style={{ background: C.g100, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em" }}>Total Contrato</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, letterSpacing: "-.3px" }}>{svc.currency} {billingTotal.toLocaleString()}</div>
                  </div>
                  <div style={{ background: C.g100, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em" }}>Cuotas</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{data.billingMonths.length}</div>
                  </div>
                  <div style={{ background: C.g100, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em" }}>Promedio Mensual</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, letterSpacing: "-.3px" }}>{svc.currency} {data.billingMonths.length > 0 ? Math.round(billingTotal / data.billingMonths.length).toLocaleString() : 0}</div>
                  </div>
                </div>
                {/* Table */}
                <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Mes</th>
                        <th style={{ ...thStyle, textAlign: "right" as const }}>Monto</th>
                        <th style={thStyle}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.billingMonths.map((m: any) => (
                        <tr key={m.id}>
                          <td style={tdStyle}>Mes {m.monthNumber}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{m.currency || svc.currency} {parseFloat(m.amount).toLocaleString()}</td>
                          <td style={tdStyle}>
                            <span style={badgeStyle(
                              m.status === "facturado" ? "#DBEAFE" : "#FEF3C7",
                              m.status === "facturado" ? "#1E40AF" : "#92400E",
                            )}>{m.status === "facturado" ? "FACTURADO" : "PENDIENTE"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Step 1 actions */}
          {isActive && !step1Done && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <Button
                onClick={() => confirmStep1Mutation.mutate({ serviceId: id })}
                disabled={confirmStep1Mutation.isPending || data.billingMonths.length === 0}
                style={{ background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 24px" }}
              >
                {confirmStep1Mutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <ArrowRight size={16} className="mr-2" />}
                Confirmar Paso 1 y Continuar
              </Button>
            </div>
          )}

          {step1Done && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button variant="outline" onClick={() => setViewStep(2)} style={{ fontWeight: 600 }}>
                Ir al Paso 2 <ArrowRight size={14} className="ml-2" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PASO 2: Documentación + Integración Pipedrive                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {viewStep === 2 && (
        <>
          {!step1Done && (
            <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center", marginBottom: 16 }}>
              <Lock size={32} color={C.g300} style={{ margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>Paso 2 Bloqueado</p>
              <p style={{ fontSize: 12, color: C.g400, marginTop: 4 }}>Confirma el Paso 1 (datos generales y plan de cobro) para continuar</p>
              <Button variant="outline" onClick={() => setViewStep(1)} style={{ marginTop: 16 }}>
                <ArrowLeft size={14} className="mr-2" /> Volver al Paso 1
              </Button>
            </div>
          )}

          {step1Done && (
            <>
              {/* Documents section */}
              <div style={{ ...cardStyle, padding: "20px 24px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ ...sectionTitle, display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText size={16} color={C.accent} /> Documentación del Servicio
                  </h3>
                  {isActive && (
                    <Button size="sm" variant="outline" onClick={() => setShowUploadDialog(true)} style={{ fontSize: 12 }}>
                      <Upload size={14} className="mr-1" /> Subir Documento
                    </Button>
                  )}
                </div>

                {/* Required docs checklist */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                  {(["propuesta_tecnica", "pl", "sow", "contrato"] as const).map((dt) => {
                    const hasDoc = data.documents.some((d: any) => d.docType === dt);
                    return (
                      <div key={dt} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
                        borderRadius: 8, background: hasDoc ? "rgba(26,122,74,.06)" : C.g100,
                        border: `1px solid ${hasDoc ? "rgba(26,122,74,.2)" : C.g200}`,
                      }}>
                        {hasDoc ? <CheckCircle2 size={14} color={C.green} /> : <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.g300}` }} />}
                        <span style={{ fontSize: 11, fontWeight: 600, color: hasDoc ? C.green : C.g400 }}>{docTypes[dt]}</span>
                      </div>
                    );
                  })}
                </div>

                {data.documents.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0" }}>
                    <FileText size={28} color={C.g300} style={{ margin: "0 auto 8px" }} />
                    <p style={{ fontSize: 12, color: C.g400 }}>Sube la propuesta técnica, P&L, SoW y/o contrato del servicio</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {data.documents.map((doc: any) => (
                      <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: C.g100 }}>
                        <FileText size={16} color={C.accent} />
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 12, fontWeight: 500, color: C.accent, textDecoration: "none" }}>
                          {doc.fileName}
                        </a>
                        <span style={badgeStyle("#EEF2FF", "#4338CA")}>{docTypes[doc.docType as keyof typeof docTypes] || doc.docType}</span>
                        <span style={{ fontSize: 10, color: C.g400 }}>{new Date(doc.uploadedAt).toLocaleDateString("es-CL")}</span>
                        {isActive && (
                          <button onClick={() => deleteMutation.mutate({ serviceId: id, documentId: doc.id })} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                            <Trash2 size={14} color={C.red} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pipedrive integration section */}
              <div style={{ ...cardStyle, padding: "20px 24px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ ...sectionTitle, display: "flex", alignItems: "center", gap: 8 }}>
                    <RefreshCw size={16} color={C.accent} /> Integración CRM (Pipedrive)
                  </h3>
                  {isActive && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button size="sm" variant="outline" onClick={() => {
                        setPdDealId(svc.dealId || "");
                        setShowPipedriveDialog(true);
                      }} style={{ fontSize: 12 }}>
                        <RefreshCw size={14} className="mr-1" /> {svc.dealId ? "Re-sincronizar" : "Sincronizar Pipedrive"}
                      </Button>
                      {svc.dealId && (
                        <Button size="sm" variant="outline" onClick={() => aiSummaryMutation.mutate({ serviceId: id })} disabled={aiSummaryMutation.isPending} style={{ fontSize: 12 }}>
                          {aiSummaryMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Sparkles size={14} className="mr-1" />}
                          Análisis Agéntico
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {!svc.dealId ? (
                  <div style={{ textAlign: "center", padding: "30px 0" }}>
                    <RefreshCw size={28} color={C.g300} style={{ margin: "0 auto 8px" }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Sin datos de CRM</p>
                    <p style={{ fontSize: 11, color: C.g400, marginTop: 4 }}>Ingresa el Deal ID de Pipedrive para sincronizar automáticamente toda la información del negocio</p>
                  </div>
                ) : (
                  <>
                    {/* Sync timestamp */}
                    {svc.pipedriveSyncedAt && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, padding: "8px 12px", background: "rgba(59,142,232,.04)", borderRadius: 8, border: `1px solid rgba(59,142,232,.1)` }}>
                        <RefreshCw size={12} color={C.accent} />
                        <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>Última sincronización: {new Date(svc.pipedriveSyncedAt).toLocaleString("es-CL")}</span>
                        <span style={{ fontSize: 10, color: C.g400, marginLeft: 8 }}>Deal #{svc.dealId}</span>
                        <span style={badgeStyle(
                          svc.pipedriveDealStatus === "won" ? "#DCFCE7" : svc.pipedriveDealStatus === "lost" ? "#FEE2E2" : "#DBEAFE",
                          svc.pipedriveDealStatus === "won" ? "#166534" : svc.pipedriveDealStatus === "lost" ? "#991B1B" : "#1E40AF"
                        )}>{(svc.pipedriveDealStatus || "open").toUpperCase()}</span>
                      </div>
                    )}

                    {/* Deal summary - 3 columns */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                      {/* Contacto */}
                      <div style={{ background: C.g100, borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em", marginBottom: 8 }}>Contacto del Cliente</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          <Building2 size={12} color={C.accent} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{svc.pipedrivePersonName || "N/A"}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <Mail size={11} color={C.g400} />
                          <span style={{ fontSize: 11, color: C.g400 }}>{svc.pipedrivePersonEmail || "N/A"}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Phone size={11} color={C.g400} />
                          <span style={{ fontSize: 11, color: C.g400 }}>{svc.pipedrivePersonPhone || "N/A"}</span>
                        </div>
                      </div>
                      {/* Organización */}
                      <div style={{ background: C.g100, borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em", marginBottom: 8 }}>Organización</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          <Building2 size={12} color={C.accent} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{svc.pipedriveOrgName || "N/A"}</span>
                        </div>
                        {svc.pipedriveOrgAddress && (
                          <div style={{ fontSize: 11, color: C.g400, lineHeight: 1.5 }}>{svc.pipedriveOrgAddress}</div>
                        )}
                      </div>
                      {/* Datos del Deal */}
                      <div style={{ background: C.g100, borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em", marginBottom: 8 }}>Datos del Deal</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          <DollarSign size={12} color={C.accent} />
                          <span style={{ fontSize: 15, fontWeight: 800, color: C.navy, letterSpacing: "-.3px" }}>
                            {svc.pipedriveDealAmount ? `${svc.pipedriveDealCurrency || svc.currency} ${parseFloat(svc.pipedriveDealAmount).toLocaleString()}` : "N/A"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <Calendar size={11} color={C.g400} />
                          <span style={{ fontSize: 11, color: C.g400 }}>Inicio oportunidad: {svc.pipedriveDealCreatedAt || "N/A"}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Calendar size={11} color={C.g400} />
                          <span style={{ fontSize: 11, color: C.g400 }}>Cierre: {svc.pipedriveDealClosedAt || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Interaction metrics strip */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                      {[
                        { label: "Total Interacciones", value: svc.pipedriveInteractionCount ?? 0, icon: BarChart3, color: C.accent },
                        { label: "Actividades", value: (svc.pipedriveInteractionCount ?? 0) - (svc.pipedriveEmailsCount ?? 0), icon: CheckCircle2, color: C.green },
                        { label: "Emails", value: svc.pipedriveEmailsCount ?? 0, icon: Mail, color: "#7C3AED" },
                        { label: "Notas CRM", value: svc.pipedriveNotesCount ?? 0, icon: FileText, color: "#EA580C" },
                      ].map((m, i) => (
                        <div key={i} style={{ background: C.g100, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${m.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <m.icon size={16} color={m.color} />
                          </div>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, letterSpacing: "-.3px" }}>{m.value}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".06em" }}>{m.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* AI Analysis */}
                    {svc.pipedriveAiSummary ? (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ background: "rgba(59,142,232,.04)", borderRadius: 10, padding: "16px 18px", border: `1px solid rgba(59,142,232,.15)` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <Sparkles size={14} color={C.accent} />
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.accent, letterSpacing: ".08em" }}>Resumen Ejecutivo del Deal</span>
                          </div>
                          <p style={{ fontSize: 12, lineHeight: 1.7, color: C.navy }}>{svc.pipedriveAiSummary}</p>
                        </div>
                        {svc.pipedriveClientConcerns && (
                          <div style={{ background: "rgba(184,50,50,.04)", borderRadius: 10, padding: "16px 18px", border: `1px solid rgba(184,50,50,.15)` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <AlertTriangle size={14} color={C.red} />
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.red, letterSpacing: ".08em" }}>Preocupaciones del Cliente</span>
                            </div>
                            <p style={{ fontSize: 12, lineHeight: 1.7, color: C.navy }}>{svc.pipedriveClientConcerns}</p>
                          </div>
                        )}
                        {svc.pipedriveAiRecommendations && (
                          <div style={{ background: "rgba(26,122,74,.04)", borderRadius: 10, padding: "16px 18px", border: `1px solid rgba(26,122,74,.15)` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <Lightbulb size={14} color={C.green} />
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.green, letterSpacing: ".08em" }}>Recomendaciones</span>
                            </div>
                            <p style={{ fontSize: 12, lineHeight: 1.7, color: C.navy }}>{svc.pipedriveAiRecommendations}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "20px 0", background: C.g100, borderRadius: 10 }}>
                        <Sparkles size={24} color={C.g300} style={{ margin: "0 auto 8px" }} />
                        <p style={{ fontSize: 12, color: C.g400 }}>Genera el análisis agéntico para obtener insights del deal</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Step 2 actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                <Button variant="outline" onClick={() => setViewStep(1)} style={{ fontWeight: 600 }}>
                  <ArrowLeft size={14} className="mr-2" /> Volver al Paso 1
                </Button>
                {isActive && (
                  <Button
                    onClick={() => closeMutation.mutate({ serviceId: id })}
                    disabled={closeMutation.isPending}
                    style={{ background: C.green, color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 24px" }}
                  >
                    {closeMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2" />}
                    Confirmar y Cerrar Inicialización
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ Upload Document Dialog ═══ */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Subir Documento del Servicio</DialogTitle></DialogHeader>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <Label>Tipo de Documento</Label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger style={{ marginTop: 4 }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="propuesta_tecnica">Propuesta Técnica</SelectItem>
                  <SelectItem value="pl">P&L (Estructura de Costos)</SelectItem>
                  <SelectItem value="sow">Statement of Work (SoW)</SelectItem>
                  <SelectItem value="contrato">Contrato Firmado</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Archivo</Label>
              <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} style={{ marginTop: 4 }} />
            </div>
            <Button onClick={handleUpload} disabled={uploadMutation.isPending} style={{ background: C.accent, color: "#fff" }}>
              {uploadMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <Upload size={16} className="mr-1" />}
              Subir Documento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Billing Plan Dialog ═══ */}
      <Dialog open={showBillingDialog} onOpenChange={setShowBillingDialog}>
        <DialogContent style={{ maxWidth: 640, maxHeight: "80vh", overflow: "auto" }}>
          <DialogHeader><DialogTitle>Plan de Cobro - {svc.durationMonths} meses ({svc.billingType === "cuota_fija" ? "Cuota Fija" : "Cuotas Variables"})</DialogTitle></DialogHeader>
          <p style={{ fontSize: 12, color: C.g400, marginBottom: 12 }}>
            {svc.billingType === "cuota_fija"
              ? "Todas las cuotas tienen el mismo monto. Puedes ajustar fechas de vencimiento."
              : "Ingresa el monto individual para cada mes."}
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {billingMonths.map((m, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Mes {m.monthNumber}</span>
                <Input
                  type="number"
                  placeholder="Monto"
                  value={m.amount}
                  onChange={(e) => {
                    const updated = [...billingMonths];
                    updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 };
                    setBillingMonths(updated);
                  }}
                />
                <Input
                  type="date"
                  placeholder="Fecha vencimiento"
                  value={m.dueDate}
                  onChange={(e) => {
                    const updated = [...billingMonths];
                    updated[idx] = { ...updated[idx], dueDate: e.target.value };
                    setBillingMonths(updated);
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, padding: "12px 0", borderTop: `1px solid ${C.g200}` }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>
              Total: {svc.currency} {billingMonths.reduce((s, m) => s + m.amount, 0).toLocaleString()}
            </span>
            <Button
              onClick={saveBillingPlan}
              disabled={saveBillingMutation.isPending}
              style={{ background: C.accent, color: "#fff", fontWeight: 700 }}
            >
              {saveBillingMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : null}
              Guardar Plan de Cobro
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Pipedrive Sync Dialog ═══ */}
      <Dialog open={showPipedriveDialog} onOpenChange={setShowPipedriveDialog}>
        <DialogContent style={{ maxWidth: 440 }}>
          <DialogHeader><DialogTitle>Sincronizar Deal de Pipedrive</DialogTitle></DialogHeader>
          <p style={{ fontSize: 12, color: C.g400, marginBottom: 4 }}>
            Ingresa el ID del Deal en Pipedrive. Todos los datos del negocio (contacto, organización, monto, fechas, notas, actividades y emails) se traerán automáticamente desde la API.
          </p>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <Label>Deal ID (Pipedrive) *</Label>
              <Input
                value={pdDealId}
                onChange={(e) => setPdDealId(e.target.value)}
                placeholder="Ej: 1996"
                style={{ marginTop: 4, fontSize: 16, fontWeight: 700, textAlign: "center" }}
                type="number"
              />
              <p style={{ fontSize: 10, color: C.g400, marginTop: 4 }}>Puedes encontrar el Deal ID en la URL del deal en Pipedrive</p>
            </div>
            {syncPipedriveMutation.isPending && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(59,142,232,.06)", borderRadius: 10, border: `1px solid rgba(59,142,232,.15)` }}>
                <Loader2 size={18} className="animate-spin" color={C.accent} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Conectando con Pipedrive...</div>
                  <div style={{ fontSize: 10, color: C.g400 }}>Obteniendo deal, contacto, notas, actividades y emails</div>
                </div>
              </div>
            )}
            <Button
              onClick={handleSyncPipedrive}
              disabled={syncPipedriveMutation.isPending || !pdDealId}
              style={{ background: C.accent, color: "#fff", fontWeight: 700, padding: "12px 24px" }}
            >
              {syncPipedriveMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
              Sincronizar desde Pipedrive
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
