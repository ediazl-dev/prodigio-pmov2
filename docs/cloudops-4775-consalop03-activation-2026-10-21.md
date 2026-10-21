# Activación CloudOps Consalud — Deal 4775 / PMO-3300001

## Fuente y autorización

El usuario solicitó poblar el JSM existente CONSALOP03 desde el SoW cargado en PMO y autorizó expresamente el 21/10/2026 trasladar los seis originales financieros PSCSC4S-24 a -29, sin copias y conservando IDs, fechas, historia, adjuntos y estados explícitos. No se autorizaron cambios de cuotas, prorratas, moneda, cumplimiento, facturación ni permisos globales.

La base de preparación fue `a20a0796`; preparación guardada en `8699708`, rama `feat/recurring-management-dashboard-v2`, con HEAD/origin/main/user_github/main alineados y árbol limpio antes de la implementación posterior.

## Documento formal leído

SoW canónico: artifact **300001**, versión1, cargado por Aiza Pineda en el servicio3300001. Nombre: **SoW - Servicio CloudOps - Consalud (Renovación) - Deal 4775 - 25_8_26, 19_15 (3).pdf**. SHA-256: `568ec1f605d405e974f6fb54c4570dfbaf001b378778fe84c6afb5350d1369c0`. Se recuperó por almacenamiento privado y se verificó contra el hash persistido. No se modificó ni se validó administrativamente el expediente.

Se trata de Staffing Ingeniero CloudSecOps Senior, remoto, capacidad160h/mes, plazo6meses, tarifa referencialUF160/mes y totalUF960 sin IVA, sujeto a Worklog aprobado y OC. Tecnologías GCP/Terraform/Helm/GKE/ServiceMesh/VPC/VPN/WAF/CloudArmor son competencias del perfil, no entregables de implementación comprometidos.

Obligaciones del SoW: Worklog/horas, reporte mensual dentro de primeros3 días hábiles del siguiente período, revisión/aceptación, NPS mensual, 1-on-1 y burn-rate quincenales, acceso y gobierno del profesional, OC/firma, protocolo de ausencias/escalamiento/reemplazo y cambios formalizados. No hay SLA de incidentes, DR ni cobertura24x7. Tampoco se incorpora información de cobrado: el ciclo operacional financiero termina en facturado.

## Hechos encontrados antes de escribir

- Servicio activo en Ejecución, vínculo creado por PMO con CONSALOP03, project13149/desk434; Space vacío, paginación completa.
- Seis cuotas UF160 con fechas PMO intactas y sin claves Jira locales; totalUF960.
- Seis filas de plan genéricas IDs510001–510006, sin fechas ni vínculos, una por cuota.
- Cero SLA, cero registros de reportes y de evidencia financiera local.
- Seis originales Jira PSCSC4S-24…29, mismos IDs79264…79269, dos con campo explícito Facturado, uno En Proceso y tres vacíos. Los estados locales pendientes no sustituyen esa evidencia.

## Diseño de operación sin datos inventados

La matriz `cloudOps4775Plan.ts` contiene **34 controles**:24mensuales (Worklog, reporte, revisión/habilitación, NPS por cuotaM01–M06),2definiciones de cadenciaquincenal,5controles iniciales y3protocoloscondicionados. Se reutilizan las seis filas genéricas como controles Worklog y se agregan sólo las restantes28. Los protocolos son definiciones por verificar, no incidentes o ausencias ocurridas.

Los nombres M01–M06 indican referencias a cuotas, **no períodos calendario confirmados**. Todas las fechas de controles quedan sin establecer mientras no exista calendario real: inicio27/07/2026 y término PMO27/01/2027 generan julio/enero parciales y el SoW no define su prorrata ni cómo se distribuyen dentro de seis cuotas. No se crea una séptima cuota ni se recalculan importes. Se conserva tanto la fecha PMO de cada cuota como la fecha nativa Jira del original; no se homologan silenciosamente.

La cláusula§2.2 dice «cinco(3) días hábiles», mientras§§5.2/6.2 establecen tres(3). El plan deja explícita la inconsistencia y requiere confirmación; no se decide aprobación tácita ni se inventa recepción del reporte. El registro de firmasPDF acredita el flujo de firmas Prodigio; no prueba OC ni aceptación contractual del Cliente.

## Configuración local de CONSALOP03

- Tipo12981 **Tarea de CloudOps**, descripción nativa.
- Tipo12982 **Hito de Facturación CloudOps**, campo financiero local12128 **Estado de Facturación CloudOps**, descripción y fecha nativas.
- Selección financiera sin valor por defecto ni obligatoriedad: Facturado, En Proceso, No facturado. Vacío permanece vacío/N/D.
- La adaptación de campo local es necesaria porque el campo global11237 es multiselección incompatible con el formulario team-managed. No se modifica su definición global.
- Los tipos del catálogo pueden seguir visibles en el grupo498. Los tickets de operación se crearán sólo por API Jira interna, sin customer request type ni participantes/organizaciones. La audiencia del catálogo no se declara restringida si no se verifica.

## Respaldo y ejecución

Respaldo privado completo: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-cloudops-4775/2026-10-21T20-54-41-655Z`. Incluye snapshotPMO, PDFSoW, seis originales completos, comentarios, historia, adjuntos existentes y hashes. Todos los SHA-256 fueron verificados.

Movimiento: `scripts/moveCloudOps4775.ts`; journal privado independiente. Un POST por original, intent antes del envío, taskId persistido y consulta de progreso; un envío pendiente/incierto nunca se repite. Se conserva cada entrada histórica y contenido original, fechas, responsables, relaciones y adjuntos. Sólo se adapta el nombre/ID del estado operativo a la semántica equivalente del workflow destino; no se genera fecha de resolución.

CanarioM06 verificado: PSCSC4S-29 / ID79269 → **CONSALOP03-1**, con estado financiero vacío conservado. La corrida restante se ejecuta sólo después de ese control.

El corte financiero transaccional cambiará únicamente `jiraIssueKey` de seis cuotas y la configuración de lectura por servicio; no sus importes, fechas, estado local, números de factura ni evidencia. Usará el campo local explícito y fuente únicaCONSALOP03 sin fallback al Space anterior.

## Estado de certificación al registrar esta sección

Preparación:4 pruebas puras aprobadas y build correcto;17 pruebas focales de plan/mapping/corte financiero aprobadas. TypeScript conserva los cinco errores heredados (cuatro jiraMilestoneSync, uno estadoSII en routers); no se declara cero errores. Movimiento total, cortePMO, creación de34 controles y certificaciónfinal permanecen sujetos a sus verificaciones de ejecución.

## Bloque financiero ejecutado y certificado

| Cuota | Original | Destino | ID conservado | Estado financiero explícito |
|---|---|---|---|---|
| M01 | PSCSC4S-24 | CONSALOP03-2 | 79264 | Facturado |
| M02 | PSCSC4S-25 | CONSALOP03-3 | 79265 | Facturado |
| M03 | PSCSC4S-26 | CONSALOP03-4 | 79266 | En Proceso |
| M04 | PSCSC4S-27 | CONSALOP03-5 | 79267 | Vacío / N/D |
| M05 | PSCSC4S-28 | CONSALOP03-6 | 79268 | Vacío / N/D |
| M06 | PSCSC4S-29 | CONSALOP03-1 | 79269 | Vacío / N/D |

Los seis originales fueron trasladados y verificados, no copiados. El cortePMO quedó aplicado y auditado, con cada cuota ligada a su destino y configuración `recurring-jira-billing-field:3300001`. Conservó todos los demás atributos de cuota. El traslado y corte se ejecutaron nuevamente en modo idempotente: no repitieron POST ni escritura financiera.

Lectura final en vivo: sólo CONSALOP03,6items,2facturados,4sin emisión suficientemente acreditada,0duplicados,UF320facturados según campoJira y6/6con monto contractual. En Proceso se conserva como valor original visible, pero no se cuenta como factura; los otros tres vacíos no son deuda ni cero. Se corrigió un defecto de clasificación del lector: un tipo financiero local explícito ahora se reconoce aun cuando el original no tenía etiqueta facturacion; no se modificaron etiquetas/títulos de los originales.

25 pruebas focales aprobadas; build productivo correcto; exactamente cinco erroresTS heredados. El vínculo fue revalidado oficialmente conservando origen creado, sin cambiar contrato o estado. El servicio4687 cerrado mantuvo SHA256 `ccd7c4a0b4d1b01d26430d85dede19cfb7da8dfe8681e553c7666fe549af4f78`,12controles y3cuotas intactas.

El creador operacional superó dry-run de34 tareas y conserva respaldo inicial; aún no se afirma creado el lote hasta completar su corrida y transacción final. Su precondición de nombre financiero se alineó al tipo real; su persistencia usa consulta de ID tras insert para el driverMySQL y verifica el actorPMO administrador real antes de escribir.
