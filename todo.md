# Prodigio PMO Platform — Restauración desde respaldo

- [x] Reemplazar el esqueleto inicial por el código fuente restaurado del respaldo `prodigio-pmo-main.zip`.
- [x] Restaurar el esquema completo de Drizzle y las 27 migraciones de base de datos para las entidades PMO requeridas.
- [x] Validar aceptación de invitaciones y vinculación OAuth para cada rol: `admin`, `pmo`, `pm` y `consulta`.
- [x] Corregir el identificador temporal de invitaciones para que soporte correos largos dentro del límite de base de datos.
- [x] Restaurar el DashboardLayout y el dashboard principal con marca Prodigio, color `#e91e8c`, fuente Poppins, KPIs y listado de proyectos.
- [x] Validar específicamente el pipeline de seis etapas y el desbloqueo posterior a la aprobación de SoW.
- [x] Ejecutar y documentar una prueba funcional del SoW agéntico, desde extracción a aprobación.
- [x] Corregir la persistencia de borradores SoW para que la extracción vacía o parcial no infrinja restricciones de base de datos.
- [x] Generar un borrador SoW estructurado a partir de los metadatos disponibles cuando el proveedor de IA responda sin contenido.
- [x] Validar las cuatro categorías exactas de riesgos, el versionado y la exportación a Excel.
- [x] Añadir y ejecutar una prueba no omitida que cubra explícitamente PERT, ruta crítica, hitos, Gantt y backlog del módulo de planificación sin depender de una variable live.
- [x] Calcular y normalizar en servidor la estimación PERT de cada tarea para no depender de valores aproximados del modelo de IA.
- [x] Ejecutar y registrar evidencia verificable de los flujos SoW y planificación después del cambio de modelo, o documentarlos como validaciones opt-in.
- [x] Añadir una prueba no omitida de la contingencia WBS y backlog cuando la IA devuelva una estructura vacía.
- [x] Ejecutar y registrar una validación exitosa del DOCX del SoW, además del DOCX y PPTX de avance.
- [x] Ejecutar y registrar una prueba dirigida de interfaz para la descarga DOCX que compruebe la mutación, URL y nombre de archivo resultantes.
- [x] Eliminar trazas diagnósticas temporales de respuestas IA para evitar registrar contenido de proyecto en consola.
- [x] Validar lecciones aprendidas, compliance y registros de auditoría dentro del módulo de cierre.
- [x] Validar explícitamente el panel admin para usuarios, token Jira, plantillas, auditoría y compliance.
- [x] Restaurar el módulo de servicios recurrentes y su pipeline propio.
- [x] Instalar y fijar las dependencias compatibles con el código restaurado.
- [x] Aplicar migraciones a la base de datos gestionada y verificar su consistencia.
- [x] Configurar las credenciales externas necesarias mediante variables seguras, sin incorporarlas al código.
- [x] Robustecer la verificación de conectividad de Pipedrive frente a fallos transitorios de red.
- [x] Ejecutar compilación estática, suite Vitest y corregir errores de restauración.
- [x] Corregir la cobertura de las seis etapas y el aislamiento de datos que afectan las pruebas de deadlines.
- [x] Actualizar la configuración corporativa PPDC y los tiempos de prueba de Jira según el entorno restaurado.
- [x] Validar la interfaz de las rutas principales en escritorio y móvil.
- [x] Guardar una versión recuperada verificable.
- [x] Entregar al usuario el checkpoint recuperado y orientarlo para publicar desde la interfaz de administración.
- [x] Aplicar y verificar en código los cambios de branding visibles del dashboard con la marca Prodigio.
- [x] Auditar y corregir la nomenclatura visible restante del dashboard y la navegación para asegurar consistencia con Prodigio.
- [x] Sustituir la nomenclatura heredada en las comunicaciones de invitación por la marca Prodigio.
- [x] Capturar evidencia visual verificable del branding Prodigio antes de guardar la recuperación.
- [x] Corregir el desbordamiento horizontal detectado en las vistas principales para pantallas móviles.
- [x] Aplicar Poppins como tipografía principal global de Prodigio.
- [x] Normalizar los tokens y acentos visuales al color de marca exacto `#e91e8c`.
- [x] Corregir el ancho y la cuadrícula del perfil en móvil, y alinear sus acentos compartidos al color exacto `#e91e8c`.
- [x] Aplicar una grilla adaptativa al perfil para que sus dos columnas se apilen cuando no haya ancho suficiente.
- [x] Migrar los datos operativos reales desde la instancia anterior de Prodigio PMO, preservando relaciones, etapas, documentos y configuraciones válidas.
- [x] Inspeccionar el respaldo importable recibido, validar su estructura y compatibilidad con el esquema actual antes de importar datos.
- [x] Preparar un lote de importación no destructivo que excluya el DDL heredado, adapte identidades OAuth y preserve únicamente las relaciones de negocio compatibles.
- [x] Eliminar de forma auditada los registros transitorios generados por las pruebas para conservar exclusivamente los datos migrados reales.
- [x] Analizar el respaldo de continuidad de archivos, clasificar sus contenidos y determinar su relación con los proyectos migrados.
- [x] Diagnosticar la falla de generación de riesgos IA para [PMO] CCLA SRP MVP1 Deal 4728 e identificar su causa raíz antes de aplicar correcciones.
- [x] Crear un checkpoint recuperable y un respaldo de los riesgos existentes de CCLA antes de modificar el generador IA.
- [x] Sustituir el formato `json_object` del generador de riesgos por un JSON Schema estricto y añadir una ruta de recuperación segura ante respuestas LLM incompletas.
- [x] Ejecutar y registrar evidencia explícita de las pruebas automatizadas para la respuesta estructurada, los reintentos y el error detallado de generación de riesgos.
- [x] Validar la generación corregida con la versión de SoW que consume el flujo de [PMO] CCLA SRP MVP1 Deal 4728, sin reemplazar riesgos existentes hasta obtener un resultado válido.
- [x] Añadir y ejecutar una prueba automatizada del flujo de generación que cubra explícitamente reintentos, recuperación posterior y agotamiento de los tres intentos.
- [x] Elaborar y validar el backlog de implementación del Dashboard Ejecutivo v2, con SoW como fuente contractual, hitos leídos desde Jira y guardrails de sincronización de versiones.
- [x] Verificar la preparación contractual, documental, Jira y financiera del proyecto Tanner como piloto del Dashboard Ejecutivo v2.
- [x] Obtener y registrar la aprobación PMO de la auditoría F0 de KPIs, fuentes, denominadores y semáforo para el piloto Tanner antes de cambios de esquema o interfaz.
- [x] Persistir la aprobación F0 y crear el modelo versionado de fuente contractual, vínculo Deal-Jira y mapeo de hitos para Tanner.
- [x] Implementar el cálculo determinista de avance contractual, semáforo y evidencia trazable usando SoW y Jira.
- [x] Construir la experiencia Dashboard Ejecutivo v2 del piloto Tanner detrás de un feature flag y validarla sin alterar Jira.
- [x] Eliminar los registros transitorios restantes de la suite de pruebas y confirmar que el dashboard raíz conserva únicamente proyectos operativos.
- [x] Documentar con una consulta trazable el conjunto final de proyectos que alimenta el dashboard raíz tras la limpieza de datos de prueba.
- [x] Diagnosticar por qué la publicación muestra el dashboard heredado y no el Dashboard Ejecutivo v2 de Tanner, antes de modificar rutas o navegación.
- [x] Auditar y documentar todos los KPI actualmente renderizados, sus fórmulas, fuentes, denominadores y fechas de actualización en `DASHBOARD_EJECUTIVO_V2_AUDITORIA_KPI_v2.0.md` antes de rediseñar el Dashboard Ejecutivo.
- [x] Validar el modelo de gobierno v2: avance cardinal por hitos aceptados, jerarquía contractual-documental-operativa, semáforo único y prohibición de ponderación comercial en métricas de avance.
- [x] Diseñar el esquema versionado de hitos, evidencias de aceptación, minutas, compromisos, exigencias, planes de recuperación y veredictos inmutables.
- [x] Reemplazar en la consulta productiva el motor de avance ponderado por un motor determinista cardinal, auditable y cubierto por pruebas de borde.
- [x] Construir el flujo documental de minutas, extracción revisable de compromisos y cobertura de evidencia sin fabricar valores faltantes.
- [x] Implementar exigencias ejecutivas, responsables, plazos, criterios de aceptación, consecuencias y evidencia obligatoria de cierre, incluida anulación visible restringida al Gerente de Delivery con motivo auditable.
- [x] Rediseñar la ruta del Dashboard Ejecutivo para reproducir las seis zonas y la jerarquía visual del HTML de referencia, sin degradar la marca Prodigio ni la accesibilidad.
- [x] Integrar los ejes financiero y operativo como evidencia secundaria, incluyendo descalce de facturación, impacto en UF, confiabilidad del backlog y reglas de no-mejora por Jira.
- [x] Ejecutar el preflight inicial de sincronización y validar la base recuperable C0 antes de iniciar el rediseño.
- [x] Guardar y validar un checkpoint recuperable por cada incremento del rediseño v2 antes de continuar al siguiente bloque.
- [x] Ejecutar la batería de validación funcional, de datos, de permisos, visual y de no-regresión definida para el rediseño v2.
- [x] Configurar el fixture determinista del 17-ago-2026 separado de los datos productivos y conservar M01–M10 como nomenclatura contractual real de Tanner.
- [x] Registrar a Eduardo como PM y a Ariel como Gerente de Delivery en las reglas de responsabilidades del piloto ejecutivo Tanner.
- [x] Habilitar la incorporación de actas de aceptación de Tanner sólo cuando sean adjuntadas y mantener los hitos sin evidencia como no aceptados.
- [x] Habilitar para Admin/PMO el registro auditable de una minuta real, su URL de evidencia y compromisos manualmente revisados, sin extracción automática ni carga de datos ficticios.
- [x] Implementar una preclasificación determinista, no persistente y revisable de compromisos de minuta que nunca registra datos sin confirmación humana.
- [x] Calcular cobertura y continuidad documental de minutas contra semanas exigibles del baseline, sin presentar una sola minuta como cobertura completa.
- [x] Integrar la evidencia operativa de Jira con procedencia explícita y regla comprobable de no-mejora: sus métricas pueden generar penalizaciones, nunca elevar el avance contractual ni el estado ejecutivo.
- [x] Habilitar la creación de exigencias aprobadas por comité y su cierre con evidencia para Admin/PMO; restringir la anulación al Gerente de Delivery asignado con motivo explícito.
- [x] Verificar la sincronización financiera de Tanner y determinar si provee WACC, headcount bloqueado, tarifa diaria UF y cláusula de penalidad; rotular los valores ausentes como [POR CONFIRMAR] en `DASHBOARD_EJECUTIVO_V2_AUDITORIA_FINANCIERA_TANNER.md`.
- [x] Crear y validar un motor puro de gobierno cardinal que calcula CHC, exposición comercial aislada, impacto financiero, IGE, gatillos G-01 a G-07 y estado único sin usar pesos para avance.
- [x] Habilitar desde el detalle del piloto Tanner el acceso visible al Dashboard Ejecutivo v2 y conservar un acceso explícito al dashboard heredado.
- [x] Completar la paridad estructural del Dashboard Ejecutivo v2 con el HTML de referencia, incluidas las vistas derivadas/tabuladas y los bloques ricos restantes de la jerarquía aprobada.
- [x] Ejecutar y documentar una validación específica de accesibilidad del Dashboard Ejecutivo v2: teclado, foco visible, navegación, semántica y contraste.
- [x] Completar la paridad funcional y visual del Dashboard Ejecutivo v2 con los bloques faltantes del HTML: PRD detallado, descargos, escalamiento, carga/cobertura/coherencia de minutas y tablas ricas de señales secundarias.
- [x] Expandir las vistas derivadas CFO, Comercial y CTO para reflejar la estructura y densidad informativa de la maqueta aprobada, sin fabricar datos ausentes.
- [x] Documentar una validación de accesibilidad real del Dashboard Ejecutivo v2: contraste, navegación por teclado, orden de foco, semántica y estados interactivos.
- [x] Implementar la revisión formal del veredicto agéntico: observación persistida, validación por PMO/Admin, rechazo con motivo y prohibición de presentarlo como decisión ejecutiva antes de validarlo.
- [x] Habilitar el registro versionado de un PRD real, su evidencia y su aprobación restringida al Gerente de Delivery, sin declarar vigente un plan no aprobado.
- [x] Evitar que una consulta externa de Jira o finanzas bloquee la carga del Dashboard Ejecutivo v2; degradar a evidencia no disponible con procedencia explícita tras un límite de espera.
- [x] Ejecutar y registrar una comparación exhaustiva bloque a bloque entre la implementación y la maqueta HTML aprobada, dejando evidencia verificable de cada zona y vista derivada.
- [x] Completar una matriz formal de validación por rol (admin, pmo, pm y consulta) para visibilidad y acciones del Dashboard Ejecutivo v2.
- [x] Realizar una auditoría de accesibilidad verificable del dashboard completo: teclado, orden de foco, semántica, estados interactivos y contraste.
- [x] Demostrar con evidencia específica la paridad de PRD, descargos, escalamiento, cobertura/coherencia de minutas y señales secundarias frente a la maqueta.
- [x] Separar de forma estricta el fixture de validación del 17-ago-2026 de la consulta y rotulación productiva del Dashboard Ejecutivo v2 de Tanner.
- [x] Capturar evidencia verificable por bloque de PRD, descargos, escalamiento, cobertura/coherencia documental y señales secundarias en la sesión autenticada.
- [x] Fijar por prueba los bloques de descargos, escalamiento y la estructura detallada de señales secundarias frente a la maqueta aprobada.
- [x] Demostrar mediante pruebas de render o evidencia de interfaz la densidad informativa de las perspectivas CFO, Comercial y CTO.
- [x] Crear una matriz explícita en la documentación que compare, zona por zona y vista por vista, la maqueta HTML aprobada con la implementación y evidencia textual verificable.
- [x] Añadir pruebas de render/DOM para las perspectivas CFO, Comercial y CTO que fijen contenido mínimo, métricas y guardrails visibles.
- [x] Reforzar la evidencia autenticada del bloque documental (cobertura/coherencia) y de señales secundarias con extracciones verificables por subbloque.
- [x] Convertir las señales secundarias enriquecidas a una estructura tabular cuando la maqueta lo exija o documentar formalmente la equivalencia aprobada.
- [x] Restaurar una barra de navegación lateral específica para el Dashboard Ejecutivo v2, preservando su jerarquía visual, accesibilidad y acceso de retorno al proyecto.
- [x] Corregir la Línea de tiempo contractual para que represente las fechas baseline y reales conforme a la maqueta aprobada, sin inventar fechas de aceptación.
- [x] Diseñar e implementar la carga, validación y vinculación directa de documentos de evidencia para minutas, actas y PRD, reemplazando el ingreso manual de URL y actualizando la evidencia ejecutiva sólo después de una validación exitosa.
- [x] Restringir los archivos de evidencia a PDF para actas y PDF/DOCX para minutas y PRD, con un límite de 25 MB por archivo y revisión humana obligatoria antes de actualizar estados de gobierno.
- [x] Añadir una prueba explícita y evidencia autenticada de que el rail lateral incluye un acceso visible y funcional de retorno al detalle del proyecto Tanner, sin degradar accesibilidad ni jerarquía visual.
- [x] Corregir cualquier error JSX residual en `ExecutiveDashboardV2.tsx` y confirmar compilación limpia antes del checkpoint de navegación y cronograma.
- [x] Verificar en código y sesión autenticada que minutas, actas y PRD eliminaron la URL manual y usan exclusivamente selección de archivos validada.
- [x] Registrar evidencia verificable de las restricciones de formato, firma, MIME y 25 MB, más la no-actualización automática de aceptación, cobertura o vigencia tras una carga aislada.
- [x] Crear un checkpoint recuperable y respaldo auditable antes de eliminar registros de prueba.
- [x] Inventariar y validar los registros de prueba candidatos, excluyendo proyectos, etapas, documentos y relaciones operativas reales.
- [x] Eliminar sólo registros de prueba confirmados y sus dependencias, conservando trazabilidad de la operación.
- [x] Verificar la integridad posterior de los datos operativos y publicar el resultado de la limpieza.
- [x] Diagnosticar por qué el rail lateral del Dashboard Ejecutivo v2 no es visible en la ruta publicada revisada por el usuario.
- [x] Precisar y corregir la presentación de fechas baseline por hito, diferenciando datos ausentes de fechas reales disponibles en el baseline contractual.
- [x] Corregir la visibilidad efectiva del rail lateral propio del Dashboard Ejecutivo v2 en la ruta publicada, validando su renderizado autenticado y su retorno al proyecto Tanner.
- [x] Implementar la línea de tiempo contractual por hito con la fecha planificada de Jira como fecha comprometida, sin mostrar el marcador ambiguo "[POR CONFIRMAR]" cuando exista dicha fecha.
- [x] Incorporar la distinción entre cierre operativo en Jira y aceptación documental del cliente, con tolerancia exacta de cinco días entre ambas fechas.
- [x] Actualizar el motor cardinal, el contrato de datos, la interfaz temporal y sus pruebas de borde para los estados comprometido, pendiente de acta, vencido sin acta, aceptado y en riesgo.
- [x] Crear y validar un checkpoint recuperable antes de modificar el rail, el contrato de Jira o la línea de tiempo contractual de Tanner.
- [x] Persistir y sincronizar la fecha de cierre de la issue Jira vinculada, usando `resolutiondate` sin modificar actas ni aceptación existentes.
- [x] Añadir pruebas deterministas de la tolerancia de aceptación a los 0, 5 y 6 días desde el cierre operativo Jira.
- [x] Validar TypeScript, Vitest y la ruta autenticada de Tanner antes de publicar los ajustes del cronograma contractual.
- [x] Extraer el bloque exacto de la tabla temporal actual (líneas 255-256) a un archivo temporal para reemplazo quirúrgico.
- [x] Generar el nuevo bloque Gantt como archivo separado basado en la especificación preservada.
- [x] Aplicar el reemplazo quirúrgico en el componente usando script de sustitución exacta.
- [x] Actualizar las pruebas de aceptación para reflejar la nueva estructura del Gantt.
- [x] Validar compilación TypeScript y pruebas focales del Gantt.
- [x] Corregir tipos implícitos del bloque Gantt (getTime, Date | null) y añadir el sistema de clases edv2-gantt-* a index.css.
- [x] Publicar checkpoint con el Gantt contractual implementado.

## Línea base contractual desde carta Gantt Tanner (2026-08-18)
- [x] Analizar la carta Gantt Excel de Tanner y extraer hitos baseline y hitos de pago.
- [x] Mapear hitos BD (M01-M10) contra fechas baseline de la Gantt e identificar ambigüedades.
- [x] Confirmar con el usuario el mapeo ambiguo de M07 (Iniciador de Pagos), M08 y M09 (desfase numeración sprints).
- [x] Poblar `baselineDate` en `executive_contract_milestones` para los 10 hitos de Tanner desde la carta Gantt.
- [x] Exponer doble fecha en el contrato de datos: baseline Gantt (línea base) vs. jiraDueDate (comprometida replanificada).
- [x] Actualizar motor cardinal para clasificar contra baseline Gantt y reportar deriva vs. Jira replanificada.
- [x] Rediseñar Gantt visual: doble marcador baseline/Jira por hito, línea de corte calculada desde fecha de análisis (no fija 65%).
- [x] Corregir pérdida de textos en el Gantt (nombres de hitos y etiquetas de barras legibles, sin ellipsis cortante).
- [x] Actualizar pruebas de aceptación y del motor cardinal para la doble fecha y línea de corte dinámica.
- [x] Validar TypeScript, pruebas focales y publicar checkpoint con la línea base contractual.

## Mejora Gantt contractual — tooltips, estados y acta por hito (2026-08-19)
- [x] Analizar captura FireShot del dashboard en producción e identificar problemas del Gantt.
- [x] Confirmar con el usuario la regla de clasificación: VENCIDO (fecha pasada sin acta) vs. EN_RIESGO (futuro probable incumplimiento). Opción C: próximo a vencer O con deriva positiva.
- [x] Corregir `classifyMilestoneTimeline` en el motor cardinal: fecha Jira vencida sin acta → VENCIDO, no EN_RIESGO. EN_RIESGO = próximo a vencer (<=7d) O deriva positiva vs. baseline.
- [x] Implementar tooltips ricos por hito en el Gantt (fechas exactas, deriva en días, estado, peso, acta) con componente accesible. Tooltip grafito con grid de 6 campos, accesible por teclado (tabIndex, focus/blur, aria-label).
- [x] Añadir etiquetas de fecha visibles: "Base contractual" (rombo) y "Programada" (marcador Jira) en el Gantt. Etiquetas dd-mmm sobre el rombo y bajo el marcador, más tag de deriva en días sobre la franja.
- [x] Implementar carga de acta de aceptación por hito individual: botón "Registrar acta" en cada fila sin acta que preselecciona y bloquea el hito en el formulario (con opción "cambiar"), eliminando el riesgo de asociar el acta al hito equivocado.
- [x] Actualizar pruebas del motor cardinal y de aceptación para la nueva clasificación y carga por hito. Motor: 12/12; suite focal: 42/42 en 6 archivos.
- [x] Validar TypeScript, pruebas focales y publicar checkpoint. TypeScript limpio; 42/42 pruebas focales aprobadas.

## Sincronización financiera (2026-08-19)

- [x] Analizar guía de sincronización financiera y skill pmo-financial-sync.
- [x] Instalar dependencia pymysql y copiar script sync_financial_data.py al proyecto.
- [x] Exportar planilla Google Sheets (Artefactos_proyectos) a XLSX.
- [x] Ejecutar dry-run de validación y revisar resultado (insert/update/duplicados/rechazados).
- [x] Aplicar sincronización con --apply tras aprobar dry-run.
- [x] Verificar resultado en BD (status=applied, 0 rechazados, Deal conocido con syncedAt actualizado).

## Regla de tres fechas en Gantt + botón acta (2026-08-19)

- [x] Analizar caso M02 y confirmar regla de tres fechas con el usuario.
- [x] Implementar tercer marcador (estrella teal=acta) y doble franja de deriva en el Gantt.
- [x] Actualizar tooltip con tres fechas (base, Jira, real) y doble deriva (planificación, real).
- [x] Actualizar leyenda del Gantt con el marcador de fecha real.
- [x] Mejorar botón de carga de acta con estilo visual intuitivo (icono, texto claro, nombre de archivo).
- [x] Añadir clases CSS para el marcador estrella, doble deriva y botón de carga.
- [x] Validar TypeScript, pruebas focales y publicar checkpoint.

## Ejecución de los 3 puntos aprobados (2026-08-19)
- [x] Verificar dashboard financiero de Tanner con datos sincronizados (KPIs actualizados).
- [x] Leer skills de automatización y programar sincronización financiera recurrente (Heartbeat diario 03:00 UTC).
- [x] Limpiar directorio temporal tmp_sync (XLSX respaldado en webdev-static-assets) y cerrar todo.md.

## Automatización de la sincronización financiera (Opción B — Heartbeat en el servidor)
- [x] Aplicar parche legacy del SDK (manusTypes.ts taskUid + sdk.ts cron short-circuit).
- [x] Crear módulo server/financialSync.ts (descarga Drive API + parseo XLSX + UPSERT por Deal ID).
- [x] Montar handler POST /api/scheduled/syncFinancial en server/_core/index.ts y validar TypeScript.
- [x] Inyectar secret GOOGLE_DRIVE_TOKEN a producción (usa token del conector Google Workspace) y guardar checkpoint (deploy).
- [x] Crear cron diario 03:00 UTC con manus-heartbeat (task_uid koZvKFb8FE7TZ6hy8GAnvM; primera ejecución programada mañana 03:00 UTC).

## Historial de sincronización financiera y fecha en Dashboard v2 (2026-08-19)

- [x] Crear tabla financial_sync_log en el esquema Drizzle y aplicar migración (0032, con registro histórico de la sync de hoy).
- [x] Registrar cada ejecución de sincronización (éxito y error) en el log desde financialSync.ts.
- [x] Exponer procedure tRPC de historial de sincronizaciones (admin) y última sincronización (protegido).
- [x] Crear vista de administración con el historial de sincronizaciones (tabla con fecha, estado, deals, mensaje).
- [x] Registrar la ruta admin en App.tsx y entrada en el menú de administración.
- [x] Mostrar fecha/hora de la última sincronización en el Dashboard Ejecutivo v2.
- [x] Validar TypeScript y pruebas; guardar checkpoint.

## Botón Sincronizar ahora en historial de sincronizaciones
- [x] Crear procedure tRPC syncNow (admin) que ejecuta runFinancialSync manualmente.
- [x] Agregar botón Sincronizar ahora en AdminFinancialSync con estados de carga, resultado y refresco del historial.
- [x] Validar TypeScript y pruebas; guardar checkpoint.

## Cierre de proyectos finalizados y limpieza de prueba (2026-08-19)
- [x] Identificar proyectos MaxAgro (Deal 4532), Ruta Pass (Deal 1996) y proyectos de prueba.
- [x] Crear respaldo previo auditable de los datos afectados.
- [x] Marcar como cerrados los proyectos MaxAgro y Ruta Pass.
- [x] Eliminar proyectos de prueba en cascada con verificación.
- [x] Verificar resultado final y reportar.

## Cierre de pipeline de etapas — MaxAgro y Ruta Pass
- [x] Analizar modelo de etapas (project_stages, stage_closures, currentStage) y lógica de cierre
- [x] Diagnosticar estado real de las etapas de MaxAgro (210001) y Ruta Pass (300001)
- [x] Presentar plan de cierre de pipeline al usuario

## Ejecución del cierre de pipeline — MaxAgro y Ruta Pass
- [x] Crear respaldo previo de las filas de project_stages afectadas
- [x] Ejecutar cierre del pipeline en transacción (design + closure + currentStage + auditoría)
- [x] Verificar resultado final en BD y reportar

## Consola de Gobierno PMO — Fase A (nueva página de inicio /consola)
- [x] Releer HTML de referencia y extraer especificación visual de Zonas 0-2
- [x] Crear procedure tRPC portfolioConsole (agrega salud y prioridad por proyecto activo)
- [x] Construir página /consola con Zona 0 (barra de corte), Zona 1 (KPIs), Zona 2 (cola priorizada)
- [x] Registrar ruta /consola y entrada de navegación visible para todos los roles
- [x] Validar TypeScript, pruebas y publicar checkpoint

## Consola de Gobierno PMO — Fase A mejorada (fidelidad visual total)

- [x] Crear sistema CSS cg-* con variables del HTML de referencia (paleta oscura, tipografía DM Sans/JetBrains Mono)
- [x] Mejorar Zona 0: barra proporcional de colores + pie de métricas globales (exposición UF, P0 vencidas, PRD vencidos, deteriorados, mejorados)
- [x] Mejorar Zona 2: motivo ejecutivo con cifra en negrita, señales de mora, tooltip PA con desglose de fórmula
- [x] Corregir contraste de texto invisible (texto-3 sobre fondo oscuro)
- [x] Validar TypeScript y pruebas (473 aprobadas)

## Fase B — Consola de Gobierno PMO (Zonas 3-6)

- [x] Zona 3: Decisiones que te esperan (bandeja por rol con plazo e impacto UF)
- [x] Zona 4: Dónde se repite el daño (causa raíz agregada con top 4)
- [x] Zona 5: Higiene de gobierno (4 contadores accionables + hallazgo estructural)
- [x] Zona 6: Resto del portafolio (tabla colapsable de proyectos estables)
- [x] Procedure portfolioConsole extendido con datos de Zonas 3-6
- [x] Estilos CSS cg-* para Zonas 3-6 (grid2, cards, hig, resto)
- [x] Validación TypeScript y pruebas Vitest

## Fase C+D — Consola de Gobierno PMO (Motor + Datos)

- [ ] Migración SQL para tabla project_health_snapshot
- [ ] Job/cron para capturar snapshot diario de salud por proyecto
- [ ] Cálculo de deterioro real (ΔIGE vs corte anterior) en portfolioConsole
- [ ] Tooltip de PA con desglose de fórmula en página /consola
- [ ] Validación TypeScript y pruebas Vitest

## Fase C+D — Motor PA completo + snapshot de salud (COMPLETADA)
- [x] Tabla `project_health_snapshot` creada (migración 0033)
- [x] Job/cron para capturar snapshot diario de salud por proyecto (módulo healthSnapshot.ts)
- [x] Cálculo de deterioro real (ΔIGE vs corte anterior) en procedure portfolioConsole
- [x] Tooltip de PA con desglose de fórmula (severidad 40%, deterioro 25%, exposición 20%, mora 15%)
