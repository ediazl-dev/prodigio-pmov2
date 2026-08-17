import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CheckCircle2, Loader2, Plus, Shield, Sparkles, Trash2,
  Download, FileSpreadsheet, AlertTriangle, Brain, ExternalLink,
  ChevronDown, ChevronUp, XCircle, CheckCheck, Upload, FileCheck2,
  FileText, ChevronRight, Lock, User, Calendar,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import StageClosurePanel from "@/components/StageClosurePanel";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import StageLayout from "@/components/StageLayout";
import StageTimeIndicator from "@/components/StageTimeIndicator";
import { RiskProgressPanel } from "@/components/JiraProgressPanel";

const PROB_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-amber-100 text-amber-700",
  baja: "bg-emerald-100 text-emerald-700",
};
const IMPACT_COLORS: Record<string, string> = {
  alto: "bg-red-100 text-red-700",
  medio: "bg-amber-100 text-amber-700",
  bajo: "bg-emerald-100 text-emerald-700",
};
const TYPE_COLORS: Record<string, string> = {
  riesgo: "bg-orange-100 text-orange-700",
  riesgo_oculto: "bg-red-100 text-red-700",
  supuesto_no_validado: "bg-purple-100 text-purple-700",
  dependencia_externa: "bg-blue-100 text-blue-700",
};
const TYPE_LABELS: Record<string, string> = {
  riesgo: "Riesgo",
  riesgo_oculto: "Riesgo Oculto",
  supuesto_no_validado: "Supuesto No Validado",
  dependencia_externa: "Dependencia Externa",
};
const SCORE_COLOR = (score: number) =>
  score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600";
const SCORE_BG = (score: number) =>
  score >= 80 ? "bg-emerald-50 border-emerald-200" : score >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

type FlowStep = "sow-upload" | "generate" | "matrix" | "close";

export default function RisksStage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const approvalFileRef = useRef<HTMLInputElement>(null);

  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [generatingElapsed, setGeneratingElapsed] = useState(0);
  const [risks, setRisks] = useState<any[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState<FlowStep>("sow-upload");

  // SoW upload state
  const [uploadingApproval, setUploadingApproval] = useState(false);
  const [clientApproverName, setClientApproverName] = useState("");
  const [clientApprovalDate, setClientApprovalDate] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");

  // Excel export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportNotes, setExportNotes] = useState("");

  // Agentic review modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // JIRA creation result - inline progress panel
  const [jiraClosing, setJiraClosing] = useState(false);
  const [jiraRiskResult, setJiraRiskResult] = useState<any>(null);

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: existingRisks, refetch } = trpc.risks.get.useQuery({ projectId });
  const { data: stages } = trpc.stages.getAll.useQuery({ projectId });
  const { data: versions, refetch: refetchVersions } = trpc.risks.getVersions.useQuery({ projectId });
  const { data: nextVersionData } = trpc.risks.getNextVersion.useQuery({ projectId });
  const { data: sowApproval, refetch: refetchApproval } = trpc.sow.getApproval.useQuery({ projectId, stageId: "risks" });
  const risksStage = stages?.find((s: any) => s.stageId === "risks");

  const isAdmin = user?.role === "admin";
  const isPmo = user?.role === "pmo";
  const canManage = isAdmin || isPmo;
  const isStageClosed = risksStage?.status === "completed";
  const hasSowApproval = !!sowApproval;

  useEffect(() => {
    if (existingRisks && !initialized) {
      setRisks(existingRisks);
      setInitialized(true);
    }
  }, [existingRisks, initialized]);

  // Auto-advance to generate step if SoW is already uploaded
  useEffect(() => {
    if (hasSowApproval && activeStep === "sow-upload") {
      setActiveStep("generate");
    }
  }, [hasSowApproval]);

  const generateMutation = trpc.risks.generate.useMutation();
  const saveMutation = trpc.risks.save.useMutation();
  const exportMutation = trpc.risks.exportExcel.useMutation();
  const agenticReviewMutation = trpc.risks.agenticReview.useMutation();
  const createJiraMutation = trpc.risks.createJiraIssues.useMutation();
  const retryRiskJiraMutation = trpc.risks.retryRiskJira.useMutation();
  const confirmRiskMutation = trpc.risks.confirmRisk.useMutation();
  const bulkConfirmMutation = trpc.risks.bulkConfirmRisks.useMutation();
  const uploadApprovalMutation = trpc.sow.uploadApproval.useMutation();
  const deleteApprovalMutation = trpc.sow.deleteApproval.useMutation();

  const confirmedCount = risks.filter((r: any) => r.confirmed).length;

  // Steps definition
  const steps: { id: FlowStep; label: string; icon: React.ReactNode; number: number }[] = [
    { id: "sow-upload", label: "SoW Formalizado", icon: <FileCheck2 className="h-4 w-4" />, number: 1 },
    { id: "generate", label: "Generación de Riesgos", icon: <Sparkles className="h-4 w-4" />, number: 2 },
    { id: "matrix", label: "Matriz de Riesgos", icon: <Shield className="h-4 w-4" />, number: 3 },
    { id: "close", label: "Cierre de Etapa", icon: <Lock className="h-4 w-4" />, number: 4 },
  ];

  const stepStatus = {
    "sow-upload": hasSowApproval,
    "generate": risks.length > 0,
    "matrix": risks.length > 0,
    "close": isStageClosed,
  };

  const handleApprovalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Solo se aceptan archivos PDF o DOCX");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("El archivo no puede superar 16MB");
      return;
    }
    if (!clientApproverName.trim()) {
      toast.error("Debe ingresar el nombre del cliente que firmó el SoW");
      return;
    }
    if (!clientApprovalDate) {
      toast.error("Debe ingresar la fecha de firma");
      return;
    }

    setUploadingApproval(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        await uploadApprovalMutation.mutateAsync({
          projectId,
          stageId: "risks",
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type,
          notes: approvalNotes || undefined,
          clientApproverName: clientApproverName.trim(),
          clientApprovalDate,
        });
        toast.success("SoW formalizado cargado correctamente. Ya puede generar la matriz de riesgos.", { duration: 5000 });
        setUploadingApproval(false);
        setApprovalNotes("");
        refetchApproval();
        setActiveStep("generate");
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err.message);
      setUploadingApproval(false);
    }
  };

  const handleDeleteApproval = async () => {
    if (!sowApproval) return;
    try {
      await deleteApprovalMutation.mutateAsync({ approvalId: sowApproval.id });
      toast.success("Documento eliminado");
      refetchApproval();
      setActiveStep("sow-upload");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleConfirm = async (idx: number) => {
    const risk = risks[idx];
    if (!risk.id) {
      toast.error("Guarda los riesgos primero antes de confirmarlos.");
      return;
    }
    const newConfirmed = !risk.confirmed;
    const updated = [...risks];
    updated[idx] = { ...updated[idx], confirmed: newConfirmed };
    setRisks(updated);
    try {
      await confirmRiskMutation.mutateAsync({ riskId: risk.id, confirmed: newConfirmed });
    } catch (err: any) {
      const reverted = [...risks];
      reverted[idx] = { ...reverted[idx], confirmed: !newConfirmed };
      setRisks(reverted);
      toast.error(err.message);
    }
  };

  const handleConfirmAll = async () => {
    const savedRisks = risks.filter((r: any) => r.id);
    if (savedRisks.length === 0) {
      toast.error("Guarda los riesgos primero antes de confirmarlos.");
      return;
    }
    const allConfirmed = savedRisks.every((r: any) => r.confirmed);
    const updated = risks.map((r: any) => r.id ? { ...r, confirmed: !allConfirmed } : r);
    setRisks(updated);
    try {
      const confirmedIds = !allConfirmed ? savedRisks.map((r: any) => r.id) : [];
      await bulkConfirmMutation.mutateAsync({ projectId, confirmedIds });
      toast.success(!allConfirmed ? `${savedRisks.length} riesgos confirmados para JIRA` : "Confirmaciones removidas");
    } catch (err: any) {
      setRisks(risks);
      toast.error(err.message);
    }
  };

  // Progress animation during generation
  useEffect(() => {
    if (!generating) { setGeneratingStep(0); setGeneratingElapsed(0); return; }
    const stepTimer = setInterval(() => {
      setGeneratingStep(s => s < 4 ? s + 1 : s);
    }, 6000);
    const elapsedTimer = setInterval(() => {
      setGeneratingElapsed(s => s + 1);
    }, 1000);
    return () => { clearInterval(stepTimer); clearInterval(elapsedTimer); };
  }, [generating]);

  const handleGenerate = async () => {
    if (!hasSowApproval) {
      toast.error("Debe cargar el SoW formalizado antes de generar los riesgos.");
      setActiveStep("sow-upload");
      return;
    }
    setGenerating(true);
    setGeneratingStep(0);
    setGeneratingElapsed(0);
    try {
      const result = await generateMutation.mutateAsync({
        projectId,
        context: `${project?.projectName} - ${project?.clientName} - Tipo: ${project?.projectType}`,
      });
      setRisks(result.risks);
      setInitialized(false);
      toast.success(`${result.risks.length} riesgos generados exitosamente`, {
        description: "La IA analizó el SoW formalizado del cliente y generó la matriz de riesgos.",
        duration: 6000,
      });
      refetch();
      setActiveStep("matrix");
    } catch (err: any) {
      toast.error("Error en la generación de riesgos", {
        description: err.message || "Intenta nuevamente. Si el problema persiste, contacta soporte.",
        duration: 8000,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ projectId, risks });
      toast.success("Matriz de riesgos guardada");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleExportExcel = async () => {
    try {
      await saveMutation.mutateAsync({ projectId, risks });
      const result = await exportMutation.mutateAsync({ projectId, notes: exportNotes });
      toast.success(`Excel generado: versión ${result.version}`);
      window.open(result.url, "_blank");
      setShowExportModal(false);
      setExportNotes("");
      refetchVersions();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAgenticReview = async () => {
    setReviewLoading(true);
    setShowReviewModal(true);
    try {
      await saveMutation.mutateAsync({ projectId, risks });
      const result = await agenticReviewMutation.mutateAsync({ projectId });
      setReviewResult(result);
    } catch (err: any) {
      toast.error(err.message);
      setShowReviewModal(false);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCreateJiraIssues = async () => {
    try {
      const result = await createJiraMutation.mutateAsync({ projectId });
      setJiraRiskResult(result);
      setShowReviewModal(false);
      refetch();
      toast.success(`${result.created} riesgos creados como issues en JIRA`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateRisk = (idx: number, field: string, value: string) => {
    const updated = [...risks];
    updated[idx] = { ...updated[idx], [field]: value };
    setRisks(updated);
  };

  const addRisk = () => {
    setRisks([...risks, {
      riskCode: `R${String(risks.length + 1).padStart(3, "0")}`,
      description: "",
      category: "tecnico",
      type: "riesgo",
      probability: "media",
      impact: "medio",
      mitigation: "",
      contingency: "",
      owner: "PM",
      dueDate: "",
      estimatedCost: "",
    }]);
  };

  const removeRisk = (idx: number) => {
    const updated = [...risks];
    updated.splice(idx, 1);
    setRisks(updated);
  };

  const handleRetryRiskJira = async () => {
    setJiraClosing(true);
    setJiraRiskResult(null);
    try {
      const result = await retryRiskJiraMutation.mutateAsync({ projectId });
      setJiraRiskResult(result);
      refetch();
      setInitialized(false);
      if (result.errors === 0) {
        toast.success(`${result.created} riesgos creados exitosamente en JIRA`, {
          description: `Proyecto: ${result.projectKey} · Tiempo: ${(result.elapsedMs / 1000).toFixed(1)}s`,
          duration: 6000,
        });
      } else {
        toast.warning(`${result.created} creados, ${result.errors} con error`, {
          description: "Algunos riesgos no pudieron crearse. Puedes reintentar.",
          duration: 8000,
        });
      }
    } catch (err: any) {
      toast.error(err.message, { duration: 8000 });
    } finally {
      setJiraClosing(false);
    }
  };

  const highRisks = risks.filter((r: any) => r.probability === "alta" && r.impact === "alto").length;
  const mediumRisks = risks.filter((r: any) => r.probability === "media" || r.impact === "medio").length;
  const withJira = risks.filter((r: any) => r.jiraIssueKey).length;
  const pendingJira = risks.filter((r: any) => r.id && !r.jiraIssueKey).length;

  return (
    <StageLayout
      projectName={project?.projectName ?? "Proyecto"}
      projectId={projectId}
      stageKey="risks"
      subtitle={project?.projectName}
      icon={<Shield size={22} />}
      headerRight={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)} disabled={risks.length === 0} className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleAgenticReview} disabled={risks.length === 0 || reviewLoading} className="gap-1.5 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
            <Brain className="h-3.5 w-3.5" />
            Revisión Agéntica
          </Button>
        </div>
      }
    >

      {/* Time Indicator */}
      <StageTimeIndicator projectId={projectId} stageId="risks" />

      {/* Step Navigator */}
      <div className="flex items-center gap-0 bg-muted/30 p-1.5 rounded-xl border">
        {steps.map((step, idx) => {
          const isActive = activeStep === step.id;
          const isCompleted = stepStatus[step.id];
          const isClickable = step.id === "sow-upload"
            || (step.id === "generate" && hasSowApproval)
            || (step.id === "matrix" && risks.length > 0)
            || step.id === "close";

          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => isClickable && setActiveStep(step.id)}
                disabled={!isClickable}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all w-full justify-center ${
                  isActive
                    ? "bg-white text-foreground shadow-sm ring-1 ring-border/50"
                    : isCompleted
                      ? "text-emerald-700 hover:bg-white/50 cursor-pointer"
                      : isClickable
                        ? "text-muted-foreground hover:text-foreground hover:bg-white/50 cursor-pointer"
                        : "text-muted-foreground/40 cursor-not-allowed"
                }`}
              >
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isCompleted && !isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : isActive
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {isCompleted && !isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.number}
                </div>
                <span className="hidden md:inline">{step.label}</span>
              </button>
              {idx < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 mx-0.5" />
              )}
            </div>
          );
        })}
      </div>

      {/* ========== STEP 1: SOW UPLOAD ========== */}
      {activeStep === "sow-upload" && (
        <div className="space-y-5">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-primary" />
                SoW Formalizado por el Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Antes de generar la matriz de riesgos, cargue el <strong>SoW formalizado y firmado por el cliente</strong>.
                Este documento es la fuente primaria que la IA utilizará para identificar riesgos específicos del proyecto.
              </p>

              {sowApproval ? (
                /* Document uploaded */
                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileCheck2 className="h-8 w-8 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium">{sowApproval.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          Cargado el {new Date(sowApproval.uploadedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}
                          {sowApproval.fileSize ? ` · ${(sowApproval.fileSize / 1024).toFixed(0)} KB` : ""}
                        </p>
                        {sowApproval.clientApproverName && (
                          <p className="text-xs text-emerald-700 mt-0.5">
                            Firmado por: {sowApproval.clientApproverName}
                            {sowApproval.clientApprovalDate ? ` el ${sowApproval.clientApprovalDate}` : ""}
                          </p>
                        )}
                        {sowApproval.notes && <p className="text-xs text-muted-foreground mt-0.5">Nota: {sowApproval.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={sowApproval.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1">
                          <Download className="h-3.5 w-3.5" /> Ver
                        </Button>
                      </a>
                      {canManage && !isStageClosed && (
                        <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={handleDeleteApproval}>
                          <Trash2 className="h-3.5 w-3.5" /> Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Upload form */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        Nombre del firmante del cliente <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="Nombre completo del representante del cliente"
                        value={clientApproverName}
                        onChange={(e) => setClientApproverName(e.target.value)}
                        disabled={!canManage || isStageClosed}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Fecha de firma <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={clientApprovalDate}
                        onChange={(e) => setClientApprovalDate(e.target.value)}
                        disabled={!canManage || isStageClosed}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Observaciones (opcional)</Label>
                    <Textarea
                      placeholder="Ej: SoW firmado en reunión de kickoff del 15 de marzo de 2026..."
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      rows={2}
                      disabled={!canManage || isStageClosed}
                    />
                  </div>

                  <input
                    ref={approvalFileRef}
                    type="file"
                    accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={handleApprovalFileChange}
                  />

                  {canManage && !isStageClosed ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!clientApproverName.trim()) {
                          toast.error("Debe ingresar el nombre del firmante del cliente");
                          return;
                        }
                        if (!clientApprovalDate) {
                          toast.error("Debe ingresar la fecha de firma");
                          return;
                        }
                        approvalFileRef.current?.click();
                      }}
                      disabled={uploadingApproval}
                      className="gap-2"
                    >
                      {uploadingApproval ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploadingApproval ? "Cargando..." : "Cargar SoW Formalizado (PDF/DOCX)"}
                    </Button>
                  ) : (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                      Solo usuarios con rol Admin o PMO pueden cargar el SoW formalizado.
                    </div>
                  )}

                  {/* Empty state */}
                  {!sowApproval && (
                    <div className="text-center py-6 border-2 border-dashed rounded-xl">
                      <FileCheck2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground font-medium">SoW formalizado no cargado</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Complete los datos de firma y cargue el documento PDF o DOCX
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Next step hint */}
          {hasSowApproval && (
            <div className="flex justify-end">
              <Button onClick={() => setActiveStep("generate")} className="gap-2">
                Continuar a Generación de Riesgos
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ========== STEP 2: GENERATE ========== */}
      {activeStep === "generate" && (
        <div className="space-y-5">
          {/* SoW document status */}
          {hasSowApproval && (
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-800">SoW formalizado disponible</p>
                    <p className="text-xs text-emerald-700">{sowApproval!.fileName} · La IA usará este documento como fuente primaria</p>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setActiveStep("sow-upload")}>
                    <FileText className="h-3.5 w-3.5" /> Ver
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Generation Card */}
          {generating ? (
            <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center animate-pulse">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-amber-900">Generación Agéntica en Curso</p>
                    <p className="text-xs text-amber-700">Analizando el SoW formalizado del cliente y el contexto del proyecto...</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-2xl font-mono font-bold text-amber-700">{generatingElapsed}s</p>
                    <p className="text-[10px] text-amber-600">Tiempo transcurrido</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Leyendo SoW formalizado del cliente", icon: "📄" },
                    { label: "Analizando entregables, supuestos y dependencias", icon: "🔍" },
                    { label: "Identificando riesgos técnicos y organizacionales", icon: "⚠️" },
                    { label: "Evaluando riesgos ocultos y supuestos no validados", icon: "🧠" },
                    { label: "Generando estrategias de mitigación y contingencia", icon: "🛡️" },
                  ].map((step, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-500 ${
                      i < generatingStep ? "bg-emerald-100/80 text-emerald-800" :
                      i === generatingStep ? "bg-white shadow-sm border border-amber-200 text-amber-900" :
                      "text-amber-400"
                    }`}>
                      <span className="text-base w-6 text-center">
                        {i < generatingStep ? "✓" : step.icon}
                      </span>
                      <span className={`text-sm ${i === generatingStep ? "font-semibold" : ""}`}>{step.label}</span>
                      {i === generatingStep && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto text-amber-600" />}
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-amber-200/50 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min((generatingStep / 5) * 100 + (generatingElapsed % 6) * 3, 95)}%` }} />
                </div>
                <p className="text-[11px] text-amber-600 mt-2 text-center">Este proceso puede tomar entre 20 y 40 segundos. No cierres esta página.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 flex items-center gap-4">
                <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Generación Agéntica de Riesgos</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    La IA analizará el SoW formalizado del cliente para identificar riesgos técnicos, organizacionales, ocultos, supuestos no validados y dependencias externas.
                  </p>
                </div>
                <Button onClick={handleGenerate} disabled={generating || !hasSowApproval} size="sm" className="shrink-0 gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                  <Sparkles className="h-4 w-4" />
                  {risks.length > 0 ? "Regenerar con IA" : "Generar con IA"}
                </Button>
              </CardContent>
            </Card>
          )}

          {risks.length > 0 && !generating && (
            <div className="flex justify-end">
              <Button onClick={() => setActiveStep("matrix")} className="gap-2">
                Ver Matriz de Riesgos ({risks.length})
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ========== STEP 3: MATRIX ========== */}
      {activeStep === "matrix" && (
        <div className="space-y-5">
          {/* Stats */}
          {risks.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{risks.length}</p>
                  <p className="text-xs text-muted-foreground">Total Riesgos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{highRisks}</p>
                  <p className="text-xs text-muted-foreground">Riesgos Altos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{mediumRisks}</p>
                  <p className="text-xs text-muted-foreground">Riesgos Medios</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{withJira}</p>
                  <p className="text-xs text-muted-foreground">En JIRA</p>
                </CardContent>
              </Card>
              <Card className={confirmedCount > 0 ? "border-emerald-400" : ""}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{confirmedCount}</p>
                  <p className="text-xs text-muted-foreground">Confirmados JIRA</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Risk Table */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Riesgos Identificados ({risks.length})</CardTitle>
                {risks.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Marca los riesgos confirmados para que se creen en JIRA al cerrar la etapa.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {risks.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleConfirmAll} className="gap-1 text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-50">
                    <CheckCircle2 className="h-3 w-3" />
                    {risks.filter((r: any) => r.id && r.confirmed).length === risks.filter((r: any) => r.id).length && risks.filter((r: any) => r.id).length > 0 ? "Desmarcar Todos" : "Confirmar Todos"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={addRisk} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Agregar Riesgo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {risks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay riesgos registrados. Usa la IA para generarlos automáticamente.</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={() => setActiveStep("generate")}>
                    <Sparkles className="h-3.5 w-3.5" /> Ir a Generación
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {risks.map((risk, idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden">
                      {/* Risk header - always visible */}
                      <div
                        className={`p-3 flex items-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors ${risk.confirmed ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
                        onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                      >
                        {/* Confirm checkbox */}
                        <div
                          className="shrink-0"
                          onClick={(e) => { e.stopPropagation(); handleToggleConfirm(idx); }}
                          title={risk.confirmed ? "Confirmado para JIRA - click para desmarcar" : "Marcar como confirmado para JIRA"}
                        >
                          <div className={`h-4 w-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                            risk.confirmed ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40 hover:border-emerald-400"
                          }`}>
                            {risk.confirmed && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-muted-foreground w-12 shrink-0">{risk.riskCode}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[risk.type] ?? "bg-gray-100 text-gray-700"}`}>
                          {TYPE_LABELS[risk.type] ?? risk.type}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${PROB_COLORS[risk.probability] ?? ""}`}>
                          P: {risk.probability}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${IMPACT_COLORS[risk.impact] ?? ""}`}>
                          I: {risk.impact}
                        </span>
                        <p className="text-xs text-muted-foreground flex-1 truncate">{risk.description}</p>
                        {risk.jiraIssueKey && (
                          <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300 shrink-0 gap-1">
                            <ExternalLink className="h-2.5 w-2.5" />
                            {risk.jiraIssueKey}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="px-1.5 h-6" onClick={(e) => { e.stopPropagation(); removeRisk(idx); }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                          {expandedIdx === idx ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Expanded editing area */}
                      {expandedIdx === idx && (
                        <div className="border-t p-4 space-y-3 bg-muted/10">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Descripción *</p>
                              <Textarea rows={3} value={risk.description ?? ""} onChange={(e) => updateRisk(idx, "description", e.target.value)} className="text-xs" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Mitigación</p>
                              <Textarea rows={3} value={risk.mitigation ?? ""} onChange={(e) => updateRisk(idx, "mitigation", e.target.value)} className="text-xs" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Tipo</p>
                              <Select value={risk.type ?? "riesgo"} onValueChange={(v) => updateRisk(idx, "type", v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Probabilidad</p>
                              <Select value={risk.probability ?? "media"} onValueChange={(v) => updateRisk(idx, "probability", v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="alta" className="text-xs">Alta</SelectItem>
                                  <SelectItem value="media" className="text-xs">Media</SelectItem>
                                  <SelectItem value="baja" className="text-xs">Baja</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Impacto</p>
                              <Select value={risk.impact ?? "medio"} onValueChange={(v) => updateRisk(idx, "impact", v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="alto" className="text-xs">Alto</SelectItem>
                                  <SelectItem value="medio" className="text-xs">Medio</SelectItem>
                                  <SelectItem value="bajo" className="text-xs">Bajo</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Responsable</p>
                              <Input className="h-7 text-xs" value={risk.owner ?? ""} onChange={(e) => updateRisk(idx, "owner", e.target.value)} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save button */}
          {risks.length > 0 && !isStageClosed && (
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar Matriz
              </Button>
              <Button onClick={() => setActiveStep("close")} className="gap-2">
                Continuar al Cierre
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Excel versions */}
          {versions && versions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Historial de Exportaciones Excel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {versions.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg border text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">{v.version}</Badge>
                        <span className="font-medium">{v.fileName}</span>
                        {v.notes && <span className="text-muted-foreground">· {v.notes}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{v.createdByName} · {new Date(v.createdAt).toLocaleDateString("es-CL")}</span>
                        <Button variant="ghost" size="sm" className="h-6 px-2 gap-1" onClick={() => window.open(v.fileUrl, "_blank")}>
                          <Download className="h-3 w-3" /> Descargar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========== STEP 4: CLOSE ========== */}
      {activeStep === "close" && (
        <div className="space-y-5">
          {/* Retry Pending JIRA Banner */}
          {isStageClosed && pendingJira > 0 && !jiraClosing && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                  {pendingJira} riesgo{pendingJira !== 1 ? "s" : ""} sin issue JIRA
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  La etapa está cerrada pero algunos riesgos no se crearon en JIRA. Puedes reintentar la creación.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleRetryRiskJira}
                disabled={retryRiskJiraMutation.isPending}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
              >
                {retryRiskJiraMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                Reintentar Pendientes
              </Button>
            </div>
          )}

          {/* All synced banner */}
          {isStageClosed && pendingJira === 0 && withJira > 0 && !jiraClosing && !jiraRiskResult && (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                  Todos los riesgos sincronizados con JIRA ({withJira} issues)
                </p>
              </div>
            </div>
          )}

          {/* JIRA Risk Creation Progress Panel */}
          {(jiraClosing || jiraRiskResult) && (
            <RiskProgressPanel
              result={jiraRiskResult}
              isLoading={jiraClosing && !jiraRiskResult}
              estimatedItems={pendingJira > 0 ? pendingJira : risks.length}
            />
          )}

          {/* Formal Stage Closure */}
          <StageClosurePanel
            projectId={projectId}
            stageId="risks"
            stageName="Riesgos"
            stageStatus={risksStage?.status ?? "locked"}
            onClosingStart={() => {
              setJiraClosing(true);
              setJiraRiskResult(null);
            }}
            onJiraResults={(data) => {
              setJiraClosing(false);
              setJiraRiskResult(data);
              refetch();
            }}
            onClosed={() => {
              setTimeout(() => refetch(), 500);
            }}
          />
        </div>
      )}

      {/* ===== Export Excel Modal ===== */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Exportar Matriz de Riesgos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg text-sm">
              <span className="text-muted-foreground">Próxima versión</span>
              <Badge variant="outline" className="font-mono">{nextVersionData?.version ?? "v1.0"}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg text-sm">
              <span className="text-muted-foreground">Riesgos a exportar</span>
              <span className="font-semibold">{risks.length}</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notas de versión (opcional)</label>
              <Textarea
                rows={2}
                placeholder="Ej: Primera versión revisada con el cliente..."
                value={exportNotes}
                onChange={(e) => setExportNotes(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>Cancelar</Button>
            <Button onClick={handleExportExcel} disabled={exportMutation.isPending} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exportMutation.isPending ? "Generando..." : "Generar y Descargar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Agentic Review Modal ===== */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Revisión Agéntica de Riesgos
            </DialogTitle>
          </DialogHeader>

          {reviewLoading ? (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
              <div className="text-center">
                <p className="font-semibold">Analizando la Matriz de Riesgos...</p>
                <p className="text-sm text-muted-foreground mt-1">El agente está evaluando la calidad, completitud y cobertura de los riesgos identificados.</p>
              </div>
            </div>
          ) : reviewResult ? (
            <div className="space-y-5 py-2">
              {/* Score cards */}
              <div className={`grid grid-cols-4 gap-3 p-4 rounded-lg border ${SCORE_BG(reviewResult.evaluation.overallScore)}`}>
                {[
                  { label: "Score Global", value: reviewResult.evaluation.overallScore },
                  { label: "Completitud", value: reviewResult.evaluation.completenessScore },
                  { label: "Calidad", value: reviewResult.evaluation.qualityScore },
                  { label: "Cobertura", value: reviewResult.evaluation.coverageScore },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`text-2xl font-bold ${SCORE_COLOR(s.value)}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="p-3 bg-muted/40 rounded-lg text-sm">
                <p className="font-semibold mb-1">Resumen Ejecutivo</p>
                <p className="text-muted-foreground">{reviewResult.evaluation.summary}</p>
              </div>

              {/* Strengths */}
              {reviewResult.evaluation.strengths?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Fortalezas</p>
                  <ul className="space-y-1">
                    {reviewResult.evaluation.strengths.map((s: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Gaps */}
              {reviewResult.evaluation.gaps?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Brechas Identificadas</p>
                  <div className="space-y-2">
                    {reviewResult.evaluation.gaps.map((g: any, i: number) => (
                      <div key={i} className="p-2.5 rounded border text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono text-[10px]">{g.riskCode}</Badge>
                          <Badge className={`text-[10px] ${g.severity === "alta" ? "bg-red-100 text-red-700" : g.severity === "media" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{g.severity}</Badge>
                        </div>
                        <p className="text-muted-foreground">{g.issue}</p>
                        <p className="text-foreground mt-1 font-medium">{g.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {reviewResult.evaluation.recommendations?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2">Recomendaciones</p>
                  <div className="space-y-2">
                    {reviewResult.evaluation.recommendations.map((r: any, i: number) => (
                      <div key={i} className="p-2.5 rounded border text-xs flex gap-3">
                        <Badge className={`text-[10px] shrink-0 ${r.priority === "alta" ? "bg-red-100 text-red-700" : r.priority === "media" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{r.priority}</Badge>
                        <div>
                          <p className="font-medium">{r.action}</p>
                          <p className="text-muted-foreground mt-0.5">{r.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* JIRA readiness */}
              <div className={`p-3 rounded-lg border text-sm ${reviewResult.evaluation.readyForJira ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {reviewResult.evaluation.readyForJira
                    ? <CheckCheck className="h-4 w-4 text-blue-600" />
                    : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  <p className="font-semibold">{reviewResult.evaluation.readyForJira ? "Lista para crear en JIRA" : "Revisar antes de crear en JIRA"}</p>
                </div>
                <p className="text-muted-foreground text-xs">{reviewResult.evaluation.readyForJiraReason}</p>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>Cerrar</Button>
            {reviewResult && (
              <Button
                onClick={handleCreateJiraIssues}
                disabled={createJiraMutation.isPending}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createJiraMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                {createJiraMutation.isPending ? "Creando en JIRA..." : `Confirmar y Crear ${reviewResult.riskCount} Issues en JIRA`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </StageLayout>
  );
}
