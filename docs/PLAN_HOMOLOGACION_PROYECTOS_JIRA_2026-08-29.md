# Plan de homologación de proyectos incorporados desde Jira

**Producto:** Prodigio PMO  
**Fecha:** 29 de agosto de 2026  
**Autor:** Manus AI  
**Estado:** Propuesta para aprobación; no se implementan cambios funcionales  
**Objetivo:** lograr que un proyecto incorporado desde Jira termine operando bajo el mismo modelo, pipeline, controles, evidencias, permisos, reportes y cierre que un proyecto creado desde cero en Prodigio PMO.

## 1. Decisión de arquitectura

La homologación no debe construir un segundo tipo de proyecto ni mantener dos experiencias funcionales. **Después del proceso de incorporación, ambos orígenes deben converger al mismo modelo canónico de Prodigio PMO.** El campo `origin` se conservará exclusivamente como trazabilidad de procedencia; no determinará qué funciones tiene disponibles el proyecto.

> Jira será la fuente operativa de issues, estados, responsables y fechas replanificadas. Prodigio PMO será la fuente de gobierno para el pipeline de seis etapas, el baseline contractual, la evidencia documental, las aprobaciones, los riesgos consolidados, los hitos de facturación, la salud ejecutiva y el cierre administrativo.

Esta separación evita que una fecha replanificada en Jira sobrescriba la promesa contractual, que un issue eliminado borre evidencia histórica o que una sincronización externa cierre etapas PMO sin aprobación humana.

| Dominio | Fuente maestra propuesta | Regla de homologación |
|---|---|---|
| Identidad del proyecto | Prodigio PMO | Se confirma nombre, cliente, tipo, PM, Delivery y Deal durante el onboarding |
| Estructura de seis etapas | Prodigio PMO | Siempre se crean las mismas seis etapas y se aplican los mismos guardrails |
| SoW contractual | Prodigio PMO | Debe cargarse o vincularse con evidencia y versión; Jira no lo reemplaza |
| Issues, estados y responsables | Jira | Se sincronizan por `issueKey` mediante UPSERT idempotente |
| Baseline contractual | Prodigio PMO | Proviene de SoW/Gantt aprobado; una fecha Jira solo puede adoptarse con confirmación explícita |
| Planificación vigente | Jira | `duedate` representa la fecha actualmente programada y puede cambiar |
| Fecha real | Jira y acta | El cierre Jira se registra separado de la aceptación del cliente |
| Riesgos | Prodigio PMO con vínculo Jira | Se preserva matriz/versionamiento PMO y se enlaza cada issue de riesgo |
| Finanzas | Fuente financiera corporativa | Se relaciona por Deal confirmado, nunca por coincidencia automática de nombre |
| Documentos y actas | Prodigio PMO/S3 | Se mantiene evidencia, versión, autor, fecha y asociación al hito correspondiente |
| Cierre de etapas | Prodigio PMO | Requiere evidencia y confirmación; Jira no cierra etapas automáticamente |

## 2. Estado actual y brecha a resolver

El flujo vigente permite seleccionar un Space Jira existente, crear un proyecto `linked`, registrar la relación y generar las seis etapas. Sin embargo, marca SoW, Jira, Riesgos y Planificación como completadas sin reconstruir necesariamente su evidencia, deja Avance activo y no ejecuta una conciliación completa de hitos, documentos, riesgos, baseline o datos financieros.

| Capacidad | Alta desde cero | Incorporación Jira actual | Estado objetivo |
|---|---|---|---|
| Identidad y responsables | Captura controlada | Captura parcial | Mismos campos y validaciones |
| Pipeline de seis etapas | Completo y secuencial | Seis etapas creadas, cuatro autocerradas | Mismo pipeline, con reconstrucción o regularización por etapa |
| SoW | Generado/cargado y aprobado | No importado | Evidencia histórica o etapa pendiente |
| Space Jira | Creado con configuración corporativa | Space existente vinculado | Diagnóstico de compatibilidad y mapeo validado |
| Riesgos | Matriz versionada y issues sincronizados | No materializados en PMO | Importación reconciliada y versionada |
| Planificación | Backlog/hitos/Gantt construidos | Consultados desde Jira | Entidades PMO creadas y vinculadas por `issueKey` |
| Baseline ejecutivo | Aprobado y versionado | Se crea después o por fallback | Baseline provisional revisado y aprobación obligatoria |
| Avance | Mismas métricas y dashboard | Vista vinculada diferenciada | Misma vista, consola y Dashboard Ejecutivo v2 |
| Finanzas | Deal y sincronización corporativa | No asociado en el alta | Deal confirmado antes de activar análisis financiero |
| Cierre | Guardrails y evidencias | Disponible después de Avance | Exactamente el mismo flujo y restricciones |
| Auditoría | Eventos completos | Solo evento de vinculación | Historial de preflight, mapeos, importación y sincronizaciones |

## 3. Modelo objetivo de incorporación

La opción actual **“Vincular proyecto Jira”** debe evolucionar a un asistente de siete pasos dentro de Administración, sin agregar una séptima etapa al pipeline del proyecto.

| Paso del asistente | Acción | Resultado verificable |
|---|---|---|
| 1. Selección | Buscar y seleccionar Space Jira no administrado | Proyecto Jira identificado y no duplicado |
| 2. Preflight | Analizar issue types, estados, boards, hitos, riesgos, épicas, usuarios, fechas y adjuntos | Informe sin escritura con cobertura y alertas |
| 3. Identidad PMO | Confirmar cliente, tipo, PM, Delivery, Deal, fechas generales y fecha de corte | Identidad canónica completa o `[PENDIENTE]` explícito |
| 4. Mapeo | Revisar la propuesta Jira → hitos, riesgos, épicas, tareas y responsables | Mapeo versionado y aprobado por el usuario |
| 5. Reconstrucción | Crear las seis etapas y asociar evidencia histórica disponible | Ninguna etapa se completa sin evidencia o excepción auditada |
| 6. Conciliación | Crear baseline provisional, hitos, riesgos, backlog y relación financiera | Conteos origen/destino conciliados y sin duplicados |
| 7. Activación | Ejecutar sincronización inicial y habilitar gestión normal | Proyecto deja el modo onboarding y opera igual que uno nativo |

El proyecto podrá crearse al inicio del asistente como `draft` o `onboarding`, pero no aparecerá como proyecto operativo normal hasta completar la activación. Esto evita que un proyecto parcialmente importado altere la Consola de Gobierno o los indicadores financieros.

## 4. Tratamiento de las seis etapas

La homologación debe respetar el pipeline existente y sus reglas. No se agregarán roles ni etapas adicionales.

| Etapa | Regla para proyecto importado | Condición de homologación |
|---|---|---|
| 1. SoW | Buscar documento contractual disponible en Jira o solicitar carga. Registrar versión, fuente y aprobación | Se completa solo con SoW aprobado; de lo contrario queda `in_progress` y `[PENDIENTE]` |
| 2. Jira | Validar Space, boards, issue types, estados y permisos. Registrar divergencias frente al estándar corporativo | Se completa con conexión verificada y mapeo aprobado; no exige destruir la configuración Jira existente |
| 3. Riesgos | Detectar issues de riesgo, importar matriz inicial, vincular keys y crear versión base | Se completa con riesgos conciliados o declaración auditada de ausencia |
| 4. Planificación | Importar épicas, backlog e hitos; asociar Gantt/plan contractual; separar baseline, fecha Jira y fecha real | Se completa con planificación reconciliada y baseline aprobado o explícitamente pendiente |
| 5. Avance | Activar sincronización continua, Dashboard Ejecutivo v2, consola, actas por hito y análisis agéntico | Utiliza exactamente las mismas métricas y reglas que proyectos nativos |
| 6. Cierre | Aplicar cierre administrativo, lecciones, documentos y validaciones existentes | No existen atajos por ser un proyecto importado |

Cuando exista evidencia histórica válida, el sistema podrá cerrar una etapa mediante una acción **“Homologar etapa con evidencia existente”**. Esta acción debe crear el mismo registro de cierre utilizado en el flujo nativo, indicando fuente, usuario, fecha de homologación y fecha histórica del documento. Si falta evidencia, la etapa no se marcará como completada.

## 5. Modelo de datos recomendado

La prioridad es reutilizar las tablas canónicas actuales. Las nuevas tablas solo orquestarán el onboarding y la correspondencia con Jira.

| Componente | Propósito | Campos esenciales |
|---|---|---|
| `jira_project_onboarding` | Estado y trazabilidad del asistente | `projectId`, `jiraSpaceId`, `status`, `currentStep`, `sourceSnapshot`, `mappingVersion`, `initiatedBy`, timestamps |
| `jira_entity_mapping` | Correspondencia idempotente entre Jira y PMO | `projectId`, `issueKey`, `jiraIssueType`, `targetEntityType`, `targetEntityId`, `syncDirection`, `mappingVersion` |
| `jira_sync_log` | Historial de sincronizaciones por proyecto | `runId`, `projectId`, `source`, `status`, creados, actualizados, omitidos, errores, duración, usuario |
| `jira_import_exception` | Decisiones y datos faltantes | `projectId`, `domain`, `sourceKey`, `reason`, `resolution`, `status`, `resolvedBy` |

No se recomienda duplicar en tablas de importación los SoW, riesgos, tareas, hitos o documentos. Una vez homologados, deben vivir en las mismas tablas que utiliza el alta nativa. El vínculo Jira se mantiene mediante `jira_entity_mapping` y los campos de issue existentes.

## 6. Reglas de sincronización

La sincronización debe ser **idempotente, observable, recuperable y no destructiva**. Cada ejecución debe poder repetirse sin crear duplicados y sin borrar información PMO que no exista temporalmente en una respuesta Jira.

| Regla | Comportamiento |
|---|---|
| Clave de reconciliación | `projectId + issueKey + targetEntityType` |
| Escritura | UPSERT; nunca INSERT ciego |
| Eliminación en Jira | Marcar como ausente o archivado; no borrar automáticamente evidencia PMO |
| Cambio de `duedate` | Actualizar fecha programada Jira; conservar baseline contractual |
| Cambio de estado | Actualizar estado Jira y recalcular estado semántico determinista |
| Cierre Jira | Registrar `jiraClosedDate`; no crear acta de aceptación ni cerrar el hito contractualmente |
| Reapertura | Conservar historial y actualizar estado actual |
| Fallo parcial | Confirmar por proyecto o lote; permitir reintentar solo pendientes |
| Conflicto | Mostrar diferencias y exigir decisión humana para campos gobernados por PMO |
| Timeout | Límite por proyecto; continuar con los demás y registrar error aislado |

La sincronización inicial debe ser manual y supervisada. La automatización periódica se habilitará solo después del piloto y utilizará el mecanismo de ejecución persistente de la plataforma, con un botón **“Sincronizar ahora”** y un historial visible.

## 7. Backlog de implementación

### Fase H0 — Salvaguarda y contrato de homologación

**Objetivo:** congelar el comportamiento actual, definir invariantes y evitar regresiones.

| ID | Trabajo | Criterio de aceptación |
|---|---|---|
| H0.1 | Crear checkpoint previo y registrar versión de BD/código | Existe punto de recuperación verificable antes de tocar varios archivos |
| H0.2 | Documentar invariantes del proyecto canónico | Seis etapas, cuatro roles, avance por cardinalidad y prohibición de datos ficticios quedan cubiertos por pruebas |
| H0.3 | Crear fixtures sanitizados de payload Jira | Pruebas no crean proyectos en la BD productiva |
| H0.4 | Caracterizar `createLinkedProject` actual | Tests capturan el comportamiento que será reemplazado |

### Fase H1 — Persistencia del onboarding y auditoría

**Objetivo:** introducir una capa de orquestación sin cambiar todavía el resultado visible.

| ID | Trabajo | Criterio de aceptación |
|---|---|---|
| H1.1 | Agregar tablas de onboarding, mapeo, log y excepciones | Migración reversible y validada; sin pérdida de datos actuales |
| H1.2 | Agregar helpers de lectura/escritura idempotentes | Operaciones unitarias cubiertas por Vitest |
| H1.3 | Registrar auditoría por paso | Cada cambio conserva usuario, fecha, origen y detalle |
| H1.4 | Crear estados `draft`, `preflight`, `mapping`, `reconciliation`, `ready`, `failed` | Reanudar un onboarding no repite pasos completados |

### Fase H2 — Preflight Jira sin escritura

**Objetivo:** conocer la calidad y estructura del proyecto antes de crear datos PMO.

| ID | Trabajo | Criterio de aceptación |
|---|---|---|
| H2.1 | Consultar proyecto, boards, issue types, estados y usuarios | Informe visible sin modificar Jira ni PMO |
| H2.2 | Detectar hitos, riesgos, épicas y tareas candidatas | Conteos y criterios de clasificación explicables |
| H2.3 | Medir calidad de fechas y responsables | Issues sin `duedate`, sin asignado o sin tipo reconocible aparecen como alertas |
| H2.4 | Detectar proyecto/Deal duplicado | No permite continuar con key Jira ya administrada |
| H2.5 | Persistir snapshot del preflight | El usuario puede comparar el diagnóstico original con la importación final |

### Fase H3 — Asistente de identidad y mapeo

**Objetivo:** confirmar la identidad PMO y revisar el mapeo antes de persistir entidades de negocio.

| ID | Trabajo | Criterio de aceptación |
|---|---|---|
| H3.1 | Construir wizard de siete pasos | Permite guardar, salir y continuar sin perder decisiones |
| H3.2 | Confirmar cliente, tipo, PM, Delivery y Deal | Campos obligatorios bloquean activación; faltantes no se autocompletan |
| H3.3 | Mostrar tabla de mapeo de issues | Usuario puede incluir, excluir y reclasificar cada candidato |
| H3.4 | Conciliar usuarios Jira con usuarios PMO | Coincidencias ambiguas quedan `[POR CONFIRMAR]` |
| H3.5 | Versionar reglas aprobadas | La sincronización posterior usa la misma versión de mapeo |

### Fase H4 — Reconstrucción de las seis etapas

**Objetivo:** crear una historia PMO auditable sin falsos cierres.

| ID | Trabajo | Criterio de aceptación |
|---|---|---|
| H4.1 | Reemplazar autocierre de etapas históricas | Ninguna etapa queda `completed` solo por vincular Jira |
| H4.2 | Implementar homologación de SoW | Documento, versión y aprobación se registran como en el flujo nativo |
| H4.3 | Implementar homologación de Jira | Registra configuración observada, mapeo y excepciones aceptadas |
| H4.4 | Implementar homologación de Riesgos | Matriz inicial y vínculo a issues quedan versionados |
| H4.5 | Implementar homologación de Planificación | Backlog, hitos y evidencia de Gantt quedan conciliados |
| H4.6 | Usar el cierre formal existente | Cada etapa homologada crea `stage_closure` y evento de auditoría |

### Fase H5 — Baseline, hitos y sincronización inicial

**Objetivo:** dejar el proyecto listo para operar en Avance con información confiable.

| ID | Trabajo | Criterio de aceptación |
|---|---|---|
| H5.1 | Crear hitos ejecutivos desde el mapeo aprobado | Cada hito tiene key Jira y no se duplica al reintentar |
| H5.2 | Separar tres fechas | Baseline contractual, fecha Jira y fecha real se guardan independientemente |
| H5.3 | Crear baseline provisional | No se considera aprobado hasta confirmación `admin`, `pmo` o `pm` autorizado |
| H5.4 | Importar estados y cierres Jira | Estado semántico coincide con reglas deterministas actuales |
| H5.5 | Conciliar actas por hito | Cierre Jira no equivale a aceptación del cliente |
| H5.6 | Ejecutar reporte de reconciliación | Conteos origen/destino y excepciones deben quedar en cero o aceptadas |

### Fase H6 — Riesgos, backlog, documentos y finanzas

**Objetivo:** completar los dominios que diferencian gestión operativa de gobierno PMO.

| ID | Trabajo | Criterio de aceptación |
|---|---|---|
| H6.1 | Materializar riesgos importados en la matriz PMO | Riesgos conservan issueKey y versión inicial |
| H6.2 | Materializar épicas/tareas en backlog PMO | Jerarquía y responsables se mantienen o quedan pendientes explícitos |
| H6.3 | Incorporar documentos disponibles | Archivos se almacenan en S3 con metadatos y relación correcta |
| H6.4 | Asociar Deal financiero confirmado | La selección es humana; la sincronización financiera reutiliza el flujo actual |
| H6.5 | Ejecutar análisis agéntico posterior | Usa SoW y Gantt realmente homologados, no datos inventados |

### Fase H7 — Experiencia unificada y sincronización continua

**Objetivo:** eliminar diferencias de uso entre proyectos nativos e importados.

| ID | Trabajo | Criterio de aceptación |
|---|---|---|
| H7.1 | Unificar ProjectDetail y acciones por etapa | `origin` no oculta funciones; solo muestra procedencia |
| H7.2 | Habilitar Consola y Dashboard Ejecutivo v2 | Mismas métricas, tooltips y reglas para ambos orígenes |
| H7.3 | Añadir botón “Sincronizar ahora” | Permisos y estado de carga visibles; no duplica datos |
| H7.4 | Crear historial Jira por proyecto | Muestra última ejecución, duración, cambios y errores |
| H7.5 | Implementar reintento de pendientes | Reprocesa solo fallos y conserva resultados exitosos |
| H7.6 | Programar sincronización periódica | Se activa después del piloto, con ejecución observable y alertas |

### Fase H8 — Piloto, migración y despliegue

**Objetivo:** validar con un proyecto real antes de homologar el portafolio.

| ID | Trabajo | Criterio de aceptación |
|---|---|---|
| H8.1 | Seleccionar un proyecto piloto | Proyecto con Jira activo, hitos y evidencia suficiente; decisión del usuario |
| H8.2 | Ejecutar dry-run completo | Informe de impacto aprobado antes de escribir |
| H8.3 | Homologar el piloto | Seis etapas, dashboard, finanzas y Jira operan con el modelo canónico |
| H8.4 | Comparar antes/después | No se pierden issues, documentos, baseline ni registros financieros |
| H8.5 | Estabilizar y desplegar por lotes | Un checkpoint por lote; rollback disponible |
| H8.6 | Migrar vinculados existentes | Cada proyecto pasa por preflight y conciliación; no existe migración masiva ciega |

## 8. Batería de pruebas

| Nivel | Prueba | Resultado esperado |
|---|---|---|
| Unitario | Clasificación de issue types y estados | Mapeo determinista para payloads conocidos |
| Unitario | Reconciliación de fechas | Baseline nunca cambia por actualización de `duedate` |
| Unitario | Idempotencia | Dos sincronizaciones iguales producen el mismo estado |
| Unitario | Estado semántico | Cerrado, vencido, en riesgo y pendiente coinciden con el motor actual |
| Integración | Preflight Jira read-only | No genera escrituras ni transiciones Jira |
| Integración | Importación inicial | Conteos de creados/actualizados/omitidos coinciden con el reporte |
| Integración | Fallo parcial | Un proyecto con error no bloquea los restantes |
| Integración | Finanzas | Deal confirmado conserva IDs y asociaciones existentes |
| Seguridad | Roles | `admin`/`pmo` incorporan; permisos de `pm` se prueban según política aprobada |
| UI | Wizard | Guardado, reanudación, alertas y confirmación funcionan en desktop y móvil |
| Regresión | Pipeline nativo | Crear un proyecto desde cero mantiene exactamente el comportamiento vigente |
| Producción | Smoke test del piloto | Consola, detalle, Dashboard Ejecutivo v2, sincronización y cierre cargan sin errores |

Las pruebas no deben crear proyectos persistentes en la base productiva. Los tests puros utilizarán fixtures sanitizados y las verificaciones contra Jira serán de solo lectura, salvo las operaciones explícitamente autorizadas durante el piloto.

## 9. Estrategia anti-loop y sincronismo de versiones

La ejecución se realizará por fases cerradas. Cada fase debe producir un artefacto verificable —migración, test, vista, reporte o reconciliación— antes de avanzar. Se aplicarán los siguientes controles:

| Control | Aplicación |
|---|---|
| Checkpoint previo | Antes de cada bloque multiarchivo o migración |
| Checkpoint posterior | Solo con Vitest focal aprobado, TODO actualizado y verificación visible |
| Máximo de intentos | Tres intentos por enfoque; después se cambia estrategia o se reporta bloqueo |
| Piloto único | No migrar múltiples proyectos hasta cerrar la validación del primero |
| Dry-run obligatorio | Preflight e informe de impacto antes de escribir datos |
| Rollback | Se restaura por checkpoint; nunca mediante `git reset --hard` |
| Reconciliación | Todo lote entrega conteos y excepciones; sin artefacto no se considera completado |
| Sin datos ficticios | Faltantes se mantienen como `[PENDIENTE]` o `[POR CONFIRMAR]` |

## 10. Secuencia y estimación relativa

La implementación recomendada se organiza en cuatro entregas controladas. La estimación es relativa porque depende de la diversidad real de los proyectos Jira y de la disponibilidad de documentos históricos.

| Entrega | Fases | Resultado | Complejidad relativa |
|---|---|---|---|
| E1 — Base segura | H0–H2 | Persistencia, preflight y diagnóstico sin escritura | Media |
| E2 — Homologación | H3–H5 | Wizard, seis etapas, baseline e importación inicial | Alta |
| E3 — Cobertura completa | H6–H7 | Riesgos, documentos, finanzas y experiencia unificada | Alta |
| E4 — Adopción | H8 | Piloto, estabilización y migración por lotes | Media/alta |

## 11. Decisiones requeridas antes de implementar

| Decisión | Recomendación |
|---|---|
| Tratamiento de etapas históricas sin evidencia | Dejarlas `in_progress` con brecha visible; no autocerrarlas |
| Configuración Jira no corporativa | Aceptarla con diagnóstico de compatibilidad; no reemplazar schemes automáticamente |
| Baseline cuando solo existe `duedate` Jira | Crear borrador provisional y exigir aprobación humana |
| Permiso del PM para sincronizar | Permitir al PM asignado ejecutar sincronización; mantener onboarding y mapeo en `admin`/`pmo` |
| Dirección de sincronización | Jira → PMO para observaciones; PMO → Jira solo para acciones explícitas existentes |
| Proyecto piloto | Elegir un proyecto vinculado activo con datos completos y baja criticidad operativa |
| Activación periódica | Después de validar al menos dos sincronizaciones manuales consecutivas sin diferencias no explicadas |

## 12. Criterio de término

La homologación se considerará completa cuando un usuario no necesite conocer el origen del proyecto para gestionarlo. Tanto un proyecto nativo como uno incorporado desde Jira deberán permitir las mismas acciones, usar las mismas seis etapas, alimentar la Consola y el Dashboard Ejecutivo v2 con las mismas reglas, mantener baseline y evidencias auditables, sincronizar Jira de forma idempotente y cerrar administrativamente bajo los mismos controles.

La única diferencia permanente será la trazabilidad de origen y el historial del proceso de incorporación.
