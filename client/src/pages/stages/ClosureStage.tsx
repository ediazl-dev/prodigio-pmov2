import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import StageClosurePanel from "@/components/StageClosurePanel";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import StageLayout from "@/components/StageLayout";
import StageTimeIndicator from "@/components/StageTimeIndicator";

const CATEGORY_COLORS: Record<string, string> = {
  tecnico: "bg-blue-100 text-blue-700",
  proceso: "bg-violet-100 text-violet-700",
  comunicacion: "bg-emerald-100 text-emerald-700",
  cliente: "bg-amber-100 text-amber-700",
  equipo: "bg-cyan-100 text-cyan-700",
};

export default function ClosureStage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id);
  const [, setLocation] = useLocation();
  const [generating, setGenerating] = useState(false);
  const [lessons, setLessons] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [initialized, setInitialized] = useState(false);

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: existing, refetch } = trpc.closure.get.useQuery({ projectId });
  const { data: stages } = trpc.stages.getAll.useQuery({ projectId });
  const closureStage = stages?.find((s: any) => s.stageId === "closure");

  if (existing && !initialized) {
    setLessons((existing as any[]) ?? []);
    setInitialized(true);
  }

  const generateMutation = trpc.closure.generate.useMutation();
  const saveMutation = trpc.closure.save.useMutation();
  const completeMutation = trpc.closure.complete.useMutation();

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateMutation.mutateAsync({
        projectId,
        context: `${project?.projectName} - ${project?.clientName} - Tipo: ${project?.projectType}`,
      });
      setLessons((result as any).lessons ?? []);
      setMetrics((result as any).metrics ?? {});
      setInitialized(false);
      toast.success("Lecciones aprendidas generadas por la IA");
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ projectId, data: { lessons, metrics } });
      toast.success("Cierre guardado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleComplete = async () => {
    try {
      await saveMutation.mutateAsync({ projectId, data: { lessons, metrics } });
      await completeMutation.mutateAsync({ projectId });
      toast.success("¡Proyecto cerrado exitosamente!");
      setLocation(`/projects/${projectId}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateLesson = (idx: number, field: string, value: string) => {
    const updated = [...lessons];
    updated[idx] = { ...updated[idx], [field]: value };
    setLessons(updated);
  };

  const addLesson = () => {
    setLessons([...lessons, { category: "proceso", what: "", impact: "", recommendation: "" }]);
  };

  const removeLesson = (idx: number) => {
    const updated = [...lessons];
    updated.splice(idx, 1);
    setLessons(updated);
  };

  return (
    <StageLayout
      projectName={project?.projectName ?? "Proyecto"}
      projectId={projectId}
      stageKey="closure"
      subtitle={project?.projectName}
      icon={<CheckCircle2 size={22} />}
    >

      {/* Time Indicator */}
      <StageTimeIndicator projectId={projectId} stageId="closure" />

      {/* AI Generation */}
      <Card className="border-violet-200 bg-violet-50/50">
        <CardContent className="p-4 flex items-center gap-4">
          <Sparkles className="h-5 w-5 text-violet-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Generación Agéntica de Lecciones Aprendidas</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              La IA analizará el historial del proyecto para generar lecciones aprendidas y métricas de desempeño.
            </p>
          </div>
          <Button onClick={handleGenerate} disabled={generating} size="sm" className="shrink-0 gap-2 bg-violet-600 hover:bg-violet-700 text-white">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Analizando..." : "Generar con IA"}
          </Button>
        </CardContent>
      </Card>

      {/* Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Métricas de Desempeño</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: "scopeCompliance", label: "Cumplimiento de Alcance", suffix: "%" },
              { key: "timeCompliance", label: "Cumplimiento de Tiempo", suffix: "%" },
              { key: "budgetCompliance", label: "Cumplimiento de Presupuesto", suffix: "%" },
              { key: "clientSatisfaction", label: "Satisfacción del Cliente", suffix: "/5" },
            ].map((m) => (
              <div key={m.key} className="space-y-1.5">
                <Label className="text-xs">{m.label}</Label>
                <div className="flex items-center gap-1">
                  <Input
                    className="text-sm font-bold"
                    placeholder="0"
                    value={metrics[m.key] ?? ""}
                    onChange={(e) => setMetrics({ ...metrics, [m.key]: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{m.suffix}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lessons Learned */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Lecciones Aprendidas ({lessons.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={addLesson} className="gap-1 text-xs">
            <Plus className="h-3 w-3" /> Agregar
          </Button>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Usa la IA para generar lecciones aprendidas automáticamente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lessons.map((lesson, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                      <Select value={lesson.category} onValueChange={(v) => updateLesson(idx, "category", v)}>
                        <SelectTrigger className="h-6 text-xs w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tecnico">Técnico</SelectItem>
                          <SelectItem value="proceso">Proceso</SelectItem>
                          <SelectItem value="comunicacion">Comunicación</SelectItem>
                          <SelectItem value="cliente">Cliente</SelectItem>
                          <SelectItem value="equipo">Equipo</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[lesson.category] ?? "bg-gray-100 text-gray-700"}`}>
                        {lesson.category}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="px-1.5" onClick={() => removeLesson(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">¿Qué pasó?</p>
                      <Textarea rows={2} className="text-xs" value={lesson.what ?? ""} onChange={(e) => updateLesson(idx, "what", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Impacto</p>
                      <Textarea rows={2} className="text-xs" value={lesson.impact ?? ""} onChange={(e) => updateLesson(idx, "impact", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Recomendación</p>
                      <Textarea rows={2} className="text-xs" value={lesson.recommendation ?? ""} onChange={(e) => updateLesson(idx, "recommendation", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Guardar
        </Button>
      </div>

      {/* Formal Stage Closure */}
      <StageClosurePanel
        projectId={projectId}
        stageId="closure"
        stageName="Cierre de Proyecto"
        stageStatus={closureStage?.status ?? "locked"}
        onClosed={() => setLocation(`/projects/${projectId}`)}
      />
    </StageLayout>
  );
}
