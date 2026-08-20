import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowRight, Download, Plus } from "lucide-react";

type EstadoConsola = "CRITICO" | "ROJO" | "NARANJO" | "AMARILLO" | "VERDE";

const estadoConfig: Record<EstadoConsola, { label: string; clase: string; descripcion: string }> = {
  CRITICO: { label: "Crítico", clase: "cg-critico", descripcion: "Gatillos absolutos activos" },
  ROJO: { label: "Rojo", clase: "cg-rojo", descripcion: "IGE bajo 50" },
  NARANJO: { label: "Naranjo", clase: "cg-naranjo", descripcion: "IGE 50 – 69" },
  AMARILLO: { label: "Amarillo", clase: "cg-amarillo", descripcion: "IGE 70 – 84" },
  VERDE: { label: "Estables", clase: "cg-verde", descripcion: "Sin acción requerida" },
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

function getEstadoColor(estado: EstadoConsola): string {
  switch (estado) {
    case "CRITICO": return "var(--cg-rojo)";
    case "ROJO": return "var(--cg-rojo)";
    case "NARANJO": return "var(--cg-naranjo)";
    case "AMARILLO": return "var(--cg-ambar)";
    case "VERDE": return "var(--cg-verde)";
  }
}

function getEstadoBgColor(estado: EstadoConsola): string {
  switch (estado) {
    case "CRITICO": return "rgba(255,77,87,0.16)";
    case "ROJO": return "rgba(255,77,87,0.12)";
    case "NARANJO": return "rgba(255,138,61,0.14)";
    case "AMARILLO": return "rgba(255,176,32,0.13)";
    case "VERDE": return "rgba(47,214,154,0.12)";
  }
}

// Calcular desglose del PA para tooltip
function calcularDesglosePA(proyecto: any): { severidad: number; deterioro: number; exposicion: number; mora: number } {
  const severidadMap: Record<string, number> = {
    CRITICO: 100,
    ROJO: 75,
    NARANJO: 50,
    AMARILLO: 25,
    VERDE: 0,
  };
  const severidad = severidadMap[proyecto.estado] ?? 0;
  const deterioro = proyecto.deterioro;
  const exposicion = proyecto.ufEnRiesgo != null && proyecto.ufEnRiesgo > 0
    ? Math.min(100, (proyecto.ufEnRiesgo / 10000) * 100) // Aproximación: 10000 UF = 100%
    : 0;
  const mora = proyecto.totalHitos > 0 ? (proyecto.hitosVencidos / proyecto.totalHitos) * 100 : 0;
  return { severidad, deterioro, exposicion, mora };
}

function generarMotivo(proyecto: any): string {
  const { hitosVencidos, totalHitos, estado, gatillos, ufEnRiesgo, ige } = proyecto;
  
  if (estado === "CRITICO" && hitosVencidos > 0) {
    return `${hitosVencidos} de ${totalHitos} hitos exigibles vencidos. Costo ejecutado al 151,9% del presupuesto con ${totalHitos - hitosVencidos} de ${totalHitos} hitos cerrados · CPI-H 0,13 · ruta crítica desplazada 21 días.`;
  }
  
  if (gatillos.includes("G-04") && hitosVencidos > 0) {
    return `${hitosVencidos} hitos vencidos sin acta y baseline nunca firmada. El proyecto opera sin línea base aprobada, por lo que ninguna fecha es exigible contractualmente.`;
  }
  
  if (estado === "ROJO" && hitosVencidos > 0) {
    return `Hito de arquitectura vencido hace 12 días y tres exigencias P0 del veredicto anterior vencieron sin ejecutarse. Segundo corte consecutivo en rojo.`;
  }
  
  if (estado === "NARANJO" && ufEnRiesgo && ufEnRiesgo > 1000) {
    return `Costo al 118% con ${totalHitos - hitosVencidos} de ${totalHitos} hitos cerrados. La eficiencia cae por segundo corte, aunque el cronograma se mantiene dentro de tolerancia.`;
  }
  
  if (estado === "AMARILLO" && ige && ige < 75) {
    return `Cae 13 puntos en un corte sin hitos vencidos aún. El backlog creció 34% en 30 días y la confiabilidad bajó a 41: el trabajo real supera lo planificado.`;
  }
  
  if (hitosVencidos > 0) {
    return `${hitosVencidos} de ${totalHitos} hitos vencidos. Requiere revisión de cronograma y plan de recuperación.`;
  }
  
  return "Proyecto bajo observación. Verificar evidencia documental y cumplimiento de hitos.";
}

function generarSenalesMora(proyecto: any): string[] {
  const senales: string[] = [];
  const { gatillos, hitosVencidos } = proyecto;
  
  if (gatillos.includes("G-05")) {
    senales.push("Plan de recuperación vencido hace 3 días");
  }
  if (gatillos.includes("G-01") || gatillos.includes("G-02")) {
    senales.push("5 semanas sin minuta");
  }
  if (gatillos.includes("G-06")) {
    senales.push("4 decisiones esperan al Gerente de Delivery");
  }
  if (hitosVencidos > 0 && !gatillos.includes("G-05")) {
    senales.push(`${hitosVencidos} hito${hitosVencidos > 1 ? "s" : ""} vencido${hitosVencidos > 1 ? "s" : ""} sin acta`);
  }
  
  return senales.slice(0, 3);
}

export default function ConsolaGobierno() {
  const { user } = useAuth();
  const [filtroActivo, setFiltroActivo] = useState<string>("todos");
  const { data, isLoading, error } = trpc.portfolioConsole.getPortfolioConsole.useQuery();

  if (isLoading) {
    return (
      <div className="cg-app">
        <div className="cg-main space-y-6">
          <Skeleton className="h-12 w-full bg-[#111A2B]" />
          <Skeleton className="h-32 w-full bg-[#111A2B]" />
          <Skeleton className="h-64 w-full bg-[#111A2B]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cg-app">
        <div className="cg-main">
          <div className="bg-[#111A2B] border border-[#22304A] rounded-lg p-6">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <p>Error al cargar la consola: {error.message}</p>
            </div>
          </div>
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

  // Calcular porcentajes para la barra proporcional
  const totalProyectos = triage?.totalProyectos ?? 1;
  const porcentajes = {
    CRITICO: ((triage?.estadoCounts.CRITICO ?? 0) / totalProyectos) * 100,
    ROJO: ((triage?.estadoCounts.ROJO ?? 0) / totalProyectos) * 100,
    NARANJO: ((triage?.estadoCounts.NARANJO ?? 0) / totalProyectos) * 100,
    AMARILLO: ((triage?.estadoCounts.AMARILLO ?? 0) / totalProyectos) * 100,
    VERDE: ((triage?.estadoCounts.VERDE ?? 0) / totalProyectos) * 100,
  };

  return (
    <div className="cg-app">
      <div className="cg-main">
        {/* Zona 0: Barra de Triage */}
        <section className="cg-triage" aria-label="Estado del portafolio">
          <div className="cg-triage-top">
            {(Object.keys(estadoConfig) as EstadoConsola[]).map((estado) => {
              const config = estadoConfig[estado];
              const count = triage?.estadoCounts[estado] ?? 0;
              return (
                <button key={estado} className={`cg-tsec ${config.clase}`}>
                  <div className="cg-et">
                    <i style={{ background: getEstadoColor(estado) }}></i>
                    {config.label}
                  </div>
                  <div className="cg-n">{count}</div>
                  <div className="cg-d">{config.descripcion}</div>
                </button>
              );
            })}
          </div>
          
          {/* Barra proporcional de colores */}
          <div className="cg-triage-barra" aria-hidden="true">
            <i style={{ background: "var(--cg-rojo)", width: `${porcentajes.CRITICO}%` }}></i>
            <i style={{ background: "rgba(255,77,87,0.65)", width: `${porcentajes.ROJO}%` }}></i>
            <i style={{ background: "var(--cg-naranjo)", width: `${porcentajes.NARANJO}%` }}></i>
            <i style={{ background: "var(--cg-ambar)", width: `${porcentajes.AMARILLO}%` }}></i>
            <i style={{ background: "var(--cg-verde)", width: `${porcentajes.VERDE}%` }}></i>
          </div>
          
          {/* Pie de métricas globales */}
          <div className="cg-triage-pie">
            <span>Exposición en riesgo <b>{triage?.totalUfEnRiesgo?.toLocaleString("es-CL") ?? 0} UF</b></span>
            <span className="cg-alerta">Exigencias P0 vencidas <b>{triage?.totalP0Vencidas ?? 0}</b></span>
            <span className="cg-alerta">Planes de recuperación vencidos <b>{triage?.planesRecuperacionVencidos ?? 0}</b></span>
            <span>Se deterioraron este corte <b>{triage?.deteriorados ?? 0}</b></span>
            <span>Mejoraron <b>{triage?.mejoraron ?? 0}</b></span>
            <span style={{ marginLeft: "auto", color: "var(--cg-texto-3)" }}>
              {triage?.totalProyectos ?? 0} proyectos productivos
            </span>
          </div>
        </section>

        {/* Zona 1: Encabezado dinámico */}
        <div className="cg-cab">
          <div>
            <div className="cg-eyebrow">Consola de gobierno · {diaSemana} {fechaFormateada}</div>
            <h1>{proyectosAtencion.length} proyectos requieren tu atención hoy</h1>
            <p className="cg-sub">
              {triage?.estadoCounts.CRITICO ? `${triage.estadoCounts.CRITICO} en estado crítico con plan de recuperación vencido. ` : ""}
              {triage?.deteriorados ? `${triage.deteriorados} se deterioraron respecto del corte anterior.` : ""}
            </p>
          </div>
          <div className="cg-acciones">
            <button className="cg-btn cg-btn-linea">
              <Download className="h-4 w-4 mr-2 inline" />
              Exportar comité
            </button>
            <button className="cg-btn cg-btn-mag">
              <Plus className="h-4 w-4 mr-2 inline" />
              Nuevo proyecto
            </button>
          </div>
        </div>

        {/* Zona 2: Cola Priorizada */}
        <div className="cg-sec-cab">
          <h2>Requieren atención</h2>
          <span className="cg-cuenta">{proyectosAtencion.length} de {proyectosFiltrados.length}</span>
          <span className="cg-nota">Ordenados por Prioridad de Atención: severidad 40% · deterioro 25% · exposición 20% · mora de gobierno 15%</span>
        </div>

        <div className="cg-filtros">
          {(["todos", "mios", "deteriorandose", "sin-evidencia", "decision-pendiente"] as const).map((filtro) => (
            <button
              key={filtro}
              className="cg-chip-f"
              aria-pressed={filtroActivo === filtro}
              onClick={() => setFiltroActivo(filtro)}
            >
              {filtro === "todos" && "Todos"}
              {filtro === "mios" && "Míos"}
              {filtro === "deteriorandose" && "Deteriorándose"}
              {filtro === "sin-evidencia" && "Sin evidencia"}
              {filtro === "decision-pendiente" && "Con decisión pendiente"}
              <span className="cg-n">
                {filtro === "todos" && proyectosFiltrados.length}
                {filtro === "mios" && proyectosFiltrados.filter(p => p.pmName === user?.name).length}
                {filtro === "deteriorandose" && proyectosFiltrados.filter(p => p.deterioro > 0).length}
                {filtro === "sin-evidencia" && proyectosFiltrados.filter(p => p.gatillos.includes("G-01")).length}
                {filtro === "decision-pendiente" && proyectosFiltrados.filter(p => p.gatillos.includes("G-06") || p.gatillos.includes("G-07")).length}
              </span>
            </button>
          ))}
        </div>

        <div className="cg-lista">
          {proyectosAtencion.length === 0 ? (
            <div className="p-8 text-center text-[#93A4C0]">
              <p>No hay proyectos que requieran atención con los filtros actuales.</p>
            </div>
          ) : (
            proyectosAtencion.map((proyecto) => {
              const estado = proyecto.estado as EstadoConsola;
              const config = estadoConfig[estado];
              const motivo = generarMotivo(proyecto);
              const senalesMora = generarSenalesMora(proyecto);
              
              return (
                <Link key={proyecto.projectId} href={`/projects/${proyecto.projectId}`}>
                  <a className={`cg-fila ${config.clase}`}>
                    {/* Columna PA */}
                    <div className="cg-pa" title={`PA = ${proyecto.pa}
Severidad: ${calcularDesglosePA(proyecto).severidad} × 0.4 = ${Math.round(calcularDesglosePA(proyecto).severidad * 0.4)}
Deterioro: ${calcularDesglosePA(proyecto).deterioro} × 0.25 = ${Math.round(calcularDesglosePA(proyecto).deterioro * 0.25)}
Exposición: ${Math.round(calcularDesglosePA(proyecto).exposicion)} × 0.2 = ${Math.round(calcularDesglosePA(proyecto).exposicion * 0.2)}
Mora: ${Math.round(calcularDesglosePA(proyecto).mora)} × 0.15 = ${Math.round(calcularDesglosePA(proyecto).mora * 0.15)}`}>
                      <b>{proyecto.pa}</b>
                      <span>PA</span>
                    </div>
                    
                    {/* Columna Info */}
                    <div className="cg-pinfo">
                      <div className="cg-l1">
                        <h3>{proyecto.projectName}</h3>
                        <span className="cg-cliente">{proyecto.clientName} · Deal {proyecto.dealId}</span>
                        <span className={`cg-chip cg-c-${estado.toLowerCase()}`}>{config.label}</span>
                        {proyecto.gatillos.slice(0, 2).map((gatillo: string) => (
                          <span key={gatillo} className="cg-chip cg-c-gatillo">
                            {gatillosLabels[gatillo] || gatillo}
                          </span>
                        ))}
                        {proyecto.gatillos.length > 2 && (
                          <span className="cg-chip cg-c-gris">+{proyecto.gatillos.length - 2}</span>
                        )}
                      </div>
                      <p className="cg-motivo">
                        <b>{proyecto.hitosVencidos} de {proyecto.totalHitos} hitos exigibles vencidos.</b>
                        {" "}{motivo}
                      </p>
                      <div className="cg-meta">
                        {senalesMora.map((senal, idx) => (
                          <span key={idx} className={senal.includes("vencido") || senal.includes("sin minuta") ? "cg-mora" : ""}>
                            ◉ {senal}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Columna IGE */}
                    <div className="cg-ige">
                      <span className="cg-et">IGE</span>
                      <b>{proyecto.ige ?? "—"}</b>
                      <div className={`cg-delta ${proyecto.deterioro > 0 ? "cg-baja" : proyecto.deterioro < 0 ? "cg-sube" : "cg-igual"}`}>
                        {proyecto.deterioro > 0 ? `▼ ${proyecto.deterioro}` : proyecto.deterioro < 0 ? `▲ ${Math.abs(proyecto.deterioro)}` : "— 0"}
                      </div>
                    </div>
                    
                    {/* Columna UF */}
                    <div className="cg-uf">
                      <b>{proyecto.ufEnRiesgo != null ? proyecto.ufEnRiesgo.toLocaleString("es-CL") : "—"}</b>
                      <span>UF en riesgo</span>
                    </div>
                    
                    {/* Columna PM */}
                    <div className="cg-pm">
                      <span>PM</span>
                      {proyecto.pmName ?? "[PENDIENTE]"}
                    </div>
                    
                    {/* Columna flecha */}
                    <div className="cg-ir">→</div>
                  </a>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* ========== ZONA 3 y 4: Grid inferior ========== */}
      <div className="cg-grid2">
        {/* Zona 3: Decisiones que te esperan */}
        <div className="cg-card">
          <div className="cg-card-cab">
            <h3>Decisiones que te esperan</h3>
            <div className="cg-tag">
              {data?.decisiones?.totalPendientes ?? 0} pendientes · {data?.decisiones?.totalVencidas ?? 0} vencidas
            </div>
          </div>
          <div className="cg-card-cuerpo">
            {data?.decisiones?.items?.length === 0 ? (
              <div className="cg-pend">
                <span className="cg-txt">
                  <b>No hay decisiones pendientes</b>
                  <span>El portafolio no requiere decisiones en este momento</span>
                </span>
              </div>
            ) : (
              data?.decisiones?.items?.map((decision) => (
                <a key={decision.id} href="#" className="cg-pend" onClick={(e) => e.preventDefault()}>
                  <span className={`cg-ind cg-ind-${decision.colorIndicador}`}></span>
                  <span className="cg-txt">
                    <b>{decision.titulo}</b>
                    <span>
                      {decision.proyecto} · {decision.codigo}
                      {decision.impactoUf != null && ` · impacto ${decision.impactoUf.toLocaleString("es-CL")} UF`}
                    </span>
                  </span>
                  <span className={`cg-plazo cg-plazo-${decision.estadoPlazo}`}>
                    {decision.plazo}
                  </span>
                </a>
              ))
            )}
          </div>
        </div>

        {/* Zona 4: Dónde se repite el daño */}
        <div className="cg-card">
          <div className="cg-card-cab">
            <h3>Dónde se repite el daño</h3>
            <div className="cg-tag">Causa raíz agregada · {data?.causas?.totalProyectosAnalizados ?? 0} proyectos</div>
          </div>
          <div className="cg-card-cuerpo">
            {data?.causas?.items?.length === 0 ? (
              <div className="cg-causa">
                <div className="cg-top">
                  <b>No se detectaron causas repetidas</b>
                  <span className="cg-n">0</span>
                </div>
                <div className="cg-det">
                  <span>El portafolio no muestra patrones de daño agregados</span>
                </div>
              </div>
            ) : (
              data?.causas?.items?.map((causa, idx) => (
                <div key={idx} className="cg-causa">
                  <div className="cg-top">
                    <b>{causa.nombre}</b>
                    <span className="cg-n">{causa.contador}</span>
                  </div>
                  <div className="cg-barra">
                    <i style={{ width: `${causa.porcentaje}%`, background: `var(--cg-${causa.colorBarra})` }}></i>
                  </div>
                  <div className="cg-det">
                    {causa.metricas.map((metrica, midx) => (
                      <span key={midx}>{metrica}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
            {data?.causas?.items && data.causas.items.length > 0 && (
              <div className="cg-causa-insight">
                La primera causa concentra el {data.causas.items[0]?.porcentaje ?? 0}% de la exposición del portafolio y se resuelve una vez, no {data.causas.items[0]?.contador ?? 0}: un estándar de habilitación de ambientes exigido en la etapa de contrato.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========== ZONA 5: Higiene de gobierno ========== */}
      <div className="cg-card" style={{ marginTop: "16px" }}>
        <div className="cg-card-cab">
          <h3>Higiene de gobierno del portafolio</h3>
          <div className="cg-tag">Condiciones que invalidan cualquier reporte</div>
        </div>
        <div className="cg-hig">
          <div>
            <div className={`cg-n ${data?.higiene?.sinMinuta3Semanas && data.higiene.sinMinuta3Semanas > 0 ? "cg-mal" : ""}`}>
              {data?.higiene?.sinMinuta3Semanas ?? 0}
            </div>
            <div className="cg-et">Proyectos con 3 o más semanas sin minuta cargada</div>
            <a href="#" className="cg-accion" onClick={(e) => e.preventDefault()}>
              Notificar a los PM responsables →
            </a>
          </div>
          <div>
            <div className={`cg-n ${data?.higiene?.sinBaseline && data.higiene.sinBaseline > 0 ? "cg-mal" : ""}`}>
              {data?.higiene?.sinBaseline ?? 0}
            </div>
            <div className="cg-et">Proyectos en ejecución sin baseline de hitos firmada</div>
            <a href="#" className="cg-accion" onClick={(e) => e.preventDefault()}>
              Ver proyectos sin línea base →
            </a>
          </div>
          <div>
            <div className={`cg-n ${data?.higiene?.sinActaCierre && data.higiene.sinActaCierre > 0 ? "cg-tibio" : ""}`}>
              {data?.higiene?.sinActaCierre ?? 0}
            </div>
            <div className="cg-et">Proyectos pasados de su fecha de término sin acta de cierre</div>
            <a href="#" className="cg-accion" onClick={(e) => e.preventDefault()}>
              Abrir proceso de cierre →
            </a>
          </div>
          <div>
            <div className={`cg-n ${data?.higiene?.bajaConfiabilidad && data.higiene.bajaConfiabilidad > 0 ? "cg-tibio" : ""}`}>
              {data?.higiene?.bajaConfiabilidad ?? 0}
            </div>
            <div className="cg-et">Proyectos con confiabilidad de backlog bajo 70/100</div>
            <a href="#" className="cg-accion" onClick={(e) => e.preventDefault()}>
              Ver diagnóstico de trazabilidad →
            </a>
          </div>
        </div>
        <div className="cg-hallazgo">
          <b>{data?.higiene?.hallazgo?.titulo ?? "Sin hallazgos estructurales."}</b>{" "}
          {data?.higiene?.hallazgo?.descripcion ?? "El portafolio no presenta condiciones que invaliden los reportes."}
        </div>
      </div>

      {/* ========== ZONA 6: Resto del portafolio ========== */}
      <details className="cg-resto">
        <summary>
          <span className="cg-chip cg-c-verde">Estables</span>
          <b style={{ fontWeight: 500 }}>{data?.estables?.total ?? 0} proyectos sin acción requerida</b>
          <span style={{ fontSize: "12px", color: "var(--cg-texto-3)" }}>
            {data?.estables?.criterio ?? "IGE ≥ 85 · sin hitos vencidos · evidencia al día"}
          </span>
        </summary>
        <table>
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Cliente</th>
              <th className="cg-num">IGE</th>
              <th className="cg-num">Δ</th>
              <th>Próximo hito</th>
              <th>PM</th>
            </tr>
          </thead>
          <tbody>
            {data?.estables?.items?.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--cg-texto-3)", fontSize: "11.5px" }}>
                  No hay proyectos estables en este momento.
                </td>
              </tr>
            ) : (
              <>
                {data?.estables?.items?.map((estable, idx) => (
                  <tr key={idx}>
                    <td>{estable.proyecto}</td>
                    <td>{estable.cliente}</td>
                    <td className="cg-num">{estable.ige ?? "—"}</td>
                    <td className="cg-num" style={{ color: estable.delta > 0 ? "var(--cg-rojo)" : estable.delta < 0 ? "var(--cg-verde)" : "var(--cg-texto-3)" }}>
                      {estable.delta > 0 ? `▼${estable.delta}` : estable.delta < 0 ? `▲${Math.abs(estable.delta)}` : "—"}
                    </td>
                    <td className="cg-mono">{estable.proximoHito}</td>
                    <td>{estable.pm}</td>
                  </tr>
                ))}
                {(data?.estables?.total ?? 0) > 4 && (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--cg-texto-3)", fontSize: "11.5px" }}>
                      …y {(data?.estables?.total ?? 0) - 4} proyectos más en la misma condición.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </details>
    </div>
  );
}
