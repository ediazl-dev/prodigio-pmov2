/**
 * Evidencia del servicio, en pestañas. Reemplaza a RecurringService360.tsx.
 *
 * Qué cambia respecto de la versión actual:
 *  - Desaparece la pestaña "Resumen": sus señales subieron a ServiceSignals y
 *    su calidad de datos bajó a la pestaña Evidencias.
 *  - Desaparece la segunda cabecera oscura con cobertura, calidad, reportes e
 *    incidentes. Esas cuatro cifras ya se ven en la Torre de Control; aquí son
 *    trazabilidad, no titular.
 *  - Una dimensión sin evidencia se colapsa con EmptyDimension en vez de pintar
 *    contadores en N/D (la misma regla del rediseño del dashboard).
 *
 * REQUISITO: el kit del dashboard debe estar aplicado (EmptyDimension y
 * recurringDashboardV3ViewModel).
 */

import { useState } from "react";
import { CalendarCheck2, CircleDollarSign, DatabaseZap, FileText } from "lucide-react";
import { formatRecurringMoney, formatRecurringPercent } from "../recurringDashboardV2ViewModel";
import type { DashboardV2Data, MatrixRow } from "../recurringDashboardV3ViewModel";
import { EmptyDimension } from "./EmptyDimension";
import { formatDate, type DocumentRow } from "../serviceDetailViewModel";

type TabKey = "evidencias" | "financiero" | "entregables" | "sla";

interface ServiceEvidenceTabsProps {
  data: DashboardV2Data;
  service: MatrixRow;
  documents: DocumentRow[];
  onRevalidateJsm: () => void;
}

export function ServiceEvidenceTabs({ data, service, documents, onRevalidateJsm }: ServiceEvidenceTabsProps) {
  const [tab, setTab] = useState<TabKey>("evidencias");

  const quality = service.quality;
  const finance = data.financeAnalytics.services[0];
  const deliverables = data.deliverables.rows[0];
  const slaAvailable = service.incidents.availability === "available";

  const tabs: Array<{ key: TabKey; label: string; badge: string; tone: "alert" | "warn" | "calm" }> = [
    {
      key: "evidencias",
      label: "Evidencias",
      badge: String(quality.issues.length),
      tone: quality.issues.length > 0 ? "warn" : "calm",
    },
    {
      key: "financiero",
      label: "Financiero",
      badge: String(service.healthSignals.filter(signal => signal.code.startsWith("OVERDUE_BILLING")).length),
      tone: service.healthSignals.some(signal => signal.code === "OVERDUE_BILLING") ? "alert" : "calm",
    },
    {
      key: "entregables",
      label: "Entregables",
      badge: String(service.reports.overdue),
      tone: service.reports.overdue > 0 ? "alert" : "calm",
    },
    { key: "sla", label: "SLA e incidentes", badge: slaAvailable ? "OK" : "N/D", tone: slaAvailable ? "calm" : "warn" },
  ];

  const BADGE_TONE = {
    alert: "border-[#FDA29B] bg-[#FEF3F2] text-[#B42318]",
    warn: "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]",
    calm: "border-slate-300 bg-slate-100 text-slate-600",
  } as const;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div role="tablist" aria-label="Evidencia del servicio" className="flex items-stretch gap-0.5 border-b border-slate-200 bg-slate-50/70 px-4">
        {tabs.map(item => {
          const selected = item.key === tab;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`svc-tab-${item.key}`}
              aria-selected={selected}
              aria-controls={`svc-panel-${item.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.key)}
              onKeyDown={event => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                event.preventDefault();
                const index = tabs.findIndex(entry => entry.key === tab);
                const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
                setTab(tabs[next].key);
                document.getElementById(`svc-tab-${tabs[next].key}`)?.focus();
              }}
              className={`inline-flex h-[46px] items-center gap-2 border-b-[3px] px-4 text-[12.5px] transition ${
                selected
                  ? "border-[#E91E8C] bg-white font-black text-slate-950"
                  : "border-transparent font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
              <span className={`inline-flex h-[19px] min-w-[22px] items-center justify-center rounded-full border px-1.5 font-mono text-[10px] font-black ${BADGE_TONE[item.tone]}`}>
                {item.badge}
              </span>
            </button>
          );
        })}
        <div className="flex-grow" />
        <span className="self-center pr-1 text-[11px] text-slate-600">Trazabilidad del servicio</span>
      </div>

      <div role="tabpanel" id="svc-panel-evidencias" aria-labelledby="svc-tab-evidencias" hidden={tab !== "evidencias"}>
        {tab === "evidencias" && (
          <div className="grid gap-5 p-5 xl:grid-cols-[430px_1fr]">
            <div>
              <h3 className="text-[13px] font-black text-slate-950">Calidad del dato que sostiene esta ficha</h3>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <Stat
                  label="Cobertura de evidencia"
                  value={`${service.evidenceCoveragePercent}%`}
                  note="dimensiones con dato"
                  tone={service.evidenceCoveragePercent < 100 ? "text-[#B54708]" : "text-slate-950"}
                />
                <Stat
                  label="Calidad de datos"
                  value={`${quality.score}%`}
                  note={`${quality.trustedDimensions} de ${quality.totalDimensions} dimensiones confiables`}
                />
              </div>
              {quality.issues.length > 0 && (
                <div className="mt-3 rounded-xl border border-slate-200 p-3">
                  <p className="text-[11px] font-black text-slate-950">
                    {quality.issues.length} hallazgo{quality.issues.length === 1 ? "" : "s"} de calidad
                  </p>
                  <ul className="mt-2 list-none space-y-2">
                    {quality.issues.map(issue => (
                      <li key={issue.code} className="text-[11.5px] leading-[17px] text-slate-700">
                        <b className="font-mono text-[#B54708]">{issue.dimension}</b> · {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h3 className="text-[13px] font-black text-slate-950">Documentos del contrato ({documents.length})</h3>
              {documents.length === 0 ? (
                <p className="mt-3 text-[12px] text-slate-600">Sin documentos adjuntos.</p>
              ) : (
                <ul className="mt-3 list-none space-y-2">
                  {documents.map(document => (
                    <li key={document.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2">
                      <FileText size={15} className="shrink-0 text-slate-500" />
                      <a
                        href={document.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-grow truncate text-[12px] font-semibold"
                      >
                        {document.fileName}
                      </a>
                      <span className="w-[112px] shrink-0 rounded-full border border-slate-200 bg-slate-100 py-0.5 text-center text-[9.5px] font-bold text-slate-700">
                        {document.typeLabel}
                      </span>
                      <span
                        className={`w-[92px] shrink-0 rounded-full border py-0.5 text-center text-[9.5px] font-bold ${
                          document.required
                            ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
                            : "border-slate-300 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {document.required ? "Exigible" : "No exigible"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-slate-600">
                Formalidad {service.formalization.coveragePercent}%
                {service.formalization.missing.length > 0
                  ? ` · falta ${service.formalization.missing.join(", ")}`
                  : " · contrato y SoW presentes"}
                . La presencia de un documento no equivale a su validación.
              </p>
            </div>
          </div>
        )}
      </div>

      <div role="tabpanel" id="svc-panel-financiero" aria-labelledby="svc-tab-financiero" hidden={tab !== "financiero"}>
        {tab === "financiero" &&
          (finance ? (
            <div className="p-5">
              <h3 className="text-[13px] font-black text-slate-950">Reconciliación con la fuente corporativa</h3>
              <p className="mt-1 text-[11px] text-slate-600">
                La referencia UF se compara solo cuando la moneda contractual también es UF.
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  label="Venta (UF)"
                  value={
                    finance.corporateReference?.valorVentaUF == null
                      ? "N/D"
                      : formatRecurringMoney(finance.corporateReference.valorVentaUF, "UF")
                  }
                />
                <Stat
                  label="Utilizado (UF)"
                  value={
                    finance.corporateReference?.utilizadoUF == null
                      ? "N/D"
                      : formatRecurringMoney(finance.corporateReference.utilizadoUF, "UF")
                  }
                />
                <Stat
                  label="Proyectado (UF)"
                  value={
                    finance.corporateReference?.proyectadoUF == null
                      ? "N/D"
                      : formatRecurringMoney(finance.corporateReference.proyectadoUF, "UF")
                  }
                />
                <Stat label="Línea de negocio" value={finance.corporateReference?.lineaNegocio ?? "N/D"} />
              </div>
              <div className="mt-3 rounded-xl border border-[#B2DDFF] bg-[#EFF6FF] p-3.5">
                <p className="text-[12.5px] font-bold text-[#175CD3]">{finance.reconciliationStatus}</p>
                <p className="mt-1.5 text-[11.5px] leading-[17px] text-slate-700">
                  {finance.verifiedEvidenceByCurrency.reduce((sum, row) => sum + row.items, 0)} evidencia(s)
                  financiera(s) verificada(s). La ausencia de evidencia no cambia automáticamente el estado de la cuota.
                </p>
              </div>
            </div>
          ) : (
            <EmptyDimension
              title="Sin reconciliación disponible"
              reason="Este servicio no aparece en la analítica financiera del corte seleccionado."
              actionLabel="Revisar Deal"
              icon={CircleDollarSign}
              tone="calm"
            />
          ))}
      </div>

      <div role="tabpanel" id="svc-panel-entregables" aria-labelledby="svc-tab-entregables" hidden={tab !== "entregables"}>
        {tab === "entregables" &&
          (!deliverables || deliverables.cells.length === 0 ? (
            <EmptyDimension
              title="Sin reportes mensuales planificados"
              reason="El plan de trabajo de este servicio no tiene hitos de reporte, así que no hay entregas que medir."
              actionLabel="Abrir plan de trabajo"
              icon={CalendarCheck2}
              tone="calm"
            />
          ) : (
            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Período</th>
                    <th className="px-4 py-2.5 font-bold">Vencimiento</th>
                    <th className="px-4 py-2.5 font-bold">Estado</th>
                    <th className="px-4 py-2.5 font-bold">Entrega</th>
                    <th className="px-4 py-2.5 font-bold">Aceptación</th>
                    <th className="px-4 py-2.5 font-bold">Puntualidad</th>
                  </tr>
                </thead>
                <tbody>
                  {deliverables.cells.map((cell, index) => (
                    <tr key={`${cell.period}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 font-bold text-slate-900">{cell.period}</td>
                      <td className="px-4 py-2.5">{formatDate(cell.dueDate)}</td>
                      <td className="px-4 py-2.5">{cell.status}</td>
                      <td className="px-4 py-2.5">{formatDate(cell.deliveredAt)}</td>
                      <td className="px-4 py-2.5">{formatDate(cell.acceptedAt)}</td>
                      <td className="px-4 py-2.5">
                        {cell.deliveryTiming === "on_time" ? "A tiempo" : cell.deliveryTiming === "late" ? "Atrasado" : "N/D"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>

      <div role="tabpanel" id="svc-panel-sla" aria-labelledby="svc-tab-sla" hidden={tab !== "sla"}>
        {tab === "sla" &&
          (!slaAvailable ? (
            <EmptyDimension
              title="Sin medición operacional para este servicio"
              reason={`La evidencia JSM está en estado «${service.incidents.availability}», así que incidentes, antigüedad y SLA quedan en N/D.`}
              actionLabel="Revalidar vínculo JSM"
              onAction={onRevalidateJsm}
              icon={DatabaseZap}
              facts={[
                { label: "Reglas SLA configuradas", value: String(service.sla.configuredRules), note: "una regla no es cumplimiento" },
                { label: "Última medición", value: formatDate(service.incidents.observedAt), note: "sin snapshot vigente" },
                { label: "Incidentes observados", value: "N/D", note: "no se sustituye por 0" },
              ]}
              restores="Los seis contadores de incidentes y las dos barras de SLA vuelven a esta pestaña en cuanto exista un snapshot vigente."
            />
          ) : (
            <div className="p-5">
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Incidentes observados" value={String(service.incidents.total ?? "N/D")} />
                <Stat label="Abiertos" value={String(service.incidents.open ?? "N/D")} />
                <Stat label="Críticos abiertos" value={String(service.incidents.criticalOpen ?? "N/D")} tone="text-[#B42318]" />
                <Stat label="Vencidos abiertos" value={String(service.incidents.overdueOpen ?? "N/D")} tone="text-[#B42318]" />
              </div>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Abiertos +30 días" value={String(service.incidents.unresolvedOver30Days ?? "N/D")} />
                <Stat label="Primera respuesta" value={formatRecurringPercent(service.sla.firstResponseCompliance)} />
                <Stat label="Resolución" value={formatRecurringPercent(service.sla.resolutionCompliance)} />
                <Stat label="Reglas configuradas" value={String(service.sla.configuredRules)} />
              </div>
              <p className="mt-3 text-[11.5px] text-slate-600">
                Última medición: {formatDate(service.incidents.observedAt)}. Una regla SLA configurada no equivale a SLA
                cumplido.
              </p>
            </div>
          ))}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  note,
  tone = "text-slate-950",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-[20px] font-black ${tone}`}>{value}</p>
      {note && <p className="text-[10.5px] text-slate-600">{note}</p>}
    </div>
  );
}
