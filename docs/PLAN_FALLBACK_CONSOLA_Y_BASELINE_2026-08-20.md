# Plan: Fallback Consola + Editor de Baseline (autorizado por Keno 2026-08-20)

## Diagnóstico raíz
- `portfolioConsole` (routers.ts ~línea 6117-6551) llama `getExecutiveProjectSource(project.id)` por proyecto activo.
- Solo Tanner (180002) tiene `executive_project_sources` con sourceStatus="approved" (id=1, dealId=Deal1934, jiraProjectKey=PBTISD1, baselineVersion=v6).
- Los otros 6 activos retornan null → `return null` → desaparecen de la consola.
- Proyectos activos (7): 180002 Tanner, 180003 Consalud Apigee, 240002 Vida Cámara, 360001 Nexos SFA, 390001 Producto Apigee Impl, 450001 Producto Apigee, 510001 CloudOps Consalud.
- Completados (4): 210001 Ruta Pass, 240003 Plan Vital, 300001 MaxAgro, 330001 Caja los Andes.

## Datos disponibles para fallback (verificado en BD)
| Proyecto | jira_spaces | executive_verdicts (último) | jiraAdvance | financial_data |
|---|---|---|---|---|
| 180003 | PCIAD4 | ROJO | 22% | Deal4529, PM Aiza P, 1100 UF, 7.2% usado |
| 240002 | PVCIAD2 | (sin veredicto) | — | Deal2207, PM Aiza P, 397 UF, 0% usado |
| 360001 | PS | (sin veredicto) | — | Deal4669 (sin UF) |
| 390001 | PAI | AMARILLO | 79% | — |
| 450001 | PPPA | ROJO | 35% | — |
| 510001 | PSCSC4S | ROJO | 25% | — |
- Ninguno tiene: executive_contract_milestones, billing_milestones, sow_documents, wbs_tasks.
- Todos tienen project_stages 6/6 con design=in_progress.
- Tabla projects NO tiene columna dealId (dealId se extrae del nombre o de executive_project_sources).
- financial_data columnas: dealId, projectName, pm, valorVentaUF, utilizadoUFPorc, margenProyectadoPorc, etc. (sin columna status).

## Parte 1 — Fallback portfolioConsole
Cuando no haya baseline:
- estado = semáforo último executive_verdict (o AMARILLO "Sin evaluar" si no hay)
- ige proxy = jiraAdvance del veredicto (o null)
- exposición UF = financial_data por Deal ID (extraer "Deal NNNN" del projectName con regex /Deal\s*(\d+)/i → "Deal$1")
- pmName = financial_data.pm
- sinBaseline: true → chip ámbar "Sin baseline" + motivo "Proyecto sin baseline ejecutivo aprobado. Se evalúa con veredicto IA y datos Jira/financieros."
- PA alternativo = severidad×0.5 + exposición×0.3 + (100−avanceJira)×0.2 (sin deterioro ni mora)
- gatillos: [] ; hitosVencidos: 0 ; totalHitos: 0 ; requiereAtencion = estado !== "VERDE"

## Parte 2 — Card "Baseline Ejecutivo" en ProjectDetail.tsx
- Ubicación: entre card "Proyecto Vinculado" (~línea 278-303) y `<LinkedProjectDocuments>` (línea 305).
- Sin baseline: estado + botón "Crear baseline desde Jira" (admin/pmo).
- Con baseline: tabla hitos (código, título, baselineDate editable input date, jiraDueDate readonly, semanticStatus) + botón "Guardar cambios".

## Backend nuevo (routers.ts, router executive o similar)
- `getBaseline` (protected): source + hitos del proyecto.
- `updateMilestoneBaseline` (admin/pmo): input {milestoneId, baselineDate} → helper db + audit log.
- `createBaselineFromJira` (admin/pmo): input {projectId} → lee jira_spaces.jiraProjectKey, obtiene hitos Jira (épocas/versiones con duedate vía jiraClient), crea source aprobado + executive_contract_milestones (baselineDate=duedate, jiraIssueKey, billingWeight=100/n).

## Helpers db.ts nuevos
- `updateExecutiveMilestoneBaseline(milestoneId, baselineDate)` → UPDATE executive_contract_milestones SET baselineDate.
- `createExecutiveBaselineWithMilestones({projectId, dealId, jiraProjectKey, approvedBy, approvedByName, milestones[]})` → insert source (approved) + insert milestones.

## Notas técnicas
- Schema executive_contract_milestones: id, projectId, sourceId, milestoneCode, title, billingWeight(decimal 5,2), baselineDate(date string), jiraIssueKey, jiraStatusName, jiraDueDate, jiraClosedDate, semanticStatus(pending|fulfilled|delayed|blocked), isCritical.
- Schema executive_project_sources: projectId, dealId, jiraProjectKey, baselineVersion, contractFileName, contractFileUrl (notNull!), sourceStatus, approvedAt, approvedBy, approvedByName.
  - Para baseline desde Jira: contractFileName="baseline-jira-{key}", contractFileUrl="jira://{jiraProjectKey}" (placeholder válido, no ficticio: indica origen Jira).
- Piloto v2: EXECUTIVE_DASHBOARD_V2_PILOT_PROJECT_IDS = Set([180002]) en server/executiveDashboardV2.ts — NO tocar.
- Auditoría: usar helper audit() existente (skill pmo-audit-module) acción "update_baseline" / "create_baseline", entidad "executive_baseline".

## Reglas anti-loop activas
- Máx 3 intentos por herramienta; archivos grandes → scripts Python de reemplazo por strings.
- NUNCA leer routers.ts completo (~6500 líneas) ni ExecutiveDashboardV2.tsx completo.
- Checkpoint antes y después del bloque multiarchivo.
- Cada acción produce artefacto verificable.

## Checkpoints
- Pre-implementación: (crear ahora)
- Post-implementación: (crear al final)
- Producción actual: 2f26cdbd
