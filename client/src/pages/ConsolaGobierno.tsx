import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowRight, Download, Plus, Filter } from "lucide-react";

type EstadoConsola = "CRITICO" | "ROJO" | "NARANJO" | "AMARILLO" | "VERDE";

const estadoConfig: Record<EstadoConsola, { label: string; color: string; bgColor: string; borderColor: string }> = {
  CRITICO: { label: "Crítico", color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500" },
  ROJO: { label: "Rojo", color: "text-red-400", bgColor: "bg-red-400/10", borderColor: "border-red-400" },
  NARANJO: { label: "Naranjo", color: "text-orange-500", bgColor: "bg-orange-500/10", borderColor: "border-orange-500" },
  AMARILLO: { label: "Amarillo", color: "text-yellow-500", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500" },
  VERDE: { label: "Verde", color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500" },
};

const gatillosLabels: Record<string, string> = {
  "G-01": "Sin minutas",
  "G-02": "Minutas gap",
  "G-03": "Compromisos vencidos",
  "G-04": "Sin PRD",
  "G-05": "PRD vencido",
  "G-06": "P0 vencidas",
  "G-07": "Veredictos rojos",
};

export default function ConsolaGobierno() {
  const { user } = useAuth();
  const [filtroActivo, setFiltroActivo] = useState<string>("todos");
  const { data, isLoading, error } = trpc.portfolioConsole.getPortfolioConsole.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-[#E8EDF5] p-6">
        <div className="max-w-[1500px] mx-auto space-y-6">
          <Skeleton className="h-12 w-full bg-[#111A2B]" />
          <Skeleton className="h-32 w-full bg-[#111A2B]" />
          <Skeleton className="h-64 w-full bg-[#111A2B]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-[#E8EDF5] p-6">
        <div className="max-w-[1500px] mx-auto">
          <Card className="bg-[#111A2B] border-[#22304A]">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="h-5 w-5" />
                <p>Error al cargar la consola: {error.message}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { projects, triage, cutoffDate } = data || { projects: [], triage: null, cutoffDate: "" };

  // Filtrar proyectos según el filtro activo
  const proyectosFiltrados = projects.filter((p) => {
    if (filtroActivo === "todos") return true;
    if (filtroActivo === "mios") return p.pmName === user?.name;
    if (filtroActivo === "deteriorandose") return p.deterioro > 0;
    if (filtroActivo === "sin-evidencia") return p.gatillos.includes("G-01");
    if (filtroActivo === "decision-pendiente") return p.gatillos.includes("G-06") || p.gatillos.includes("G-07");
    return true;
  });

  const proyectosAtencion = proyectosFiltrados.filter((p) => p.requiereAtencion);
  const fechaCorte = new Date(cutoffDate + "T00:00:00Z");
  const diaSemana = fechaCorte.toLocaleDateString("es-CL", { weekday: "long" });
  const fechaFormateada = fechaCorte.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#0B1120] text-[#E8EDF5]">
      <div className="max-w-[1500px] mx-auto p-6 space-y-6">
        {/* Zona 0: Barra de Triage */}
        <div className="bg-[#111A2B] border border-[#22304A] rounded-lg p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(estadoConfig) as EstadoConsola[]).map((estado) => {
              const config = estadoConfig[estado];
              const count = triage?.estadoCounts[estado] ?? 0;
              const porcentaje = triage?.totalProyectos ? (count / triage.totalProyectos) * 100 : 0;
              return (
                <button
                  key={estado}
                  className={`px-4 py-2 rounded-md border ${config.borderColor} ${config.bgColor} ${config.color} font-medium transition-all hover:opacity-80`}
                  style={{ flexGrow: porcentaje > 0 ? porcentaje : 1 }}
                >
                  {config.label} ({count})
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
            <div>
              <span className="text-[#93A4C0]">Exposición UF en riesgo:</span>
              <span className="ml-2 font-mono text-[#E8EDF5]">{triage?.totalUfEnRiesgo?.toLocaleString("es-CL") ?? 0} UF</span>
            </div>
            <div>
              <span className="text-[#93A4C0]">P0 vencidas:</span>
              <span className="ml-2 font-mono text-[#E8EDF5]">{triage?.totalP0Vencidas ?? 0}</span>
            </div>
            <div>
              <span className="text-[#93A4C0]">PRD vencidos:</span>
              <span className="ml-2 font-mono text-[#E8EDF5]">{triage?.planesRecuperacionVencidos ?? 0}</span>
            </div>
            <div>
              <span className="text-[#93A4C0]">Deteriorados:</span>
              <span className="ml-2 font-mono text-[#E8EDF5]">{triage?.deteriorados ?? 0}</span>
            </div>
            <div>
              <span className="text-[#93A4C0]">Mejoraron:</span>
              <span className="ml-2 font-mono text-[#E8EDF5]">{triage?.mejoraron ?? 0}</span>
            </div>
            <div>
              <span className="text-[#93A4C0]">Total proyectos:</span>
              <span className="ml-2 font-mono text-[#E8EDF5]">{triage?.totalProyectos ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Zona 1: Encabezado dinámico */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[#93A4C0] text-sm uppercase tracking-wide">
              Consola de gobierno · {diaSemana} {fechaFormateada}
            </p>
            <h1 className="text-3xl font-bold mt-1">
              {proyectosAtencion.length} proyectos requieren tu atención hoy
            </h1>
            <p className="text-[#93A4C0] mt-2">
              {triage?.estadoCounts.CRITICO ? `${triage.estadoCounts.CRITICO} en estado crítico. ` : ""}
              {triage?.estadoCounts.ROJO ? `${triage.estadoCounts.ROJO} en estado rojo. ` : ""}
              {triage?.totalUfEnRiesgo ? `Exposición total: ${triage.totalUfEnRiesgo.toLocaleString("es-CL")} UF.` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-[#22304A] text-[#E8EDF5] hover:bg-[#16213A]">
              <Download className="h-4 w-4 mr-2" />
              Exportar comité
            </Button>
            <Button className="bg-[#E71F71] hover:bg-[#E71F71]/90 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo proyecto
            </Button>
          </div>
        </div>

        {/* Zona 2: Cola Priorizada */}
        <Card className="bg-[#111A2B] border-[#22304A]">
          <CardHeader className="border-b border-[#22304A]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Requieren atención</CardTitle>
                <p className="text-[#93A4C0] text-sm mt-1">
                  {proyectosAtencion.length} de {proyectosFiltrados.length} proyectos
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["todos", "mios", "deteriorandose", "sin-evidencia", "decision-pendiente"].map((filtro) => (
                  <button
                    key={filtro}
                    onClick={() => setFiltroActivo(filtro)}
                    className={`px-3 py-1 rounded-md text-sm transition-all ${
                      filtroActivo === filtro
                        ? "bg-[#E71F71] text-white"
                        : "bg-[#16213A] text-[#93A4C0] hover:bg-[#1B2942]"
                    }`}
                  >
                    {filtro === "todos" && "Todos"}
                    {filtro === "mios" && "Míos"}
                    {filtro === "deteriorandose" && "Deteriorándose"}
                    {filtro === "sin-evidencia" && "Sin evidencia"}
                    {filtro === "decision-pendiente" && "Decisión pendiente"}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[#5D6E8C] text-xs mt-2">
              PA = (severidad × 0.4) + (deterioro × 0.25) + (exposición × 0.2) + (mora × 0.15)
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {proyectosAtencion.length === 0 ? (
              <div className="p-8 text-center text-[#93A4C0]">
                <p>No hay proyectos que requieran atención con los filtros actuales.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1A2438]">
                {proyectosAtencion.map((proyecto) => {
                  const config = estadoConfig[proyecto.estado as EstadoConsola];
                  return (
                    <Link key={proyecto.projectId} href={`/projects/${proyecto.projectId}`}>
                      <a className={`block p-4 hover:bg-[#16213A] transition-all border-l-4 ${config.borderColor}`}>
                        <div className="grid grid-cols-[58px_1fr_96px_104px_132px_40px] gap-4 items-center">
                          {/* Columna PA */}
                          <div className="text-center">
                            <div className={`text-2xl font-bold ${config.color}`}>{proyecto.pa}</div>
                            <div className="text-xs text-[#5D6E8C]">PA</div>
                          </div>

                          {/* Columna Info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-[#E8EDF5] truncate">{proyecto.projectName}</h3>
                              <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
                                {config.label}
                              </Badge>
                              {proyecto.gatillos.slice(0, 2).map((gatillo) => (
                                <Badge key={gatillo} variant="outline" className="bg-[#16213A] text-[#93A4C0] border-0 text-xs">
                                  {gatillosLabels[gatillo] || gatillo}
                                </Badge>
                              ))}
                              {proyecto.gatillos.length > 2 && (
                                <Badge variant="outline" className="bg-[#16213A] text-[#93A4C0] border-0 text-xs">
                                  +{proyecto.gatillos.length - 2}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[#93A4C0] text-sm mt-1 truncate">
                              {proyecto.clientName} · {proyecto.dealId}
                            </p>
                            <p className="text-[#5D6E8C] text-xs mt-1">
                              {proyecto.hitosVencidos} de {proyecto.totalHitos} hitos vencidos
                            </p>
                          </div>

                          {/* Columna IGE */}
                          <div className="text-center">
                            <div className="text-lg font-mono text-[#E8EDF5]">{proyecto.ige ?? "—"}</div>
                            <div className="text-xs text-[#5D6E8C]">IGE</div>
                          </div>

                          {/* Columna UF */}
                          <div className="text-center">
                            <div className="text-lg font-mono text-[#E8EDF5]">
                              {proyecto.ufEnRiesgo != null ? proyecto.ufEnRiesgo.toLocaleString("es-CL") : "—"}
                            </div>
                            <div className="text-xs text-[#5D6E8C]">UF riesgo</div>
                          </div>

                          {/* Columna PM */}
                          <div className="text-center">
                            <div className="text-sm text-[#E8EDF5] truncate">{proyecto.pmName ?? "[PENDIENTE]"}</div>
                            <div className="text-xs text-[#5D6E8C]">PM</div>
                          </div>

                          {/* Columna flecha */}
                          <div className="text-center">
                            <ArrowRight className="h-5 w-5 text-[#5D6E8C] mx-auto" />
                          </div>
                        </div>
                      </a>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
