# Activación de CloudOps Consalud — Deal 4775 / CONSALOP03

**Fecha:** 21 de octubre de 2026. **PMO:** 3300001. **Estado del trabajo solicitado:** CONSALOP03 poblado con operación y facturación, vinculado al servicio PMO y verificado.

## Resultado

CONSALOP03 tiene **40 registros únicos**: 34 tareas y controles trazables al SoW cargado, y seis hitos financieros originales trasladados desde PSCSC4S. No se crearon copias de los hitos ni se cambiaron importes, fechas originales o estados financieros.

PMO muestra **Actividades (34)** y **Facturación (6)**. La compuerta JSM tiene 34/34 elementos aplicables vinculados, cero pendientes y ninguna barrera de configuración. El vínculo se revalidó después de guardar los mappings y terminó sin advertencias.

## Fuente contractual

Se utilizó exclusivamente el PDF cargado **“SoW - Servicio CloudOps - Consalud (Renovación) - Deal 4775 - 25_8_26, 19_15 (3).pdf”**, artefacto canónico 300001, SHA-256 `568ec1f605d405e974f6fb54c4570dfbaf001b378778fe84c6afb5350d1369c0`.

La matriz `cloudops-4775-sow-v1-20261021` identifica cláusulas y páginas en cada descripción Jira. El servicio es aumento de capacidad mediante un Ingeniero CloudSecOps Senior, con capacidad acordada de 160 horas mensuales. Esas horas no se presentan como consumo real acreditado.

## Operación creada

| Grupo | Cantidad | Contenido |
|---|---:|---|
| Controles mensuales | 24 | Worklog/capacidad, reporte mensual, revisión/habilitación de factura y NPS para cada una de las seis cuotas |
| Definiciones de seguimiento quincenal | 2 | 1-on-1/desempeño y burn-rate/asignación; no son doce reuniones históricas inventadas |
| Controles de inicio y gobierno | 5 | OC/aceptación contractual, accesos, contrapartes/Focal Point, calendario/prorrata y perfil CloudSecOps |
| Protocolos condicionados | 3 | Ausencias/sustitución, escalamiento/reemplazo y cambios/extras/gastos autorizados |
| **Total** | **34** | **CONSALOP03-7 a CONSALOP03-40** |

Las 24 tareas mensuales se relacionan mediante enlaces Jira `Relates` con su respectivo hito financiero. Los dos controles de cadencia se relacionan con los seis hitos. Son relaciones de trazabilidad, no evidencia de factura o entrega.

En PMO se conservaron los IDs de las seis filas existentes 510001–510006 y se agregaron 28 filas. Las 34 quedaron vinculadas a sus issues Jira, pendientes, sin fechas de cumplimiento, recepción o aceptación inventadas y sin asignar cuentas humanas por inferencia.

Los issues se crearon por la API Jira como trabajo interno: sin Customer Request Type, participantes, organizaciones ni assignee. Esto no equivale a certificar la audiencia del catálogo de tipos del portal, que no se modificó ni se declara restringido. No se añadieron obligaciones SLA de incidentes, DR o 24x7.

## Hitos financieros originales

| Cuota | Clave anterior | Clave actual | ID conservado | Valor financiero explícito |
|---|---|---|---|---|
| M01 | PSCSC4S-24 | CONSALOP03-2 | 79264 | Facturado |
| M02 | PSCSC4S-25 | CONSALOP03-3 | 79265 | Facturado |
| M03 | PSCSC4S-26 | CONSALOP03-4 | 79266 | En Proceso |
| M04 | PSCSC4S-27 | CONSALOP03-5 | 79267 | Sin información |
| M05 | PSCSC4S-28 | CONSALOP03-6 | 79268 | Sin información |
| M06 | PSCSC4S-29 | CONSALOP03-1 | 79269 | Sin información |

**Seis cuotas de UF160; total contratado UF960.** La lectura operacional acredita **UF320 según el campo explícito Jira**, correspondientes a los dos primeros hitos. En Proceso se conserva sin contarlo como factura; los tres vacíos siguen N/D. Los cuatro sin emisión acreditada no se convierten en deuda, cero facturado ni “No facturado”.

El campo local `customfield_12128` — **Estado de Facturación CloudOps** — tiene Facturado, En Proceso y No facturado, sin valor predeterminado. Se persistió el mapping verificado `recurring-jira-billing-field:3300001`. PMO lee sólo CONSALOP03 una vez confirmados los seis vínculos; no vuelve silenciosamente a PSCSC4S ante un fallo de acceso. El enum técnico `external_reference` en facturación significa **reutilizar estos hitos existentes**, no facturar en otro Space.

Se conservaron los IDs, fechas, descripciones, comentarios, adjuntos e historial de los originales. El cambio de estado operativo al workflow destino fue una correspondencia de categoría, no una prueba de factura o aceptación. El traslado y corte financiero se comprobaron idempotentes.

## Qué no se inventó y requiere gestión de la JP

El registro de controles no acredita que el servicio haya entregado reportes, consumido horas, obtenido NPS, celebrado reuniones o recibido aceptación. Tampoco valida automáticamente el SoW, la firma/aceptación del Cliente o la OC.

Las fechas de controles operativos quedan sin fijar porque deben confirmarse los períodos y la prorrata de inicio/término, sin crear una séptima cuota. Se conservaron las fechas PMO y Jira existentes, sin homologarlas por suposición.

La regla contractual de reporte se incorporó como primeros tres días hábiles del período siguiente. La recepción real debe acreditarse antes de calcular una fecha de aceptación. El texto del SoW presenta una discrepancia “cinco (3)” en una cláusula frente a tres días hábiles en otras; quedó registrada para decisión de negocio y no se convirtió en aceptación automática.

## Controles de ejecución y certificación

Se realizó respaldo privado de PMO, SoW y originales Jira antes del traslado, con hashes verificados. Se ejecutó un canario M06 con estado vacío antes de trasladar los demás. La creación operacional utilizó un journal de intents/receipts y verificó cada tarea y enlace por GET antes de una única transacción final PMO.

El primer intento de activación operacional se detuvo por la búsqueda Jira retirada `/rest/api/3/search`: **cero intents y cero receipts de creación**. Se sustituyó por el cliente Jira vigente del sistema y se reanudó el mismo journal, sin repetir issues. La corrida completa creó y verificó 34/34 tareas; finalizó y persistió los 34 bindings en PMO.

La lectura final confirmó 40 issues, dos tipos correctos, 34 tareas internas pendientes, seis hitos, seis cuotas intactas, fuente financiera única y cero duplicados/advertencias financieras. Los snapshots confirmaron cuotas, etapas, documentos, reportes, evidencia financiera y artefactos sin cambios por la activación operacional. El servicio continúa activo y en Ejecución; no se cerraron etapas ni se declaró cumplimiento.

Certificación de código: **1.188 pruebas deterministas aprobadas, 20 omitidas**, 25 focales financieras aprobadas, build productivo correcto y exactamente cinco errores TypeScript heredados — cuatro en `jiraMilestoneSync.ts` y uno `estadoSII` en `routers.ts`. Se excluyó la prueba live `ufService.test.ts`, sin declarar como aprobada una consulta externa del Banco Central. Diff y escaneo de secretos correctos.

El 4687 cerrado mantuvo su huella `ccd7c4a0b4d1b01d26430d85dede19cfb7da8dfe8681e553c7666fe549af4f78`, tres cuotas y doce controles. El 4727 conservó ficha, seis cuotas, 31 controles y etapas, con huella `d5ece2b0296c8bbca8b783ce326c5623f44404bceb9a25196ea1393135b87e6c`.

## Recuperación y continuidad

- Respaldo fuente: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-cloudops-4775/2026-10-21T20-54-41-655Z`.
- Journal de traslado: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-cloudops-4775-native-move/journal.json`.
- Respaldo y journal operacional: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-cloudops-4775-operations`.
- Verificación final privada: `/home/ubuntu/4775-cloudops/final-verification.json`.
- Preparación contractual: checkpoint `86997087`; traslado/corte financiero: `23f527ef`; checkpoint final informado en la entrega.

Los respaldos contienen evidencia privada y no deben publicarse. No se inicia una segunda corrida de creación para refrescar vistas: se utilizan las lecturas y los bindings existentes.
