import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SowPreviewProps {
  projectId: number;
  form: Record<string, any>;
  project: { projectName: string; clientName: string } | null | undefined;
  isApproved: boolean;
  onDownload: () => void;
  downloading: boolean;
}

export default function SowPreview({
  projectId,
  onDownload,
  downloading,
}: SowPreviewProps) {
  const { data, isLoading, refetch } = trpc.sow.previewMarkdown.useQuery(
    { projectId },
    { refetchOnWindowFocus: false }
  );

  const markdown = data?.markdown ?? "";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-[#E91E8C]" />
          <h3 className="font-semibold text-lg">Vista Previa del Documento</h3>
          {!isLoading && markdown && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Renderizado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-1.5"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={onDownload}
            disabled={downloading}
            className="gap-1.5 bg-[#E91E8C] hover:bg-[#E91E8C]/90 text-white"
          >
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Descargar Markdown
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2">
        <FileText className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Esta vista previa muestra el SoW en formato <strong>Markdown</strong>, idéntico al archivo descargable.
          Haz clic en <strong>Actualizar</strong> para reflejar los últimos cambios del formulario.
        </p>
      </div>

      {/* Markdown Viewer */}
      <div
        className="relative rounded-lg border border-border bg-white shadow-sm overflow-hidden"
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#E91E8C] mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Generando vista previa...</p>
          </div>
        )}

        {!isLoading && !markdown && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="rounded-full bg-muted p-3 mb-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No hay contenido para previsualizar</p>
            <p className="text-xs text-muted-foreground mt-1">Genera el SoW primero desde el paso anterior</p>
          </div>
        )}

        {!isLoading && markdown && (
          <div className="p-8 prose prose-sm max-w-none
            prose-headings:text-foreground prose-headings:font-bold
            prose-h1:text-2xl prose-h1:border-b prose-h1:border-[#E91E8C]/30 prose-h1:pb-3 prose-h1:mb-4
            prose-h2:text-lg prose-h2:text-[#E91E8C] prose-h2:mt-8 prose-h2:mb-3
            prose-h3:text-base prose-h3:text-foreground prose-h3:mt-5 prose-h3:mb-2
            prose-p:text-foreground prose-p:leading-relaxed
            prose-li:text-foreground prose-li:leading-relaxed
            prose-strong:text-foreground
            prose-table:w-full prose-table:border-collapse
            prose-th:bg-[#E91E8C]/10 prose-th:text-foreground prose-th:font-semibold prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-border
            prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-border prose-td:text-foreground
            prose-hr:border-[#E91E8C]/20 prose-hr:my-6
            prose-ol:list-decimal prose-ul:list-disc
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
