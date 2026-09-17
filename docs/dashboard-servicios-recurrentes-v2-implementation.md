# Dashboard de Servicios Recurrentes V2 — Bitácora de implementación

**Autor:** Manus AI  
**Inicio:** 16 de septiembre de 2026  
**Base de código:** `da9615671c633383f8c6c93f44765a22d31a3258`

## R0 — Línea base, sincronismo y salvaguardas

El gate de versión confirmó la rama `main`, con `HEAD`, `origin/main` y `user_github/main` alineados en `da961567`. El único cambio local era el backlog de esta implementación. El estado TypeScript conserva cinco errores heredados ya documentados, sin relación con el dashboard recurrente.

La línea base productiva al 16 de septiembre de 2026 contiene tres servicios activos: uno de soporte de incidentes, uno de requerimientos y uno mixto. En conjunto poseen 15 cuotas programadas, todas pendientes; ocho ya están vencidas por fecha de corte. No existe monto local marcado como facturado o pagado. Los tres servicios tienen contrato y SoW, doce reglas SLA configuradas en total, y ninguno presenta penalidades activas. Solo Camanchaca tiene clave de proyecto JSM y solo ese Deal encuentra coincidencia en `financial_data`; todavía no existe un `serviceDeskId` confirmado.

Antes de cualquier reconciliación se creó una salvaguarda física con prefijo `backup_recurring_dashboard_v2_20260916_`. El manifiesto verificó coincidencia exacta entre producción y respaldo para 3 servicios, 15 cuotas, 12 documentos, 15 etapas, 73 ítems de plan, 12 reglas SLA, 1 corrida de vínculo JSM y 1 registro financiero coincidente. Los conjuntos de penalidades, análisis IA, mapeos JSM y corridas de sincronización estaban vacíos. Estas tablas no se eliminarán durante la implementación.

| Control R0 | Resultado |
|---|---|
| Rama y referencias | Alineadas en `da961567` |
| Árbol previo | Solo `todo.md`, cambio esperado |
| Servicios productivos | 3 |
| Cuotas programadas | 15 |
| Cuotas vencidas pendientes | 8 |
| Facturado local verificable | 0 |
| Pagado local verificable | 0 |
| Respaldos físicos | 12 tablas de datos + manifiesto |
| Conteos respaldo versus producción | 12 de 12 coincidentes |
| Errores TypeScript de línea base | 5 heredados |

## Estado de fases

| Fase | Estado |
|---|---|
| R0 — Línea base y salvaguardas | Completada |
| D0 — Contrato de métricas | Completada |
| D1 — Calidad y reconciliación | Completada |
| D2 — Modelo de evidencias y snapshots | Completada |
| D3 — API consolidada de portafolio | Completada |
| D4 — Torre de Control V2 | Completada |
| D5 — Analítica financiera recurrente | Completada |
| D6 — Reportes y formalidad documental | Completada |
| D7 — Incidentes y cumplimiento SLA JSM | Completada |
| D8 — Detalle 360° por servicio | Completada |
| D9 — Actualización e historial operacional | En activación controlada |
| D10 — Certificación final | Pendiente |

## D0 — Contrato de métricas y salud determinista

Se implementó `recurringServicesMetricsEngine.ts` como motor puro y versionado `2.0`. El contrato separa **contratado, programado, facturado, cobrado, cuentas por cobrar, pendiente y vencido** por moneda. No existe un total monetario transversal que sume USD, CLP, UF u otras monedas. El motor usa una fecha de corte explícita y solo considera facturada una cuota cuyo estado sea `facturado` o `pagado`; solo considera cobrada una cuota `pagado`.

La configuración SLA quedó separada del cumplimiento real. Cuando no existe snapshot operacional medible, incidentes y porcentajes SLA se entregan como `null`, con estado de evidencia `not_configured`, `stale` o `error`. El semáforo combina reglas auditables para cuotas vencidas, reportes exigibles pendientes, formalidad documental, incidentes críticos y mediciones SLA. Si no existe ninguna dimensión medible, el resultado es `no_data` en vez de fabricar un estado favorable.

| Regla D0 | Resultado verificable |
|---|---|
| Contrato de salida | Versionado como `2.0` |
| Monedas | Agregación independiente por código monetario |
| Facturado | Estados `facturado` + `pagado` |
| Cobrado | Solo estado `pagado` |
| Vencido financiero | `pendiente` con fecha anterior al corte |
| Reporte exigible | Fecha menor o igual al corte |
| SLA sin evidencia | `null`, nunca inferido desde configuración |
| Salud sin evidencia | `no_data` |
| Suite focal | 7 pruebas aprobadas |

La suite `server/recurringServicesMetricsEngine.test.ts` cubre separación financiera, fecha de corte, N/D de SLA, multimoneda, cumplimiento medido, salud estable y ausencia total de evidencia. Los cinco errores TypeScript heredados de la línea base permanecen fuera de este incremento.

## D1 — Calidad y reconciliación de datos

Se implementó `recurringServicesQualityEngine.ts`, que diagnostica seis dimensiones por servicio: **Deal, moneda, tipología, contrato, documentación y JSM**. La salida distingue condiciones informativas, advertencias y bloqueos de métricas confiables; normaliza la identidad del Deal sin modificarla y solo propone correcciones cuando existe evidencia no contradictoria.

El diagnóstico productivo confirmó que los tres planes de facturación coinciden exactamente con sus montos contractuales y monedas locales, y que cada servicio posee contrato y SoW. Camanchaca coincide de forma única con `financial_data`; los Deals 4687 y 4727 todavía no aparecen en esa fuente y quedan como brecha visible, no como error corregido. Ningún servicio tiene aún un `serviceDeskId` JSM confirmado, por lo que incidentes y SLA continuarán como N/D hasta D7.

Los servicios 2040001 y 2070001 contenían la palabra **Staffing** de forma explícita en su denominación persistida, pero estaban clasificados como `soporte_incidentes` y `requerimientos`. Se corrigieron exclusivamente esos dos IDs a `staffing` dentro de una transacción. La tabla `backup_recurring_dashboard_v2_20260916_services` conserva los valores originales y `audit_logs` contiene una entrada D1 por cada corrección. No se modificaron monedas, montos, cuotas, documentos ni vínculos JSM.

| Control D1 | Resultado |
|---|---|
| Servicios diagnosticados | 3 |
| Plan contractual versus cuotas | 3 de 3 coincidentes |
| Moneda servicio versus cuotas | 3 de 3 coincidentes |
| Contrato + SoW | 3 de 3 completos |
| Deal reconciliado con fuente financiera | 1 de 3 |
| Service Desk JSM confirmado | 0 de 3 |
| Tipologías Staffing corregidas | 2 |
| Registros de auditoría | 2 |
| Pruebas de calidad | 6 aprobadas |

## D2 — Evidencia verificable e historial operacional

La migración aditiva `0045_cute_may_parker.sql` incorporó cuatro entidades nuevas sin alterar los registros productivos existentes: control de vigencia documental, evidencia mensual de entrega y aceptación, evidencia financiera de factura/pago/nota de crédito y snapshots históricos JSM/SLA. Las tablas usan claves e índices para impedir duplicidad por documento, período y fingerprint de snapshot.

Durante la aplicación inicial, la última sentencia de creación quedó incompleta por un corte en la consulta enviada. La diferencia fue detectada inmediatamente con `information_schema` cuando las cuatro tablas tenían **cero filas**. Se completaron las columnas, enums, clave primaria e índices antes de insertar cualquier dato. La estructura final coincide con el esquema y la migración generada: 11, 16, 25 y 15 columnas respectivamente, con todos los índices declarados.

| Tabla D2 | Propósito | Filas productivas al cierre |
|---|---|---:|
| `recurring_service_document_controls` | Vigencia y validación de documentos | 0 |
| `recurring_service_report_evidence` | Período, entrega, aceptación y evidencia mensual | 0 |
| `recurring_service_financial_evidence` | Factura, pago, nota de crédito y trazabilidad | 0 |
| `recurring_service_jsm_snapshots` | Incidentes y cumplimiento SLA histórico | 0 |

La prueba opt-in `recurringDashboardV2Persistence.test.ts` insertó un servicio aislado y registros de las cuatro entidades, validó unicidad de períodos y snapshots, y eliminó todos los datos de prueba. El control posterior confirmó cero residuos. La reversión segura quedó documentada en `docs/migrations/0045-dashboard-recurrente-v2-rollback.md` y exige respaldo/autorización si las tablas ya contienen evidencia real.

## D3 — API consolidada del portafolio

Se agregó el procedimiento protegido `recurringServices.dashboardV2`, manteniendo intacto `dashboardKpis` para permitir convivencia V1/V2. El endpoint acepta fecha de corte y filtros por cliente, estado, tipo, salud, moneda y texto; todos los KPIs se recalculan sobre el universo filtrado en el servidor.

La capa de datos obtiene por separado servicios, cuotas, plan de trabajo, documentos, controles documentales, evidencias mensuales, evidencias financieras, reglas SLA, snapshots JSM y referencias financieras. Esto evita multiplicación de montos por joins uno-a-muchos. El agregador puro integra el contrato D0 y el diagnóstico D1, selecciona el snapshot JSM más reciente por servicio y lo marca obsoleto cuando excede 36 horas.

| Salida D3 | Contenido |
|---|---|
| `metadata` | Versión, fecha de corte, filtros, universo y frescura JSM |
| `filterOptions` | Clientes, estados, tipos, monedas y salud disponibles |
| `kpis` | Cartera, finanzas por moneda, reportes, formalidad, incidentes, SLA y calidad |
| `trends` | Series financieras por moneda, reportes e incidentes |
| `matrix` | Fila 360 resumida y ordenada por criticidad para cada servicio |
| `quality` | Diagnóstico por dimensión y resumen del portafolio |
| `evidenceInventory` | Cobertura de las cuatro entidades D2 |

Las pruebas unitarias D3 cubren filtros, búsqueda, snapshot vigente/obsoleto, salud, calidad y series multimoneda. La prueba de integración opt-in consultó la base real en modo solo lectura y construyó el portafolio completo sin sumar monedas distintas. Resultado acumulado: 19 pruebas unitarias D0–D3 y 1 prueba de integración aprobadas; no se agregaron errores TypeScript a los cinco heredados.

## D4 — Torre de Control V2

La ruta de Servicios Recurrentes abre ahora por defecto una **Torre de Control V2**, manteniendo disponibles las vistas `Clásico` y `Lista` durante la convivencia. La cabecera prioriza cuántos servicios requieren atención y permite fijar la fecha de corte; un selector separado conserva el acceso a las vistas anteriores sin duplicar navegación global.

La interfaz consume exclusivamente `recurringServices.dashboardV2`. Incluye filtros combinables por cliente, estado, tipo, salud, moneda y búsqueda; KPIs de cartera, reportes, formalidad y cobertura operacional; panel financiero separado por moneda; diagnóstico de calidad; y una matriz priorizada con navegación al detalle de cada servicio. Los estados críticos, en atención, estables y sin datos tienen códigos visuales independientes del magenta corporativo.

| Validación D4 | Resultado |
|---|---|
| Vista predeterminada | Torre V2 |
| Convivencia | Torre V2, Clásico y Lista |
| Escritorio | Revisado a 1440 × 1000 |
| Móvil | Revisado a 390 × 844 |
| Build | Exitoso |
| Pruebas focales | 24 aprobadas |
| Errores TypeScript nuevos | 0 |

La vista móvil apila filtros, indicadores financieros y filas de servicio sin desbordes horizontales. Facturado, cobrado, SLA e incidentes preservan N/D cuando no existe evidencia; no se presentan ceros ficticios como cumplimiento.

## D5 — Analítica financiera recurrente

La Torre V2 incorpora un módulo financiero dedicado con tendencia mensual de **programado, facturado, cobrado y vencido** por moneda, seguido por una reconciliación individual de cada servicio con su Deal y la fuente financiera corporativa. El servidor realiza todos los cálculos y nunca suma ni convierte monedas diferentes.

La conciliación separa cinco estados: comparable en UF, referencia existente pero no comparable por moneda, referencia faltante, Deal ambiguo y servicio sin Deal. Los campos corporativos de venta, presupuesto, utilizado, planificado, proyectado, línea de negocio y fecha de sincronización se exponen únicamente cuando existe una referencia única. Las facturas, pagos y notas de crédito de las tablas D2 se muestran como evidencia confirmada y no alteran por sí solas el estado de una cuota.

| Control D5 | Resultado |
|---|---|
| Servicios con Deal conciliado | 1 de 3 |
| Servicios comparables directamente en UF | 0 de 3 |
| Servicios sin referencia corporativa | 2 de 3 |
| Evidencia real de factura/pago | 0 registros; visible como ausencia |
| Monedas | USD presentada sin conversión ni total cruzado |
| Fecha de corte | Aplicada a cuotas y evidencia financiera |
| Pruebas focales acumuladas | 21 aprobadas |
| Build | Exitoso |
| Errores TypeScript nuevos | 0 |

La revisión visual en escritorio confirmó legibilidad de la tendencia, las tres conciliaciones y la separación entre plan local y referencia corporativa. El servicio Camanchaca aparece correctamente como referencia UF no comparable con su contrato local USD; los Deals 4687 y 4727 muestran la brecha sin fabricar equivalencias.

## D6 — Reportes mensuales y formalidad documental

La API V2 entrega ahora un calendario consolidado de reportes mensuales por servicio y período. Cada celda distingue planificado, vencido, completado sin evidencia, entregado, aceptado, rechazado, eximido o evidencia sin hito asociado. La puntualidad se calcula con la fecha real de entrega contra la fecha exigible y los porcentajes permanecen en N/D cuando no existe un denominador verificable.

La Torre V2 incorpora un heatmap horizontal navegable y un panel de formalidad para contrato y SoW. El control documental diferencia documento faltante, presente sin validación, pendiente, vigente, vencido y rechazado; por tanto, la presencia de un archivo ya no equivale a vigencia formal. Cada fila conduce al detalle del servicio para gestionar la evidencia.

| Control D6 | Resultado actual |
|---|---|
| Reportes exigibles al corte | 0 |
| Entregas con evidencia | 0; porcentaje N/D |
| Aceptaciones verificadas | 0; porcentaje N/D |
| Contratos/SoW presentes | 6 de 6 |
| Contratos/SoW formalmente validados | 0 de 6 |
| Estado visible | Presente sin control, no falsamente “vigente” |
| Pruebas focales acumuladas | 30 aprobadas |
| Build | Exitoso |

La primera revisión visual detectó una excepción `RangeError` al representar períodos sin fecha. Se corrigió mediante un formateador tolerante y se añadió una prueba de regresión; la segunda captura confirmó la carga completa del dashboard y de sus nuevos módulos.

## D7 — Incidentes y cumplimiento SLA JSM

Se implementó un recolector JSM de solo lectura que pagina las solicitudes del proyecto vinculado, clasifica prioridades y estados, calcula incidentes abiertos, críticos, vencidos y abiertos por más de 30 días, y consulta los ciclos SLA oficiales de cada solicitud. La primera respuesta y la resolución se calculan sobre ciclos medidos, separando numerador y denominador; si Atlassian no entrega medición, el resultado permanece N/D.

Cada ejecución persiste un snapshot inmutable e idempotente mediante fingerprint. El endpoint manual individual y el refresco global están restringidos a roles `admin` y `pmo`, registran auditoría y continúan frente a errores parciales. La interfaz agrega `Actualizar JSM`, cobertura, frescura, incidentes, antigüedad y dos indicadores SLA. La consulta `Actualizar lectura` continúa siendo independiente y no escribe datos.

| Control D7 | Resultado |
|---|---|
| Acceso externo | Solo GET a Jira/JSM |
| Persistencia | Snapshot local idempotente por fingerprint |
| Permisos de actualización | Admin y PMO |
| Indicadores | Total, abiertos, críticos, altos, vencidos y +30 días |
| SLA | Primera respuesta y resolución sobre ciclos medidos |
| Servicios productivos con vínculo JSM confirmado | 0 de 3 |
| Estado actual de KPIs operacionales | N/D, correctamente degradado |
| Pruebas focales acumuladas | 33 aprobadas |
| Build | Exitoso |

La validación visual se realizó en la ruta real `/recurring-services`. Un primer intento sobre `/servicios-recurrentes` confirmó un 404 esperado y no corresponde a una falla del dashboard. La implementación usa la estructura de ciclos SLA documentada por Atlassian y conserva el detalle de fuentes y errores en cada snapshot.

## D8 — Detalle 360° por servicio

El detalle de cada servicio incorpora una vista 360° antes del pipeline operativo existente. La nueva lectura usa el mismo contrato consolidado del portafolio con un filtro exacto por `serviceId`; así, los KPIs, reglas de salud y diagnósticos permanecen idénticos entre la Torre de Control y el detalle, sin cálculos divergentes en el cliente.

La cabecera 360° resume salud, cobertura de evidencia, calidad, reportes vencidos e incidentes abiertos. Cinco pestañas organizan la información en **Resumen, Financiero, Entregables, SLA e incidentes, y Evidencias**. El pipeline original continúa visible y conserva las acciones de configuración y ejecución ya existentes.

| Pestaña | Contenido principal |
|---|---|
| Resumen | Salud, tipo, etapa, Deal, señales y hallazgos de calidad |
| Financiero | Contratado, programado, facturado, cobrado, CxC, pendiente, vencido y conciliación |
| Entregables | Calendario de reportes, fechas, evidencia, aceptación y puntualidad |
| SLA e incidentes | Totales, abiertos, críticos, vencidos, antigüedad y cumplimiento medido |
| Evidencias | Formalidad de contrato/SoW e inventario de evidencia D2 |

Se añadió una regresión que verifica que el filtro por `serviceId` reduzca consistentemente matriz, finanzas, entregables y documentos al servicio solicitado. El gate D8 aprobó 34 pruebas y el build. La revisión visual se realizó en escritorio y móvil sobre un servicio productivo, confirmando navegación, jerarquía y degradación N/D.

## D9 — Actualización diaria, historial y observabilidad

Se extrajo `recurringServicesJsmRefreshRunner.ts` como único flujo para las actualizaciones manuales y programadas. El runner selecciona servicios activos, omite explícitamente servicios inactivos o sin vínculo JSM, reutiliza el recolector GET-only D7 y la persistencia idempotente de snapshots, continúa ante fallos individuales y consolida estados `success`, `partial`, `error` y `skipped`. Cada corrida se registra en `audit_logs` con un `operationId` estable, origen, tiempos, conteos y resultados sanitizados por servicio.

Las mutaciones manuales D7 ahora invocan el runner común y conservan los permisos `admin`/`pmo`. Se agregó `recurringServices.jsmRefreshHistory` como consulta protegida y paginada que reutiliza auditoría en vez de crear otra tabla. La Torre V2 muestra las cinco corridas más recientes, su origen manual o programado, fecha, estado, exitosas, parciales, errores y omitidas; mantiene estados de carga, vacío y error, e invalida dashboard e historial de forma coordinada después de un refresco manual.

El callback `POST /api/scheduled/refreshRecurringServicesJsm` autentica con el SDK, exige identidad cron y `taskUid`, compara ese UID con la configuración durable `recurring_services_jsm_refresh_task_uid` y responde `200 skipped: orphan` para tareas desconocidas. La corrida diaria usa un `operationId` por fecha UTC para impedir repetición del acceso a JSM en reintentos y limita cada ejecución a 25 servicios dentro del timeout de dos minutos. No existe `setInterval`, `node-cron` ni escritura hacia Jira/JSM.

| Control D9 previo a activación | Resultado |
|---|---|
| Runner compartido manual/programado | Implementado |
| Auditoría e historial | `audit_logs`, sin tabla redundante |
| Idempotencia de snapshots | Fingerprint D7 reutilizado |
| Idempotencia de corrida diaria | `operationId` UTC reutilizable |
| Callback cron-only | Implementado y montado antes del fallthrough |
| Task UID durable | Helper `admin_settings` y validación por clave |
| Job diario activo | No; se activa sólo después del checkpoint publicado |
| Pruebas focales D7–D9 | 21 aprobadas |
| Build | Exitoso |
| Revisión visual | 1440 × 1000 y 390 × 844 |
| Errores TypeScript nuevos | 0; permanecen cinco heredados |

La programación propuesta es diaria a las `09:00 UTC` (`0 0 9 * * *`), equivalente a las 06:00 en la zona del usuario durante UTC−3. La activación se realizará como un checkpoint separado: crear el Heartbeat de proyecto, persistir su `taskUid`, ejecutar una corrida controlada y revisar logs. Hasta completar ese gate, el callback publicado es seguro porque cualquier UID no registrado se degrada a `orphan` sin reintentos.
