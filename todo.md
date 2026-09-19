# Prodigio PMO Platform — Restauración desde respaldo

- [x] H0: crear salvaguarda, caracterizar el flujo actual y fijar invariantes de homologación con pruebas.
- [x] H1: incorporar persistencia para onboarding Jira, mapeos, ejecuciones y excepciones auditables.
- [x] H1: implementar servicios idempotentes y pruebas focales de onboarding y trazabilidad.
- [x] H2: implementar preflight Jira de solo lectura con calidad de fechas, tipos, estados y duplicados.
- [x] H3: implementar asistente de identidad PMO y mapeo Jira revisable y reanudable.
- [x] H4: reemplazar el autocierre por reconstrucción auditable de las seis etapas con evidencia.
- [x] H4: implementar reconciliación controlada de estados heredados `completed` sin evidencia, sin falsificar cierres.
- [x] H4: validar materialización, seis cierres secuenciales, desbloqueos y cierre final mediante un repositorio persistente aislado.
- [x] H5: implementar baseline provisional, hitos y sincronización inicial idempotente.
- [x] H5: reemplazar toda aprobación automática Jira por propuesta `draft` y aprobación humana explícita.
- [x] H5: importar únicamente hitos mapeados, sin pesos financieros inventados y con fechas Jira separadas del baseline.
- [x] H5: registrar la importación inicial en historial, reutilizar reintentos y avanzar onboarding a `ready` solo después de aprobar.
- [x] H5: validar propuesta, edición, aprobación, sincronización y limpieza con pruebas focales y persistentes aisladas.
- [x] H5: demostrar por búsqueda y pruebas que ninguna ruta productiva autoaprueba baseline Jira.
- [x] H5: ejecutar nuevamente la prueba persistente opt-in y verificar por SQL la limpieza total de sus registros transitorios.
- [x] H6: homologar riesgos, backlog, documentos y asociación financiera confirmada.
- [x] H6: importar riesgos mapeados de Jira de forma idempotente, preservando estado, responsable y trazabilidad de origen.
- [x] H6: importar épicas, historias y tareas mapeadas al WBS canónico, conservando jerarquía y claves Jira.
- [x] H6: unificar SoW, Gantt y evidencias documentales sobre almacenamiento S3 y entidades existentes, sin duplicar archivos.
- [x] H6: procesar mappings aprobados `document` y `stage_evidence` sin crear archivos ni URLs ficticias, registrando excepciones documentales auditables cuando falte una referencia S3 real.
- [x] H6: documentar y probar que SoW/Gantt permanecen en `linked_project_documents` y las actas por hito en `executive_milestone_acceptances`, ambas con archivos S3 reales y sin sobrecargar entidades.
- [x] H6: exponer en el detalle del proyecto el estado real de documentos, actas, faltantes y excepciones de homologación.
- [x] H6: materializar el Deal confirmado por onboarding en `projects.dealId` y validar su existencia en `financial_data` sin inferencias.
- [x] H6: registrar corrida, excepciones y conteos por dominio con reintentos idempotentes y sin escrituras Jira.
- [x] H6: validar los cuatro dominios con pruebas focales, persistentes aisladas, limpieza SQL y verificación visual.
- [x] H7: unificar experiencia, sincronización manual, historial y ejecución continua controlada.
- [x] H7: auditar sincronizadores Jira, historial y callbacks periódicos existentes; fijar una única ruta Jira → PMO sin polling ni escrituras implícitas.
- [x] H7: implementar un motor determinista de conciliación para proyectos homologados `ready`, reutilizando mappings aprobados y preservando baseline, aceptación y campos PMO confirmados.
- [x] H7: registrar cada ejecución manual o diaria con huella, origen, conteos, excepciones y estado; los reintentos no deben duplicar ni formar loops.
- [x] H7: validar explícitamente que el runner registre corridas `scheduled` con fuente, operationId, conteos, excepciones y estado correctos, sin duplicación en reintentos.
- [x] H7: completar e integrar el callback diario H7 y ejecutar una prueba controlada que demuestre el registro auditable de una corrida programada.
- [x] H7: agregar en la interfaz una acción Admin/PMO “Sincronizar ahora” y un historial legible con última ejecución, resultado por dominio y faltantes explícitos.
- [x] H7: validar la tarjeta en un onboarding `ready` mediante un fixture persistente aislado, cubriendo botón, última ejecución, historial, resultados y faltantes sin tocar proyectos productivos.
- [x] H7: validar el contrato backend/UI mediante prueba persistente del helper real, fixture live con tRPC real y prueba del contenedor `ProjectDetail` con transporte tRPC controlado; no presentar esta última como E2E aislada.
- [x] H7: montar el contenedor `ProjectDetail` con respuesta H7 realista y verificar tarjeta, acción, historial y faltantes en el árbol integrado, manteniendo la validación backend real en pruebas separadas.
- [x] H7: corregir la navegación con anchors anidados en `ConsolaGobierno` y confirmar que el acceso al detalle no emite errores de runtime.
- [x] H7: implementar un callback diario autenticado, idempotente y acotado que omita proyectos no listos, continúe ante fallos parciales y no utilice temporizadores en proceso.
- [x] H7: publicar el callback antes de crear la programación diaria, conservar su identificador durable y comprobar una ejecución controlada sin modificar Jira.
- [x] H7: validar permisos, no-autocierre, no-autoaceptación, no-sobrescritura de baseline, limpieza de pruebas, build y experiencia visual en escritorio/móvil.
- [x] H8: ejecutar piloto, reconciliar resultados y estabilizar la migración por lotes.
- [x] Ejecutar validación integral, corregir regresiones y limpiar cualquier dato de prueba.
- [x] Guardar y publicar la versión final con documentación operativa y resultados del piloto.
- [x] Validar y documentar la estabilización H8 por lotes: elegibilidad, múltiples proyectos, parciales, errores, reintentos y no duplicidad más allá del piloto único.
- [x] Registrar en la bitácora y en un checkpoint específico el versionId, pruebas, resultados del piloto y estado final H7–H8.

- [x] Comparar el alta nativa y la incorporación desde Jira en las seis etapas, datos, evidencias, permisos y transiciones.
- [x] Diseñar el modelo objetivo para homologar proyectos Jira sin perder historia ni marcar etapas completadas sin evidencia.
- [x] Definir reglas de mapeo, sincronización inicial y continua, trazabilidad, reversibilidad e idempotencia.
- [x] Preparar un backlog por fases con criterios de aceptación, pruebas, riesgos, dependencias y estrategia de despliegue.
- [x] Entregar el plan de homologación para aprobación antes de implementar cambios funcionales.

- [x] Auditar si la plataforma ya permite incorporar un proyecto Jira existente y crear su estructura PMO vinculada; diagnóstico persistido en `docs/ANALISIS_INCORPORACION_PROYECTO_JIRA_EXISTENTE_2026-08-29.md`.
- [x] Identificar qué datos Jira se importan o sincronizan actualmente y qué componentes PMO todavía requieren configuración manual; inventario incluido en el diagnóstico.
- [x] Proponer el flujo objetivo, controles y backlog necesario sin modificar la aplicación hasta recibir aprobación; propuesta documentada sin cambios funcionales.

- [x] Ejecutar una nueva sincronización financiera desde Google Sheets y verificar los registros aplicados.
- [x] Sincronizar nuevamente los estados, fechas planificadas y fechas reales de cierre de los hitos desde Jira.
- [x] Validar por proyecto la consistencia de los hitos sincronizados y registrar incidencias sin fabricar datos.
- [x] Registrar como trabajo diferido la definición de fechas planificadas para `PCIAD4-11`, `PCIAD4-12` y `PCIAD4-13`: permanecen como `[PENDIENTE EN JIRA]` hasta contar con evidencia del usuario; no se modifica ni resincroniza el proyecto 180003 por ahora.

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
- [x] Corregir tipos implícitos del bloque Gantt (getTime, Date | null) y añadir el sistema de clases edv2-gantt-\* a index.css.
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
- [x] Montar handler POST /api/scheduled/syncFinancial en server/\_core/index.ts y validar TypeScript.
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

- [x] Crear sistema CSS cg-\* con variables del HTML de referencia (paleta oscura, tipografía DM Sans/JetBrains Mono)
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
- [x] Estilos CSS cg-\* para Zonas 3-6 (grid2, cards, hig, resto)
- [x] Validación TypeScript y pruebas Vitest

## Fase C+D — Consola de Gobierno PMO (Motor + Datos)

- [x] Migración SQL para tabla project_health_snapshot
- [x] Job/cron para capturar snapshot diario de salud por proyecto
- [x] Cálculo de deterioro real (ΔIGE vs corte anterior) en portfolioConsole
- [x] Tooltip de PA con desglose de fórmula en página /consola
- [x] Validación TypeScript y pruebas Vitest

## Fase C+D — Motor PA completo + snapshot de salud (COMPLETADA)

- [x] Tabla `project_health_snapshot` creada (migración 0033)
- [x] Job/cron para capturar snapshot diario de salud por proyecto (módulo healthSnapshot.ts)
- [x] Cálculo de deterioro real (ΔIGE vs corte anterior) en procedure portfolioConsole
- [x] Tooltip de PA con desglose de fórmula (severidad 40%, deterioro 25%, exposición 20%, mora 15%)

## Fase E — Fidelidad Visual Total (Consola de Gobierno PMO)

- [x] Barra proporcional de triage (6px height con segmentos de colores por %)
- [x] Pie de métricas globales (Exposición UF, P0 vencidas, PRD vencidos, deteriorados, mejoraron)
- [x] Motivo ejecutivo con cifra en negrita y texto secundario
- [x] Señales de mora mejoradas (chips con ◉ y color rojo para mora)
- [x] Grid de fila exacto (6 columnas: 58px PA | 1fr info | 96px IGE | 104px UF | 132px PM | 40px →)

## Backlog: Fallback Consola + Editor de Baseline (2026-08-20)

- [x] Helper db.ts: updateExecutiveMilestoneBaseline (actualiza baselineDate con auditoría)
- [x] Helper db.ts: createExecutiveBaselineWithMilestones (source aprobado + hitos desde Jira)
- [x] Fallback portfolioConsole: proyectos sin baseline usan executive_verdict + jira_spaces + financial_data
- [x] PA alternativo para proyectos sin baseline (severidad×0.5 + exposición×0.3 + (100-avanceJira)×0.2)
- [x] Procedure executive.getBaseline (source + hitos del proyecto)
- [x] Procedure executive.updateMilestoneBaseline (admin/pmo, con auditoría)
- [x] Procedure executive.createBaselineFromJira (admin/pmo, importa hitos Jira con duedates)
- [x] Consola: chip ámbar "Sin baseline" en filas con sinBaseline=true
- [x] Consola: motivo específico para proyectos sin baseline
- [x] ProjectDetail: card "Baseline Ejecutivo" entre Proyecto Vinculado y Documentos
- [x] Card: vista sin baseline con botón "Crear baseline desde Jira"
- [x] Card: tabla de hitos con baselineDate editable + guardar cambios
- [x] Tests Vitest: fallback portfolioConsole + procedures executive
- [x] Validación: TypeScript limpio + suite completa + 7 proyectos visibles en consola

## Consola: filtro de proyectos cerrados (2026-08-20)

- [x] Backend: portfolioConsole retorna también proyectos completados con estado final
- [x] Frontend: filtro/pestaña "Cerrados" en la cola priorizada con lista de proyectos cerrados
- [x] Tests + validación TypeScript + suite completa
- [x] Checkpoint publicado (383f1de4)

## Consolidado de Facturación — Primera iteración (F0+F1+F3+F4) (2026-08-20)

Decisiones del usuario: por etapas / sin integraciones externas (stubs [POR CONFIRMAR]) / curvas de pago como línea base desde billing_milestones / roles actuales (admin/pmo/pm/consulta)

- [x] F0: Auditoría de origen documentada + reclasificación inversión interna (360001, 390001, 450001)
- [x] F1: Migración 0034 — tablas contract, payment_schedule_item, revenue_event, invoice, credit_note, payment, uf_value, internal_investment
- [x] F1: Migración de datos — contratos desde financial_data, curvas de pago desde billing_milestones (línea base)
- [x] F3: Motor determinista server/financialEngine.ts (agregados ciclo, invariante, DSO/LAG, descalce, proyección, concentración, RF-01..08)
- [x] F3: Tests batería 12.1 (T-01..T-12) y 12.2 (R-01..R-12)
- [x] F4: Procedure tRPC financialConsolidated + página AdminFinanceConsolidado.tsx reemplazando /admin/finance
- [x] F4: Zonas 0-4 — cabecera, barra unidad UF, lectura periodo, embudo, 4 tarjetas brecha
- [x] Validación: TypeScript limpio + suite completa + invariante en producción
- [x] Checkpoint publicado

## Corrección: Eliminar sidebar propio del Consolidado de Facturación

- [x] Eliminar el sidebar propio (df-side) de FinancialConsolidated.tsx para que solo use el sidebar del layout de administración

## Consolidado de Facturación — Tema claro (2026-08-20)

- [x] Cambiar sistema CSS df-\* de tema oscuro a tema claro (fondo blanco, texto oscuro con contraste)
- [x] Verificar tabla detalle por contrato y todos los cuerpos/zonas con el nuevo tema
- [x] Checkpoint publicado

## Consola de Gobierno — Tema claro (2026-08-20)

- [x] Cambiar sistema CSS cg-\* de tema oscuro a tema claro (fondo blanco, texto oscuro con contraste)
- [x] Verificar contraste de fonts en todas las zonas (triage, cola priorizada, decisiones, causa raíz, higiene, estables, cerrados)
- [x] Checkpoint publicado

## Fix permisos baseline ejecutivo para PM (2026-08-20)

- [x] Corregir status de Eduardo Mercado de invitado a activo en BD
- [x] Cambiar updateMilestoneBaseline y createBaselineFromJira de adminOrPmo a adminOrPmoOrPm
- [x] Agregar middleware adminOrPmoOrPm en routers.ts
- [x] Verificar que Eduardo puede editar baseline desde la UI
- [x] Checkpoint publicado

## F2: Integración UF del día (2026-08-20)

- [x] Guardar secreto BCCH_API_TOKEN en el proyecto (guardado pero truncado a 30 chars por el sistema de secretos — findic.cl usado como fuente principal sin token)
- [x] Crear server/ufService.ts — fetch findic.cl (principal) + BCCh (fallback) + caché en uf_value
- [x] Agregar procedure tRPC portfolioConsole.ufDelDia
- [x] Reemplazar stubs [POR CONFIRMAR — Banco Central] en FinancialConsolidated.tsx con valor real ($40.860,60)
- [x] Test vitest del servicio UF (5/5 parsing, 2 skipped validación secreto truncado)
- [x] Checkpoint publicado (a47af6d3)
- [x] Gantt Dashboard v2: línea de corte corregida — left calc() que compensa 260px de labels + padding (f1fb81c9)
- [x] Reemplazar página de inicio (Home) por la Consola de Gobierno — / ahora muestra ConsolaGobierno, Home movido a /dashboard, menú actualizado
- [x] En la Consola: filas de proyectos cerrados ahora enlazan al detalle (/projects/:id) con hover y cursor pointer
- [x] Dashboard Ejecutivo v2 disponible para todos los proyectos — restricción piloto eliminada, fallback auto-baseline desde Jira, botón visible en todos los proyectos
- [x] Sincronizar datos financieros desde Google Sheets (financial_data) — 43 registros UPSERT via gws 2026-08-25
- [x] Sincronizar estados de hitos desde Jira — 22 hitos actualizados en executive_contract_milestones 2026-08-25

## Manual de homologación Jira H0–H7 (2026-08-29)

- [x] Inventariar el alcance realmente publicado de H0–H7 y distinguirlo de H8 pendiente.
- [x] Redactar un manual funcional para homologar un proyecto Jira paso a paso.
- [x] Explicar permisos, sincronización manual/diaria, datos actualizables y datos protegidos.
- [x] Documentar estados `[PENDIENTE]`/`[POR CONFIRMAR]`, excepciones, troubleshooting y limitaciones actuales.
- [x] Verificar el manual contra código, bitácora, checkpoints y estado operativo antes de entregarlo.

## Manual ilustrado para vincular un proyecto Jira existente (2026-08-29)

- [x] Auditar el flujo visible completo en Administración → Spaces Jira y Detalle de Proyecto.
- [x] Definir un guion visual con cada estado requerido desde selección hasta onboarding `ready`.
- [x] Preparar escenarios seguros que no modifiquen proyectos productivos y permitan capturar estados representativos.
- [x] Capturar pantallas reales de selección, diagnóstico, identidad, mapeo, activación, baseline, estado H6/H7 e historial.
- [x] Recortar y rotular las capturas para que cada acción y validación sea inequívoca.
- [x] Redactar un manual profesional con portada, índice, prerrequisitos, pasos, roles, controles, errores frecuentes y checklist final.
- [x] Verificar que el manual distinga claramente Jira cerrado, aceptación de cliente, baseline contractual y fecha Jira.
- [x] Verificar diseño, legibilidad, referencias visuales y exactitud contra la aplicación antes de entregar.
- [x] Diagnosticar el fallo de inserción en `jira_sync_log` al ejecutar el preflight de un proyecto Jira existente, identificando columna, valor y restricción exactos.
- [x] Corregir el registro de corridas de preflight sin truncar silenciosamente identificadores ni modificar datos Jira o proyectos productivos.
- [x] Agregar una prueba de regresión con una clave Jira y huella equivalentes al caso `PMOCCLSRPM`, cubriendo creación e idempotencia del log.
- [x] Validar el preflight completo en un escenario controlado y confirmar que el onboarding avanza sin errores ni registros duplicados.
- [x] Documentar la causa raíz, pruebas ejecutadas y checkpoint de la corrección del vínculo Jira existente.

## Incidente JSM en servicio recurrente Deal 4687 (2026-09-15)

- [x] Confirmar en modo lectura si la clave `PSCSC4S` y el nombre informado ya existen en Jira y si corresponden al mismo contrato/servicio recurrente.
- [x] Verificar en la base PMO el estado del servicio Deal 4687 y si falta persistir un vínculo JSM creado previamente.
- [x] Trazar la ruta `createJsmProject` desde la interfaz hasta `createJiraSpace`, incluyendo logs y auditoría del intento fallido.
- [x] Determinar si la causa es un reintento no idempotente, una colisión legítima o una creación Jira exitosa con persistencia local incompleta.
- [x] Diseñar un plan de remediación seguro con preflight de unicidad, recuperación/vinculación controlada y mensajes de error accionables, sin modificar Jira durante el diagnóstico.

## Nueva categoría Staffing en servicios recurrentes (2026-09-16)

- [x] Auditar el contrato actual de `serviceType` en esquema, procedimientos, formularios, filtros y KPIs.
- [x] Incorporar el valor interno `staffing` mediante un cambio de esquema aditivo compatible con los registros existentes.
- [x] Aceptar y persistir `staffing` en los procedimientos de creación y edición de servicios recurrentes.
- [x] Mostrar Staffing en el formulario de creación, filtros, listados, detalle y métricas del módulo.
- [x] Añadir pruebas de regresión para creación, persistencia, filtrado y conteo de servicios Staffing.
- [x] Ejecutar validación focal, TypeScript/build y revisión visual antes de guardar el checkpoint.

## Vinculación de Spaces JSM existentes a servicios recurrentes (2026-09-16)

- [x] Auditar el flujo actual de Administración > Spaces Jira y determinar qué componentes pueden reutilizarse para JSM.
- [x] Auditar la etapa JSM Setup del servicio recurrente, su modelo de datos, permisos, sincronización de tareas y condiciones de cierre.
- [x] Definir el preflight de solo lectura para descubrir, validar y clasificar Spaces JSM existentes sin modificar Jira/JSM.
- [x] Definir reglas de asociación, unicidad, idempotencia, desvinculación controlada, auditoría y tratamiento de conflictos.
- [x] Diseñar la experiencia de usuario para buscar, revisar y confirmar el vínculo de un Space JSM desde el servicio recurrente.
- [x] Preparar un backlog por fases con archivos, dependencias, pruebas, migraciones, criterios de aceptación y controles anti-loop.
- [x] Documentar y presentar la recomendación para aprobación antes de implementar cambios funcionales.

## Implementación de vinculación de Spaces JSM existentes (J0–J7)

- [x] J0: confirmar contrato canónico, cardinalidad uno-a-uno, alcance sin importación automática y política de desvinculación.
- [x] J1: ampliar el modelo con origen, nombre, URLs separadas, verificación, mapeos y corridas auditables; aplicar migración aditiva e índices seguros.
- [x] J2: implementar lectores paginados de Service Desks, detalle, permisos, proyecto e issue types usando solo operaciones GET.
- [x] J3: implementar listado, preflight, asociación idempotente, revalidación, auditoría y desvinculación controlada.
- [x] J4: implementar mapeos explícitos de issue types, dry-run y sincronización segura sin asociación por título.
- [x] J4: definir y persistir mappings activos `work_plan` y `billing` usando únicamente issue types disponibles del proyecto JSM vinculado.
- [x] J4: implementar dry-run determinista que clasifique elementos pendientes, ya sincronizados, bloqueados y errores antes de cualquier POST Jira.
- [x] J4: reemplazar la dependencia fija de `Task` y desactivar fallbacks implícitos al sincronizar elementos recurrentes.
- [x] J4: ejecutar la sincronización solo mediante confirmación explícita asociada a un dry-run vigente, con idempotencia y auditoría.
- [x] J4: alinear la validación de cierre de `jira_setup` para exigir todos los elementos aplicables de plan de trabajo y facturación.
- [x] J4: cubrir mappings, dry-run, vínculo por `jiraIssueKey`, no-asociación por título, guardas de cierre y ausencia de escrituras antes de confirmar.
- [x] J5: construir el flujo Crear/Vincular en JSM Setup con búsqueda, diagnóstico, confirmación y estados accesibles.
- [x] J5: presentar una elección inequívoca entre crear un Space nuevo y vincular un Service Desk existente, sin ejecutar acciones al seleccionar una opción.
- [x] J5: implementar búsqueda del catálogo JSM con estados de carga, vacío, error, vínculo ocupado y selección accesible.
- [x] J5: mostrar el preflight completo del candidato, sus bloqueos, advertencias, permisos, identidad y mappings faltantes antes de habilitar la confirmación.
- [x] J5: exigir confirmación explícita y usar la corrida vigente para asociar localmente el Space sin escribir en Jira/JSM.
- [x] J5: mostrar el vínculo activo con origen, salud, última verificación, URLs separadas y acciones de revalidar/desvincular según rol.
- [x] J5: exigir motivo al desvincular y presentar de forma accionable el bloqueo por `jiraIssueKey`, sin cerrar `jira_setup` automáticamente.
- [x] J5: validar estados de interfaz y permisos Admin/PMO versus PM/consulta con pruebas focales, build y revisión visual.
- [x] J6: crear Administración > Spaces JSM con inventario, filtros, vínculo visible, salud y permisos Admin/PMO.
- [x] J6: exponer un inventario protegido que combine catálogo JSM, vínculos PMO, salud, origen y servicio asociado sin escrituras externas.
- [x] J6: agregar filtros por texto, estado de vínculo, salud y origen con contadores consistentes y estados de carga/error/vacío.
- [x] J6: crear la ruta y navegación Administración > Spaces JSM manteniendo la arquitectura visual existente.
- [x] J6: permitir acceso al servicio recurrente vinculado y mostrar acciones administrativas solo a Admin/PMO.
- [x] J6: validar permisos, filtros, datos heredados, responsive, TypeScript/build y revisión visual sin modificar Jira/JSM.
- [x] J7: ejecutar pruebas unitarias y persistentes focales, TypeScript/build, validación visual, documentación y publicación final.
- [x] J7: ejecutar la matriz integral J0–J6 con pruebas unitarias, persistentes aisladas y lectores live GET-only.
- [x] J7: verificar por SQL la limpieza total de fixtures y la integridad de vínculos productivos sin asociar ni modificar Spaces reales.
- [x] J7: revisar permisos, cardinalidad, idempotencia, stale-preflight, no-importación automática, no-autocierre y desvinculación protegida.
- [x] J7: validar en escritorio y móvil JSM Setup e inventario Spaces JSM, incluyendo carga, error, vacío y solo lectura.
- [x] J7: consolidar manual operativo para crear, vincular, mapear, simular, sincronizar, revalidar y desvincular de forma segura.
- [x] J7: registrar resultados, limitaciones y deudas heredadas, cerrar el backlog J0–J7 y publicar el checkpoint final.

## Limpieza controlada de datos de prueba — ACME y usuarios

- [x] Inventariar servicios recurrentes asociados inequívocamente a ACME y todas sus dependencias, sin modificar datos.
- [x] Inventariar cuentas inequívocamente de prueba y separar cuentas ambiguas o con actividad real.
- [x] Identificar los registros visibles en las capturas 323 y 324 y cruzarlos con sus IDs reales en la base.
- [x] Clasificar cada registro mostrado como eliminable, ambiguo o protegido según dependencias y actividad.
- [x] Presentar al usuario el diagnóstico de eliminación antes de ejecutar cualquier borrado.
- [x] Generar un respaldo exportable de los registros candidatos y sus relaciones antes de eliminar.
- [x] Eliminar en orden seguro las dependencias y servicios recurrentes ACME seleccionados, registrando auditoría.
- [x] Eliminar o desactivar, según integridad referencial, las cuentas de prueba seleccionadas sin afectar usuarios reales.
- [x] Verificar por SQL que no quedan candidatos ni registros huérfanos y validar el funcionamiento de la aplicación.
- [x] Documentar el inventario, respaldo, eliminación y controles ejecutados.
- [x] Conservar las 15 tablas físicas `backup_cleanup_acme_20260916_*`, incluido el manifiesto y el registro de ejecución, sin eliminarlas.
- [x] Confirmar 0 referencias productivas a los usuarios eliminados y preservar las 7 cuentas reales `@prodigio.tech`.

## Rediseño radical del dashboard de servicios recurrentes — planificación

- [x] Auditar el dashboard actual de servicios recurrentes y documentar qué preguntas de gestión responde y cuáles no.
- [x] Inventariar las fuentes reales disponibles para cartera, compromisos de facturación, facturación ejecutada, entregables mensuales, formalidad contractual, incidentes, SLA y tipología de servicio.
- [x] Evaluar calidad, completitud, periodicidad y trazabilidad de cada dato, sin inventar indicadores ausentes.
- [x] Definir el modelo ejecutivo objetivo con KPIs, semáforos, tendencias, segmentaciones, alertas y navegación al detalle.
- [x] Establecer reglas deterministas para salud del servicio, cumplimiento de reportes, cumplimiento SLA, exposición financiera y formalidad documental.
- [x] Diseñar la arquitectura de información y las zonas visuales del nuevo dashboard para vista portafolio y vista por servicio.
- [x] Preparar un backlog de implementación por fases con dependencias, migraciones, procedimientos, componentes, pruebas y guardrails de sincronización.
- [x] Definir criterios de aceptación funcionales, de datos, permisos, rendimiento, accesibilidad y validación visual.
- [x] Presentar el plan recomendado al usuario para aprobación antes de realizar cambios funcionales.

## Implementación Dashboard de Servicios Recurrentes V2 — D0–D10

- [x] R0: verificar rama, HEAD, remotos, árbol local, migraciones y estado de la base antes de modificar código o datos.
- [x] R0: fijar una línea base reproducible de los tres servicios productivos y crear salvaguarda antes de cualquier reconciliación.
- [x] D0: implementar un contrato versionado de métricas para contratado, programado, facturado, cobrado, vencido, reportes, SLA, incidentes, formalidad y salud.
- [x] D0: cubrir con pruebas unitarias las reglas multimoneda, fecha de corte, estados N/D y semáforo determinista.
- [x] D1: implementar diagnóstico de calidad por servicio para Deal, moneda, tipo, contrato, documentos y vínculo JSM.
- [x] D1: corregir únicamente inconsistencias productivas confirmadas, con respaldo, auditoría y verificación posterior.
- [x] D2: ampliar de forma aditiva el modelo para evidencias de reportes, formalidad documental, facturación/cobro verificable y snapshots JSM/SLA.
- [x] D2: aplicar y verificar una migración reversible con índices, relaciones, auditoría y pruebas persistentes aisladas.
- [x] D3: construir una API consolidada de portafolio con filtros, fecha de corte, KPIs, series, matriz y calidad de datos calculados en servidor.
- [x] D3: eliminar semánticas ambiguas de “Facturado” y “Cumplimiento SLA” y cubrir las fórmulas con pruebas.
- [x] D4: construir la Torre de Control V2 con filtros persistentes, KPIs trazables, matriz maestra y bandeja de excepciones.
- [x] D4: mantener convivencia V1/V2 durante el piloto y validar navegación, permisos, responsive, accesibilidad y estados vacíos/error.
- [x] D5: implementar programado vs. facturado vs. cobrado, vencimientos, tendencia mensual, moneda y reconciliación financiera por Deal.
- [x] D6: implementar heatmap de reportes, evidencia de entrega/aceptación y panel de formalidad documental.
- [x] D7: implementar lectura JSM de incidentes, prioridades, antigüedad, primera respuesta y resolución, sin fabricar cumplimiento cuando falten datos.
- [x] D7: persistir snapshots e historial de SLA/incidentes con degradación explícita por falta de vínculo, permiso o timeout.
- [x] D8: construir la vista 360° por servicio con Resumen, Finanzas, Entregables, Incidentes y SLA, y Documentación.
- [x] D9: extraer un runner común e idempotente para actualización manual/programada JSM, con resultados success/partial/error/skipped y auditoría estructurada.
- [x] D9: exponer historial paginado de corridas y presentarlo en la Torre V2 con frescura, origen, conteos y degradación visible.
- [x] D9: montar callback Heartbeat cron-only con validación durable de task UID, orphan 2xx, límite de lote y diagnóstico JSON de errores.
- [x] D9: publicar el callback, activar el job diario de proyecto, persistir su task UID, ejecutar una corrida controlada e inspeccionar logs.
- [x] D10: ejecutar pruebas unitarias, persistentes y funcionales, revisión visual responsive, seguridad de roles, rendimiento y no regresión.
- [x] D10: documentar operación, resultados, limitaciones y rollback; guardar y publicar el checkpoint final certificado.

## Incidencia — Camanchaca muestra proyecto Jira pero actualización JSM lo omite

- [x] Revisar la evidencia adjunta y distinguir el proyecto Jira visible de un Service Desk JSM confirmado.
- [x] Trazar el registro productivo de Camanchaca, el vínculo JSM persistido y la condición exacta usada por el refresco.
- [x] Corregir la causa si existe una inconsistencia funcional o de datos, sin escribir ni modificar tickets Jira/JSM.
- [x] Probar permisos, elegibilidad, actualización e interfaz; documentar el diagnóstico y publicar un checkpoint recuperable.
- [x] Respaldar el registro local y las dependencias JSM de Camanchaca antes de reparar el vínculo.
- [x] Ejecutar preflight GET-only y confirmar localmente el Service Desk `365` mediante el runner homologado.
- [x] Actualizar snapshots JSM de Camanchaca y verificar auditoría, historial, elegibilidad y presentación en la Torre.

## Limpieza de proyectos y servicios de prueba — 2026-09-18

- [x] Ejecutar gate R0 de sincronismo y confirmar `main`, `origin/main` y `user_github/main` alineados en `be752523`, con árbol limpio.
- [x] Inventariar en modo lectura proyectos y servicios recurrentes, separando candidatos inequívocos de registros productivos.
- [x] Crear y verificar un respaldo físico y exportable de los candidatos y todas sus dependencias antes del borrado.
- [x] Eliminar únicamente los registros inequívocos de prueba y sus dependencias, sin tocar Jira/JSM ni los tres servicios productivos.
- [x] Verificar ausencia de candidatos y residuos del lote, validar conteos productivos y documentar la intervención.

## Remediación de identidad y duplicidad de proyectos — 2026-09-18

- [x] Ejecutar gate R0 y diagnosticar los registros `2280001` y `2670001` sin modificar datos.
- [x] Respaldar íntegramente y eliminar sólo el proyecto duplicado `2280001`, preservando `2670001` y sin reconciliar montos.
- [x] Incorporar una llave de nombre normalizado con restricción única en `projects` y migración reversible.
- [x] Bloquear nombres duplicados en alta y edición, y reutilizar el proyecto existente compatible durante la homologación Jira.
- [x] Mostrar el identificador `PMO-{id}` en listado, inicio, detalle, consola y vistas ejecutivas principales.
- [x] Cubrir regresiones, aplicar la migración, ejecutar build y revisión visual, y guardar checkpoint final.

## Torre de Control de Servicios Recurrentes — integración del kit 2026-09-18

- [x] Ejecutar gate R0 y confirmar base `042e18c` limpia y alineada con ambos remotos.
- [x] Integrar fielmente el kit entregado sólo en `client/src/pages/recurring/`, sin backend, esquema ni endpoints nuevos.
- [x] Corregir compatibilidad responsive, permisos del CTA, estados N/D, evidencia vacía, multimoneda, orden de cola y pestaña inicial.
- [x] Añadir regresiones para los casos de compatibilidad sin alterar el contrato de métricas 2.0.
- [x] Ejecutar pruebas recurrentes, comparar TypeScript con la línea base y generar build productivo.
- [x] Validar Torre V2, Clásico y Lista con datos reales y roles vigentes; guardar checkpoint final.

## Subpáginas de Servicios Recurrentes — ejecución 2026-09-18

- [x] S0: Fijar rama, checkpoint y línea base reproducible.
- [x] S1: Integrar literalmente el nuevo detalle del servicio y retirar Vista 360 heredada.
- [x] S2: Corregir compatibilidad del detalle: acciones, evidencia, finanzas, errores, refresco y permisos.
- [x] S3: Integrar contrato de compuerta JSM con salud real y autoridad del servidor.
- [x] S4: Reordenar JSM Setup por cirugía de render preservando sus seis mutaciones.
- [x] S5: Certificar JSM Setup con tests de roles, mismatch, mappings, dry-run y cierre sin escrituras productivas.
- [x] S6: Certificar ambas páginas en escritorio/móvil y guardar checkpoint final.

## Panel de control ejecutivo — ejecución 2026-09-18

- [x] R0: Confirmar checkpoint `0a7df6ff`, refs alineadas, rama limpia y línea base de cinco errores TypeScript heredados.
- [x] B1: Integrar motor ejecutivo puro, fuente de datos y endpoint `projects.executive`.
- [x] B2: Integrar Home y componentes preservando prevención de nombres duplicados, ID PMO y permisos.
- [x] B3: Certificar datos reales, multimoneda, N/D, orden por urgencia, roles y responsive.
- [x] B4: Documentar, guardar checkpoint final y dejar el árbol limpio.

## Portafolio de proyectos — ejecución compatible 2026-09-18

- [x] P0: Confirmar checkpoint `7c2700cf`, refs alineadas, árbol limpio y conflicto del parche documentado.
- [x] P1: Extender el motor con `portfolio` preservando riesgos confirmados, plazos efectivos y extensiones válidas.
- [x] P2: Integrar view model, filtros y tabla densa preservando ID PMO, anti-duplicidad, permisos y borrado protegido.
- [x] P3: Certificar filtros, orden, multimoneda, N/D, roles, accesibilidad y datos reales.
- [x] P4: Documentar, guardar checkpoint final y dejar la rama limpia.

## Sincronización financiera durable — cuenta de servicio 2026-09-18

- [x] F0: Confirmar causa raíz, checkpoint `5b4c29a`, refs alineadas y job existente `koZvKFb8FE7TZ6hy8GAnvM`.
- [x] F1: Implementar autenticación Google renovable con cuenta de servicio y pruebas sin secretos.
- [x] F2: Incorporar preflight, hash, validación estricta y aplicación transaccional sin borrados.
- [x] F3: Homologar callback con UID durable, lock de concurrencia y códigos de error operacionales.
- [x] F4: Mejorar historial con último éxito, frescura y diagnóstico por fase sin revelar credenciales.
- [x] F5: Respaldar configuración, cargar el secreto protegido y ejecutar preflight real.
- [ ] F6: Publicar, ejecutar corrida controlada y certificar el siguiente ciclo del Heartbeat existente.
