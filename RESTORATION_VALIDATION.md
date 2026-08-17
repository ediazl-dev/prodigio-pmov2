# Validación de Restauración — Prodigio

Fecha de validación: 17 de agosto de 2026.

## Resultado consolidado

La restauración se validó mediante **394 pruebas automatizadas aprobadas en 33 archivos**, ejecutadas en modo secuencial. Tres pruebas que consumen IA o almacenan documentos de forma real se mantienen omitidas en la suite normal para prevenir consumo involuntario; se ejecutaron aparte y finalizaron correctamente. El resultado consolidado fue **394 aprobadas, 0 fallidas y 3 omitidas intencionalmente**. La comprobación estática de TypeScript y la compilación de producción finalizaron correctamente.

| Comprobación | Resultado | Evidencia |
|---|---:|---|
| Suite unitaria e integración | Aprobada | 394 pruebas en 33 archivos, sin fallos; 3 pruebas live omitidas intencionalmente |
| TypeScript | Aprobado | `pnpm check` finalizó sin errores |
| Compilación de producción | Aprobada | `pnpm build` completó correctamente |
| Integración Jira | Aprobada | Pruebas de cliente, avance, reportes, Spaces y PPDC |
| Integración Pipedrive | Aprobada | Verificación de credenciales y tolerancia a fallos transitorios |
| SoW con IA y PDF | Aprobada | Ejecución real controlada contra LLM integrado |
| Planificación con IA y contingencia | Aprobada | Prueba real de WBS/PERT/Gantt/backlog y prueba determinista ante respuesta vacía |
| Reportes DOCX/PPTX | Aprobada | Generación PPTX y DOCX de avance, más DOCX SoW almacenado y versionado |
| Interfaz escritorio y móvil | Validada | Capturas de dashboard, portafolio, perfil y administración |

## Cobertura por capacidad

| Capacidad restaurada | Validación aplicada | Estado |
|---|---|---|
| OAuth, usuarios, roles e invitaciones | `auth.logout.test.ts`, `invitations.test.ts`, `profile.test.ts` | Aprobado |
| Pipeline de seis etapas y deadlines | `pmo.test.ts`, `deadlines.test.ts`, `sowApprovalPipeline.test.ts` | Aprobado |
| SoW agéntico | `documentExtractor.test.ts`, `sowApprovalPipeline.test.ts`, `sowAgenticFlow.live.test.ts` | Aprobado |
| Riesgos, versionado y exportación Excel | `risksEnhanced.test.ts` | Aprobado |
| Planificación, avance y cierre | `planningAgenticFlow.live.test.ts`, `planningFallback.test.ts`, `executionDashboard.test.ts`, `stageClosure.test.ts`, `closureCompliance.integration.test.ts` | Aprobado |
| Jira PPDC, reportes y Spaces | `jira.test.ts`, `jiraClient.progress.test.ts`, `jiraReport.test.ts`, `jiraPPDC.test.ts`, `jiraSpaces.test.ts` | Aprobado |
| Finanzas y análisis ejecutivo | `financialData.test.ts`, `pmAnalysis.test.ts`, `pmAnalysisSchema.test.ts`, `verdictFiltering.test.ts` | Aprobado |
| Administración y auditoría operativa | `adminReadiness.integration.test.ts`, `deleteProject.test.ts`, `profile.test.ts`, `deadlines.test.ts` | Aprobado |
| Proyectos vinculados | `linkedProjects.test.ts`, `linkedProjectDocs.test.ts` | Aprobado |
| Servicios recurrentes | `recurringServices.test.ts` | Aprobado |

## Validaciones específicas de requisitos

| Requisito | Resultado |
|---|---|
| Seis etapas exactas de pipeline | Validado al crear un proyecto y mediante pruebas de plazos. |
| SoW aprobado desbloquea únicamente Jira | Validado: SoW pasa a `completed`, Jira a `in_progress` y las demás etapas permanecen bloqueadas. |
| SoW agéntico desde PDF | Validado con un PDF público de control: extracción, persistencia como borrador y aprobación posterior. |
| Cuatro categorías de riesgo | Validado en exportación: **Técnico**, **Oculto**, **Supuesto No Validado** y **Dependencia Externa**. |
| Rol PM | Incorporado en esquema, invitaciones, administración, perfil y layout. |
| Branding Prodigio | Revisado en dashboard, portafolio, perfil, navegación e invitaciones; usa Poppins y color primario `#e91e8c`. |

## Prueba live del SoW

La prueba `sowAgenticFlow.live.test.ts` está diseñada para evitar consumo involuntario en la suite normal. Se ejecuta exclusivamente cuando `RUN_LIVE_LLM_TESTS=true`. Durante esta restauración se ejecutó y aprobó en aproximadamente 5,4 segundos. La prueba verifica que el servicio integrado recibe un PDF, extrae contenido estructurado, guarda un SoW en estado `draft` y permite aprobarlo para desbloquear la etapa Jira.

## Pruebas live y de almacenamiento

Las pruebas `planningAgenticFlow.live.test.ts` y `sowAgenticFlow.live.test.ts` se ejecutaron explícitamente después de actualizar el modelo integrado. Ambas aprobaron: la primera verificó WBS con PERT normalizado, ruta crítica, hitos, Gantt y backlog; la segunda validó extracción, persistencia y aprobación de SoW. La prueba `documentGeneration.live.test.ts` también aprobó y verificó la generación, el almacenamiento seguro y el versionado de un documento SoW DOCX.
