import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import StageLayout from "@/components/StageLayout";
import StageTimeIndicator from "@/components/StageTimeIndicator";
import {
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Lock,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  AlertTriangle,
  ChevronRight,
  FileUp,
} from "lucide-react";
import { useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import SowPreview from "./SowPreview";

type FlowStep = "documents" | "generate" | "preview" | "close";

export default function SowStage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  // Data queries
  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: sow, refetch } = trpc.sow.get.useQuery({ projectId });
  const { data: stages } = trpc.stages.getAll.useQuery({ projectId });
  const { data: nextVersionData } = trpc.sow.getNextVersion.useQuery({ projectId });
  const { data: sourceDocs, refetch: refetchSourceDocs } = trpc.sow.getSourceDocs.useQuery({ projectId });

  // State
  const [form, setForm] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [docxVersion, setDocxVersion] = useState("");
  const [docxRedactor, setDocxRedactor] = useState("");
  const [docxRedactorRole, setDocxRedactorRole] = useState("");
    const [closingStage, setClosingStage] = useState(false);
  const [uploadingSignedSow, setUploadingSignedSow] = useState(false);
  const signedSowRef = useRef<HTMLInputElement>(null);
  // Close form fields
  const [closeNotes, setCloseNotes] = useState("");

  // Initialize form from existing SoW
  if (sow && !initialized) {
    setForm({
      generalObjective: sow.generalObjective ?? "",
      specificObjectives: sow.specificObjectives ?? [],
      activitiesIncluded: sow.activitiesIncluded ?? [],
      deliverables: sow.deliverables ?? [],
      limitations: sow.limitations ?? [],
      assumptions: sow.assumptions ?? [],
      clientDependencies: sow.clientDependencies ?? [],
      risks: sow.risks ?? [],
      prerequisites: sow.prerequisites ?? [],
      milestones: sow.milestones ?? [],
      meetingFrequency: sow.meetingFrequency ?? "",
      communicationChannel: sow.communicationChannel ?? "",
      totalAmount: sow.totalAmount ?? "",
      currency: sow.currency ?? "USD",
      introText: sow.introText ?? "",
      billingMilestones: sow.billingMilestones ?? [],
      prodigioTeam: sow.prodigioTeam ?? [],
      clientTeam: sow.clientTeam ?? [],
    });
    setInitialized(true);
  }

  // Mutations
  const uploadMutation = trpc.sow.uploadPdf.useMutation();
  const extractMutation = trpc.sow.extractFromPdf.useMutation();
  const saveMutation = trpc.sow.save.useMutation();
  const downloadDocxMutation = trpc.sow.downloadDocx.useMutation();
  const previewMarkdownQuery = trpc.sow.previewMarkdown.useQuery({ projectId }, { enabled: false });
  const deleteSourceDocMutation = trpc.sow.deleteSourceDoc.useMutation();
  const closeStageMutation = trpc.stages.formalClose.useMutation();
  const uploadApprovalMutation = trpc.sow.uploadApproval.useMutation();
  const { data: sowApproval, refetch: refetchApproval } = trpc.sow.getApproval.useQuery({ projectId, stageId: "sow" });

  // Derived state
  const isAdmin = user?.role === "admin";
  const isPmo = user?.role === "pmo";
  const canManage = isAdmin || isPmo;
  const sowStage = stages?.find((s: any) => s.stageId === "sow");
  const isStageClosed = sowStage?.status === "completed";
  const hasSow = !!sow?.generalObjective;
  const hasSourceDocs = (sourceDocs?.length ?? 0) > 0;

  // Determine active step based on state
  const [activeStep, setActiveStep] = useState<FlowStep>("documents");

  // Step completion status
  const stepStatus = useMemo(() => ({
    documents: hasSourceDocs,
    generate: hasSow,
    preview: hasSow,
    close: isStageClosed,
  }), [hasSourceDocs, hasSow, isStageClosed]);

  const hasSignedSow = !!sowApproval?.fileUrl;
  const canClose = hasSow && hasSignedSow && canManage && !isStageClosed;

  // Steps definition
  const steps: { id: FlowStep; label: string; icon: React.ReactNode; number: number }[] = [
    { id: "documents", label: "Documentos de Entrada", icon: <FileUp className="h-4 w-4" />, number: 1 },
    { id: "generate", label: "Generación del SoW", icon: <Sparkles className="h-4 w-4" />, number: 2 },
    { id: "preview", label: "Previsualización", icon: <Eye className="h-4 w-4" />, number: 3 },
    { id: "close", label: "Cierre de Etapa", icon: <ShieldCheck className="h-4 w-4" />, number: 4 },
  ];

  // Handlers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Solo se aceptan archivos PDF");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("El archivo no puede superar 16MB");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        await uploadMutation.mutateAsync({
          projectId,
          fileName: file.name,
          fileBase64: base64,
          mimeType: "application/pdf",
        });
        toast.success(`"${file.name}" cargado correctamente`);
        setUploading(false);
        refetchSourceDocs();
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err.message);
      setUploading(false);
    }
  };

  const handleDeleteSourceDoc = async (fileId: number, fileName: string) => {
    try {
      await deleteSourceDocMutation.mutateAsync({ fileId });
      toast.success(`"${fileName}" eliminado`);
      refetchSourceDocs();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleExtract = async () => {
    if (!sourceDocs || sourceDocs.length === 0) {
      toast.error("Debe cargar al menos un documento de entrada");
      return;
    }
    setExtracting(true);
    try {
      const result = await extractMutation.mutateAsync({
        projectId,
        pdfUrls: sourceDocs.map((d: any) => ({ url: d.fileUrl, fileName: d.fileName })),
        projectName: project?.projectName ?? "",
        clientName: project?.clientName ?? "",
      });
      setForm(result.data);
      setInitialized(false);
      toast.success("SoW generado exitosamente por la IA", {
        description: `Se procesaron ${sourceDocs.length} documento(s) de entrada`,
        duration: 6000,
      });
      refetch();
      setActiveStep("preview");
    } catch (err: any) {
      toast.error("Error al generar el SoW: " + (err.message ?? "Error desconocido"));
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ projectId, data: form });
      toast.success("SoW guardado");
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDownloadDocx = async () => {
    setDownloading(true);
    setShowDownloadModal(false);
    try {
      const result = await downloadDocxMutation.mutateAsync({
        projectId,
        version: docxVersion || undefined,
        redactor: docxRedactor || undefined,
        redactorRole: docxRedactorRole || undefined,
      });
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("SoW descargado correctamente");
      refetch();
    } catch (err: any) {
      toast.error("Error al generar el DOCX: " + (err.message ?? "Error desconocido"));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadMarkdown = async () => {
    setDownloading(true);
    try {
      const result = await previewMarkdownQuery.refetch();
      const markdown = result.data?.markdown;
      if (!markdown) throw new Error("No se pudo obtener el contenido del SoW");
      // Generar descarga directa en el browser sin pasar por S3
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const clientSlug = project?.clientName?.toLowerCase().replace(/\s+/g, "-") ?? "cliente";
      const projectSlug = project?.projectName?.toLowerCase().replace(/\s+/g, "-") ?? "proyecto";
      const fileName = `SoW-${clientSlug}-${projectSlug}.md`;
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`SoW descargado como ${fileName}`);
    } catch (err: any) {
      toast.error("Error al descargar el Markdown: " + (err.message ?? "Error desconocido"));
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadSignedSow = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSignedSow(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        await uploadApprovalMutation.mutateAsync({
          projectId,
          stageId: "sow",
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type,
          notes: "SoW firmado por el cliente",
        });
        toast.success("SoW firmado cargado exitosamente");
        refetchApproval();
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error("Error al cargar el SoW firmado: " + (err.message ?? "Error desconocido"));
    } finally {
      setUploadingSignedSow(false);
      if (signedSowRef.current) signedSowRef.current.value = "";
    }
  };

  const handleCloseStage = async () => {
    if (!hasSow) {
      toast.error("Debe generar el SoW antes de cerrar la etapa.");
      return;
    }
    if (!hasSignedSow) {
      toast.error("Debe cargar el SoW firmado por el cliente antes de cerrar la etapa.");
      return;
    }
    setClosingStage(true);
    try {
      await closeStageMutation.mutateAsync({ projectId, stageId: "sow", confirmed: true, notes: closeNotes || undefined });
      toast.success("Etapa SoW cerrada exitosamente. La siguiente etapa ha sido desbloqueada.", { duration: 6000 });
      refetch();
      setLocation(`/projects/${projectId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setClosingStage(false);
    }
  };

  const updateArray = (field: string, idx: number, value: string) => {
    const arr = [...(form[field] ?? [])];
    arr[idx] = value;
    setForm({ ...form, [field]: arr });
  };

  const addToArray = (field: string) => {
    setForm({ ...form, [field]: [...(form[field] ?? []), ""] });
  };

  const removeFromArray = (field: string, idx: number) => {
    const arr = [...(form[field] ?? [])];
    arr.splice(idx, 1);
    setForm({ ...form, [field]: arr });
  };

  const disabled = isStageClosed;

  return (
    <StageLayout
      projectName={project?.projectName ?? "Proyecto"}
      projectId={projectId}
      stageKey="sow"
      subtitle={project?.projectName}
      icon={<FileText size={22} />}
      headerRight={
        isStageClosed ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Etapa Cerrada
          </span>
        ) : undefined
      }
    >

      {/* Time Indicator */}
      <StageTimeIndicator projectId={projectId} stageId="sow" />

      {/* Step Navigator */}
      <div className="flex items-center gap-0 bg-muted/30 p-1.5 rounded-xl border">
        {steps.map((step, idx) => {
          const isActive = activeStep === step.id;
          const isCompleted = stepStatus[step.id];
          const isClickable = step.id === "documents"
            || (step.id === "generate" && hasSourceDocs)
            || (step.id === "preview" && hasSow)
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

      {/* ========== STEP 1: DOCUMENTS ========== */}
      {activeStep === "documents" && (
        <div className="space-y-5">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileUp className="h-5 w-5 text-primary" />
                Documentos de Entrada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cargue los documentos del proyecto que servirán como base para generar el SoW corporativo.
                El caso típico es cargar la <strong>propuesta técnica</strong> y la <strong>propuesta económica</strong>.
              </p>

              {/* Uploaded documents list */}
              {sourceDocs && sourceDocs.length > 0 && (
                <div className="space-y-2">
                  {sourceDocs.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : "PDF"}
                            {" · "}
                            {new Date(doc.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="gap-1 text-xs">
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </Button>
                        </a>
                        {canManage && !isStageClosed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSourceDoc(doc.id, doc.fileName)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              {canManage && !isStageClosed && (
                <div className="flex items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Cargando..." : "Cargar Documento PDF"}
                  </Button>
                  <span className="text-xs text-muted-foreground">Máximo 16 MB por archivo</span>
                </div>
              )}

              {/* Empty state */}
              {(!sourceDocs || sourceDocs.length === 0) && (
                <div className="text-center py-8 border-2 border-dashed rounded-xl">
                  <FileUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No hay documentos cargados</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cargue la propuesta técnica y/o económica para comenzar
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next step hint */}
          {hasSourceDocs && !isStageClosed && (
            <div className="flex justify-end">
              <Button onClick={() => setActiveStep("generate")} className="gap-2">
                Continuar a Generación del SoW
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ========== STEP 2: GENERATE ========== */}
      {activeStep === "generate" && (
        <div className="space-y-5">
          {/* AI Generation Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generación Agéntica del SoW
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                La IA analizará los documentos cargados y generará automáticamente el Statement of Work
                en formato corporativo de Prodigio Tech.
              </p>

              {/* Source documents summary */}
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documentos de entrada</p>
                {sourceDocs?.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 text-red-500" />
                    <span>{doc.fileName}</span>
                  </div>
                ))}
                {(!sourceDocs || sourceDocs.length === 0) && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>No hay documentos cargados. Vuelva al paso anterior.</span>
                  </div>
                )}
              </div>

              {/* Generate button */}
              {!isStageClosed && hasSourceDocs && (
                <Button
                  size="lg"
                  onClick={handleExtract}
                  disabled={extracting}
                  className="gap-2 w-full sm:w-auto"
                >
                  {extracting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                  {extracting ? "Generando SoW con IA..." : hasSow ? "Regenerar SoW con IA" : "Generar SoW con IA"}
                </Button>
              )}

              {extracting && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">Procesando documentos...</p>
                      <p className="text-xs text-muted-foreground">
                        La IA está analizando {sourceDocs?.length ?? 0} documento(s) y generando el SoW corporativo.
                        Esto puede tomar 30-60 segundos.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Editable SoW Form (if generated) */}
          {hasSow && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  Editar SoW Generado
                </h2>
                {!isStageClosed && (
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Guardar Cambios
                  </Button>
                )}
              </div>

              <SowFormSections
                form={form}
                setForm={setForm}
                updateArray={updateArray}
                addToArray={addToArray}
                removeFromArray={removeFromArray}
                disabled={disabled}
              />

              <div className="flex flex-wrap gap-3 pt-2">
                {!isStageClosed && (
                  <Button variant="outline" onClick={handleSave} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Guardar Borrador
                  </Button>
                )}
                <Button onClick={() => setActiveStep("preview")} className="gap-2">
                  <Eye className="h-4 w-4" />
                  Ver Previsualización
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========== STEP 3: PREVIEW ========== */}
      {activeStep === "preview" && (
        <div className="space-y-5">
          {hasSow ? (
            <>
              {/* Download actions bar */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-medium">Documento SoW generado</p>
                      <p className="text-xs text-muted-foreground">
                        Previsualice el contenido y descargue en formato Markdown (.md)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleDownloadMarkdown}
                        disabled={downloading}
                        className="gap-2 bg-[#E91E8C] hover:bg-[#E91E8C]/90 text-white"
                      >
                        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {downloading ? "Generando..." : "Descargar Markdown"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preview component */}
              <SowPreview
                projectId={projectId}
                form={form}
                project={project}
                isApproved={isStageClosed}
                onDownload={handleDownloadMarkdown}
                downloading={downloading}
              />

              {/* Next step */}
              {!isStageClosed && (
                <div className="flex justify-end">
                  <Button onClick={() => setActiveStep("close")} className="gap-2">
                    Continuar al Cierre de Etapa
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Eye className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No hay SoW generado aún</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vuelva al paso 2 para generar el SoW a partir de los documentos cargados
                </p>
                <Button variant="outline" className="mt-4 gap-2" onClick={() => setActiveStep("generate")}>
                  <Sparkles className="h-4 w-4" />
                  Ir a Generación
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========== STEP 4: CLOSE ========== */}
      {activeStep === "close" && (
        <div className="space-y-5">
          {isStageClosed ? (
            /* Already closed banner */
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="py-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold text-emerald-800">Etapa SoW Cerrada</p>
                    <p className="text-sm text-emerald-600">
                      La etapa fue cerrada formalmente. La siguiente etapa ha sido desbloqueada.
                    </p>
                    {sowApproval?.fileUrl && (
                      <a
                        href={sowApproval.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1 flex items-center gap-1"
                      >
                        <FileCheck2 className="h-3 w-3" />
                        {sowApproval.fileName ?? "SoW firmado"}
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Prerequisite check */}
              {!hasSow && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">SoW no generado</p>
                        <p className="text-xs text-amber-700">Debe generar el SoW en el paso 2 antes de poder cerrar la etapa.</p>
                      </div>
                      <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={() => setActiveStep("generate")}>
                        <Sparkles className="h-3.5 w-3.5" /> Ir a Generación
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Instructions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Cierre Formal de Etapa SoW
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Para cerrar esta etapa debe: (1) tener el SoW generado y (2) cargar el SoW firmado por el cliente.
                    El documento firmado será usado como fuente para la generación de actividades en JIRA.
                  </p>

                  {/* Paso 1: SoW generado */}
                  <div className="flex items-start gap-3">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      hasSow ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                    }`}>
                      {hasSow ? <CheckCircle2 className="h-4 w-4" /> : "1"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">SoW elaborado y revisado</p>
                      <p className="text-xs text-muted-foreground">
                        {hasSow ? "SoW generado y disponible para descarga" : "Debe generar el SoW primero"}
                      </p>
                    </div>
                  </div>

                  {/* Paso 2: SoW firmado */}
                  <div className="flex items-start gap-3">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      hasSignedSow ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {hasSignedSow ? <CheckCircle2 className="h-4 w-4" /> : "2"}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">SoW firmado por el cliente</p>
                      {hasSignedSow ? (
                        <div className="flex items-center gap-2 mt-1">
                          <a
                            href={sowApproval!.fileUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <FileCheck2 className="h-3 w-3" />
                            {sowApproval!.fileName}
                          </a>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-muted-foreground"
                              onClick={() => signedSowRef.current?.click()}
                            >
                              Reemplazar
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1.5">
                          <p className="text-xs text-muted-foreground mb-2">Carga el PDF o DOCX del SoW firmado por el cliente.</p>
                          {canManage && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs"
                              onClick={() => signedSowRef.current?.click()}
                              disabled={uploadingSignedSow || !hasSow}
                            >
                              {uploadingSignedSow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                              {uploadingSignedSow ? "Cargando..." : "Cargar SoW Firmado"}
                            </Button>
                          )}
                        </div>
                      )}
                      <input
                        ref={signedSowRef}
                        type="file"
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={handleUploadSignedSow}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label>Observaciones de cierre (opcional)</Label>
                    <Textarea
                      placeholder="Ej: SoW v1.2 firmado por el cliente el 15/08/2026. Listo para avanzar a etapa de Riesgos."
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      rows={2}
                      disabled={!canManage}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Close stage button */}
              {canClose && (
                <Card className="border-emerald-200">
                  <CardContent className="py-5">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-8 w-8 text-emerald-600" />
                        <div>
                          <p className="text-sm font-semibold">Cerrar Etapa SoW</p>
                          <p className="text-xs text-muted-foreground">
                            Al cerrar, la etapa quedará bloqueada y se desbloqueará la etapa de Riesgos
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleCloseStage}
                        disabled={closingStage}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {closingStage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                        Confirmar Cierre de Etapa
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Download Modal */}
      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-[#E91E8C]" />
              Configurar Documento DOCX
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Completa los datos del documento antes de generar el archivo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="docx-version">Versión del Documento</Label>
                <Input
                  id="docx-version"
                  placeholder={nextVersionData?.nextVersion ? `Auto: ${nextVersionData.nextVersion}` : "Auto-serializado"}
                  value={docxVersion}
                  onChange={(e) => setDocxVersion(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  {nextVersionData?.nextVersion
                    ? `Próxima versión automática: ${nextVersionData.nextVersion}`
                    : "Se asignará automáticamente"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="docx-date">Fecha</Label>
                <Input
                  id="docx-date"
                  value={new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="docx-redactor">Nombre del Redactor</Label>
              <Input
                id="docx-redactor"
                placeholder="Nombre completo del autor del documento"
                value={docxRedactor}
                onChange={(e) => setDocxRedactor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="docx-role">Cargo del Redactor</Label>
              <Input
                id="docx-role"
                placeholder="Ej: Project Manager, PMO Lead"
                value={docxRedactorRole}
                onChange={(e) => setDocxRedactorRole(e.target.value)}
              />
            </div>
            <div className="rounded-lg border border-[#E91E8C]/20 bg-[#E91E8C]/5 p-3">
              <p className="text-xs text-[#E91E8C] font-medium">Documento: SoW — {project?.projectName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cliente: {project?.clientName}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDownloadModal(false)}>Cancelar</Button>
            <Button
              onClick={handleDownloadDocx}
              disabled={downloading}
              className="gap-2 bg-[#E91E8C] hover:bg-[#E91E8C]/90 text-white"
            >
              <Download className="h-4 w-4" />
              Generar y Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StageLayout>
  );
}

/* ========== HELPER: SoW Form Sections ========== */
function SowFormSections({
  form,
  setForm,
  updateArray,
  addToArray,
  removeFromArray,
  disabled,
}: {
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
  updateArray: (field: string, idx: number, value: string) => void;
  addToArray: (field: string) => void;
  removeFromArray: (field: string, idx: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <FormSection title="Introducción">
        <Textarea
          placeholder="Texto introductorio del SoW..."
          value={form.introText ?? ""}
          onChange={(e) => setForm({ ...form, introText: e.target.value })}
          rows={4}
          disabled={disabled}
        />
      </FormSection>

      <FormSection title="Objetivos">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Objetivo General</Label>
            <Textarea
              placeholder="Describir el objetivo general del proyecto..."
              value={form.generalObjective ?? ""}
              onChange={(e) => setForm({ ...form, generalObjective: e.target.value })}
              rows={3}
              disabled={disabled}
            />
          </div>
          <ArrayField
            label="Objetivos Específicos"
            items={form.specificObjectives ?? []}
            onChange={(idx, val) => updateArray("specificObjectives", idx, val)}
            onAdd={() => addToArray("specificObjectives")}
            onRemove={(idx) => removeFromArray("specificObjectives", idx)}
            placeholder="Objetivo específico"
            disabled={disabled}
          />
        </div>
      </FormSection>

      <FormSection title="Alcance">
        <div className="space-y-4">
          <ArrayField label="Actividades Incluidas" items={form.activitiesIncluded ?? []} onChange={(idx, val) => updateArray("activitiesIncluded", idx, val)} onAdd={() => addToArray("activitiesIncluded")} onRemove={(idx) => removeFromArray("activitiesIncluded", idx)} placeholder="Actividad" disabled={disabled} />
          <div className="space-y-2">
            <Label>Entregables</Label>
            {(form.deliverables ?? []).map((d: any, idx: number) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-5" placeholder="Nombre" value={d?.name ?? ""} onChange={(e) => { const arr = [...(form.deliverables ?? [])]; arr[idx] = { ...arr[idx], name: e.target.value }; setForm({ ...form, deliverables: arr }); }} disabled={disabled} />
                <Input className="col-span-6" placeholder="Descripción" value={d?.description ?? ""} onChange={(e) => { const arr = [...(form.deliverables ?? [])]; arr[idx] = { ...arr[idx], description: e.target.value }; setForm({ ...form, deliverables: arr }); }} disabled={disabled} />
                {!disabled && (
                  <Button variant="ghost" size="sm" className="col-span-1 px-1" onClick={() => removeFromArray("deliverables", idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {!disabled && (
              <Button variant="outline" size="sm" onClick={() => setForm({ ...form, deliverables: [...(form.deliverables ?? []), { name: "", description: "" }] })} className="gap-1 text-xs">
                <Plus className="h-3 w-3" /> Agregar Entregable
              </Button>
            )}
          </div>
          <ArrayField label="Limitaciones" items={form.limitations ?? []} onChange={(idx, val) => updateArray("limitations", idx, val)} onAdd={() => addToArray("limitations")} onRemove={(idx) => removeFromArray("limitations", idx)} placeholder="Limitación" disabled={disabled} />
          <ArrayField label="Supuestos" items={form.assumptions ?? []} onChange={(idx, val) => updateArray("assumptions", idx, val)} onAdd={() => addToArray("assumptions")} onRemove={(idx) => removeFromArray("assumptions", idx)} placeholder="Supuesto" disabled={disabled} />
          <ArrayField label="Dependencias del Cliente" items={form.clientDependencies ?? []} onChange={(idx, val) => updateArray("clientDependencies", idx, val)} onAdd={() => addToArray("clientDependencies")} onRemove={(idx) => removeFromArray("clientDependencies", idx)} placeholder="Dependencia" disabled={disabled} />
          <ArrayField label="Riesgos" items={form.risks ?? []} onChange={(idx, val) => updateArray("risks", idx, val)} onAdd={() => addToArray("risks")} onRemove={(idx) => removeFromArray("risks", idx)} placeholder="Riesgo" disabled={disabled} />
          <ArrayField label="Prerrequisitos" items={form.prerequisites ?? []} onChange={(idx, val) => updateArray("prerequisites", idx, val)} onAdd={() => addToArray("prerequisites")} onRemove={(idx) => removeFromArray("prerequisites", idx)} placeholder="Prerrequisito" disabled={disabled} />
        </div>
      </FormSection>

      <FormSection title="Equipo del Proyecto">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Equipo Prodigio Tech</Label>
            {(form.prodigioTeam ?? []).map((t: any, idx: number) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-3" placeholder="Rol" value={t?.role ?? ""} onChange={(e) => { const arr = [...(form.prodigioTeam ?? [])]; arr[idx] = { ...arr[idx], role: e.target.value }; setForm({ ...form, prodigioTeam: arr }); }} disabled={disabled} />
                <Input className="col-span-4" placeholder="Nombre" value={t?.name ?? ""} onChange={(e) => { const arr = [...(form.prodigioTeam ?? [])]; arr[idx] = { ...arr[idx], name: e.target.value }; setForm({ ...form, prodigioTeam: arr }); }} disabled={disabled} />
                <Input className="col-span-4" placeholder="Responsabilidades" value={t?.responsibilities ?? ""} onChange={(e) => { const arr = [...(form.prodigioTeam ?? [])]; arr[idx] = { ...arr[idx], responsibilities: e.target.value }; setForm({ ...form, prodigioTeam: arr }); }} disabled={disabled} />
                {!disabled && (
                  <Button variant="ghost" size="sm" className="col-span-1 px-1" onClick={() => removeFromArray("prodigioTeam", idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {!disabled && (
              <Button variant="outline" size="sm" onClick={() => setForm({ ...form, prodigioTeam: [...(form.prodigioTeam ?? []), { role: "", name: "", responsibilities: "" }] })} className="gap-1 text-xs">
                <Plus className="h-3 w-3" /> Agregar Miembro
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label>Equipo del Cliente</Label>
            {(form.clientTeam ?? []).map((t: any, idx: number) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-3" placeholder="Rol" value={t?.role ?? ""} onChange={(e) => { const arr = [...(form.clientTeam ?? [])]; arr[idx] = { ...arr[idx], role: e.target.value }; setForm({ ...form, clientTeam: arr }); }} disabled={disabled} />
                <Input className="col-span-4" placeholder="Nombre" value={t?.name ?? ""} onChange={(e) => { const arr = [...(form.clientTeam ?? [])]; arr[idx] = { ...arr[idx], name: e.target.value }; setForm({ ...form, clientTeam: arr }); }} disabled={disabled} />
                <Input className="col-span-4" placeholder="Responsabilidades" value={t?.responsibilities ?? ""} onChange={(e) => { const arr = [...(form.clientTeam ?? [])]; arr[idx] = { ...arr[idx], responsibilities: e.target.value }; setForm({ ...form, clientTeam: arr }); }} disabled={disabled} />
                {!disabled && (
                  <Button variant="ghost" size="sm" className="col-span-1 px-1" onClick={() => removeFromArray("clientTeam", idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {!disabled && (
              <Button variant="outline" size="sm" onClick={() => setForm({ ...form, clientTeam: [...(form.clientTeam ?? []), { role: "", name: "", responsibilities: "" }] })} className="gap-1 text-xs">
                <Plus className="h-3 w-3" /> Agregar Miembro
              </Button>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title="Comunicación y Metodología">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Frecuencia de Reuniones</Label>
            <Input
              placeholder="Ej: Semanal, Quincenal"
              value={form.meetingFrequency ?? ""}
              onChange={(e) => setForm({ ...form, meetingFrequency: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Canal de Comunicación</Label>
            <Input
              placeholder="Ej: Slack, Teams, Email"
              value={form.communicationChannel ?? ""}
              onChange={(e) => setForm({ ...form, communicationChannel: e.target.value })}
              disabled={disabled}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Hitos del Proyecto">
        <div className="space-y-2">
          {(form.milestones ?? []).map((m: any, idx: number) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-1 text-xs font-bold text-muted-foreground text-center">#{idx + 1}</div>
              <Input className="col-span-5" placeholder="Descripción del hito" value={m?.description ?? ""} onChange={(e) => { const arr = [...(form.milestones ?? [])]; arr[idx] = { ...arr[idx], description: e.target.value }; setForm({ ...form, milestones: arr }); }} disabled={disabled} />
              <Input className="col-span-5" placeholder="Entregable asociado" value={m?.deliverable ?? ""} onChange={(e) => { const arr = [...(form.milestones ?? [])]; arr[idx] = { ...arr[idx], deliverable: e.target.value }; setForm({ ...form, milestones: arr }); }} disabled={disabled} />
              {!disabled && (
                <Button variant="ghost" size="sm" className="col-span-1 px-1" onClick={() => removeFromArray("milestones", idx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {!disabled && (
            <Button variant="outline" size="sm" onClick={() => setForm({ ...form, milestones: [...(form.milestones ?? []), { number: (form.milestones?.length ?? 0) + 1, description: "", deliverable: "" }] })} className="gap-1 text-xs">
              <Plus className="h-3 w-3" /> Agregar Hito
            </Button>
          )}
        </div>
      </FormSection>

      <FormSection title="Información Financiera">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Monto Total</Label>
            <Input placeholder="0.00" value={form.totalAmount ?? ""} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} disabled={disabled} />
          </div>
          <div className="space-y-1.5">
            <Label>Moneda</Label>
            <Input placeholder="USD" value={form.currency ?? "USD"} onChange={(e) => setForm({ ...form, currency: e.target.value })} disabled={disabled} />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label>Hitos de Facturación</Label>
          {(form.billingMilestones ?? []).map((bm: any, idx: number) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-6" placeholder="Descripción" value={bm?.description ?? ""} onChange={(e) => { const arr = [...(form.billingMilestones ?? [])]; arr[idx] = { ...arr[idx], description: e.target.value }; setForm({ ...form, billingMilestones: arr }); }} disabled={disabled} />
              <Input className="col-span-2" placeholder="%" value={bm?.percentage ?? ""} onChange={(e) => { const arr = [...(form.billingMilestones ?? [])]; arr[idx] = { ...arr[idx], percentage: e.target.value }; setForm({ ...form, billingMilestones: arr }); }} disabled={disabled} />
              <Input className="col-span-3" placeholder="Monto" value={bm?.amount ?? ""} onChange={(e) => { const arr = [...(form.billingMilestones ?? [])]; arr[idx] = { ...arr[idx], amount: e.target.value }; setForm({ ...form, billingMilestones: arr }); }} disabled={disabled} />
              {!disabled && (
                <Button variant="ghost" size="sm" className="col-span-1 px-1" onClick={() => { const arr = [...(form.billingMilestones ?? [])]; arr.splice(idx, 1); setForm({ ...form, billingMilestones: arr }); }}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {!disabled && (
            <Button variant="outline" size="sm" onClick={() => setForm({ ...form, billingMilestones: [...(form.billingMilestones ?? []), { description: "", percentage: "", amount: "" }] })} className="gap-1 text-xs">
              <Plus className="h-3 w-3" /> Agregar Hito de Facturación
            </Button>
          )}
        </div>
      </FormSection>
    </div>
  );
}

/* ========== HELPER: FormSection ========== */
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ========== HELPER: ArrayField ========== */
function ArrayField({
  label,
  items,
  onChange,
  onAdd,
  onRemove,
  placeholder,
  disabled,
}: {
  label: string;
  items: string[];
  onChange: (idx: number, val: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-2">
          <Input
            value={item}
            onChange={(e) => onChange(idx, e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
          />
          {!disabled && (
            <Button variant="ghost" size="sm" onClick={() => onRemove(idx)} className="px-2 shrink-0">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      ))}
      {!disabled && (
        <Button variant="outline" size="sm" onClick={onAdd} className="gap-1 text-xs">
          <Plus className="h-3 w-3" /> Agregar
        </Button>
      )}
    </div>
  );
}
