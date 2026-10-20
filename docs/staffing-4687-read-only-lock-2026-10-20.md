# Corrección de cierre efectivo — Staffing Deal 4687

## Falla reconocida

Base: checkpoint `50450c78`, referencias alineadas y árbol limpio antes de este cambio. El cierre anterior terminó el lifecycle y resolvió los bindings, pero no implementó una invariante de escritura ni retiró los controles/alertas operativas de las páginas del servicio. Las capturas 459–461 del usuario prueban el problema: detalle con «Editar configuración», registrar multa y dos señales abiertas; Inicialización con Nueva versión/Revisar/Archivar/Aplicabilidad; Ejecución con Actualizar análisis y progreso operativo. Las pruebas previas certificaron datos y pantalla de cierre, no esta condición funcional de sólo lectura. No se considera que ese cierre previo estuviera funcionalmente completo.

## Alcance de la reparación

La instrucción adicional del usuario fue cerrar el servicio sin exigir nuevas sincronizaciones o información. No se reabrió el servicio ni se condicionó el cierre a factura, entrega, SLA o JSM.

1. `shared/recurringServiceLifecycle.ts` define cerrado para `completado`/`cancelado`; los roles no lo pueden convertir en editable.
2. `server/recurringServiceWriteGuard.ts` consulta estado autoritativo y rechaza escritura con `FORBIDDEN`, incluso para admin. `assertRecurringChildWritable` resuelve el dueño persistido de documentos, ítems, cuotas y multas, y rechaza IDs ajenos/forjados.
3. Todas las mutaciones existentes de `recurringServicesRouter` quedaron protegidas, salvo crear un servicio nuevo. Incluye update/reapertura por status, cuotas, documentos, CRM/IA, fechas/plan/SLA, vínculo JSM, categorías/mappings/dry-run/sync/create/associate, cierres, multas y evidencia. El runner JSM omite cerrados incluso si se solicitan explícitamente. Las consultas y descargas siguen permitidas.
4. Gobierno documental canónico protege upload/decide/archive/applicability/snapshots y revalida a nivel repositorio la creación de artefactos y decisiones. La descarga permanece permitida con auditoría de lectura. Las rutas de recuperación ejecutiva global analizadas son de proyectos, no una vía de escritura de servicios; no se modificaron flujos ajenos.
5. Métricas distinguen lifecycle `closed`: conservan datos/severidad histórica, pero no publican señales abiertas ni cuentan cerrados en atención, reportes, incidentes, SLA, formalidad o calidad operativa actual. La historia financiera y los listados de archivo se conservan.
6. Las seis rutas (detalle, Inicialización, Plan, JSM Setup, Ejecución y Cierre) pasan por `RecurringServiceLifecycleBoundary`: no montan los formularios/hooks de edición cuando la ficha está cerrada. En su lugar muestran `ClosedRecurringServiceArchive`, neutral, sin multas/edición/subida/revisión/sincronización/regeneración IA. Cartera presenta «Cerrado · sólo consulta» y «Consultar archivo», sin paneles ni señales operativas de la tarjeta.

## Datos preservados

Servicio PMO **2040001**, `status=completado`, `currentStage=cierre`, cierre registrado 20-10-2026; período contractual 27-04-2026 a 27-07-2026. Tres cuotas **UF160**, total **UF480**; bindings **CONSALOP01-23/-21/-22**. Cuatro documentos canónicos validados, 12 controles históricos, evidencia de reportes/finanzas, etapas, multas y SLA locales sin cambios. No se completaron tareas históricas, no se inventó facturación ni aceptación. N/D queda como información histórica, no tarea abierta. No hubo escrituras Jira/JSM, cambios de cuota, conciliaciones de monedas ni nueva sincronización.

Respaldo privado de 11 conjuntos de datos: `/home/ubuntu/backups/prodigio-pmo/2026-10-20-staffing-4687-read-only-lock/before.json`, SHA-256 **ccd7c4a0b4d1b01d26430d85dede19cfb7da8dfe8681e553c7666fe549af4f78**. `scripts/verifyClosedStaffing4687ReadOnly.ts --verify` confirmó igualdad exacta tras consultas y comprobación live del guard. No restaurar o sobreescribir datos para publicar.

## Validación funcional

El guard contra la base real devuelve `FORBIDDEN` para 2040001. Callers tRPC de prueba verifican rechazo de uploads/revisión/archivo/aplicabilidad para admin, PMO, PM y consulta; el guard recurrente verifica ruta directa, estado cancelado y ownership falsificado. La frontera React prueba que cerrado nunca monta la página editable, mientras activo/pausado mantienen su funcionamiento. Archivo conserva tres cuotas y descarga. Cartera usa el lifecycle normalizado real `closed`, no sólo una fixture de estado de ficha. Motor prueba cerrados con factura desconocida y reportes sin evidencia: se conserva historia sin sumar atención actual.

Preview autenticada de Inicialización/Ejecución confirmó archivo cerrado, cuatro descargas, tres referencias únicas y ninguna entrada/formulario o botón de modificación del servicio. Certificación final: **1.163 pruebas aprobadas, 20 omitidas; 165 archivos aprobados**, build productivo exitoso, `git diff --check` y escaneo de secretos correctos. TypeScript conserva cinco errores heredados en jiraMilestoneSync/routers fuera de este cambio. La prueba live UF externa se excluyó igual que en la base previa. No se usó una nueva sincronización ni una factura como requisito de cierre.

La corrección de código necesita publicarse desde el checkpoint WebDev para operar en `pmo.prodigio.tech`; no confundir el cambio de datos ya aplicado con el despliegue del guard. El entorno no expone una operación separada de deploy.
