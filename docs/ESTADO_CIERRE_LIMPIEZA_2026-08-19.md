# Estado — Cierre de proyectos y limpieza de prueba (2026-08-19)

## Objetivo
1. Marcar como cerrados (status='completado') los proyectos finalizados:
   - Ruta Pass: ID 210001, "[PMO Ruta Pass] Plan Modernización TI - Deal 1996", etapa design
   - MaxAgro: ID 300001, "[PMO MaxAgro] Assessment | Deal 4532", etapa design
2. Eliminar 15 proyectos de prueba (cliente "Cliente de prueba") con respaldo previo.

## IDs de proyectos de prueba a eliminar (15)
1800001, 1800002, 1800003, 1800004, 1800005,
1830001, 1830002, 1830003, 1830004, 1830005,
1860001, 1860002, 1860003, 1860004, 1860005
Todos en etapas sow/jira (NO bloqueadas). Ninguno en design/closure.

## Conteo verificado
- Total proyectos: 31 = 15 prueba + 16 operativos
- Operativos a preservar: 16 (incluye Tanner 180002 y los 2 a cerrar)

## Respaldo creado (Fase 2 ✅)
- Directorio: /home/ubuntu/backups/cierre_proyectos_2026-08-19/
- MANIFEST.json: 17 proyectos respaldados (15 prueba + 2 cierre), 159 filas dependientes
- Tablas respaldadas: project_stages(90), sow_documents(6), wbs_tasks(36),
  billing_milestones(18), lessons_learned(3), stage_closures(3), jira_spaces(3)
- projects_backup.json: datos completos de los 17 proyectos

## Tablas dependientes de projects (30 con projectId) — orden de borrado en cascada
project_stages, sow_documents, risks, wbs_tasks, billing_milestones, gantt_uploads,
design_documents, lessons_learned, uploaded_files, sow_versions, stage_openings,
stage_deadline_extensions, deadline_notifications, stage_approvals, stage_closures,
jira_spaces, risk_versions, executive_verdicts, executive_verdict_reviews,
executive_project_sources, executive_contract_milestones, executive_milestone_acceptances,
executive_meeting_minutes, executive_commitments, executive_requirements,
executive_recovery_plans, executive_governance_assignments, executive_financial_snapshots,
executive_dashboard_snapshots, linked_project_documents

## Esquema projects (columnas reales)
- projectName, clientName, status (enum: activo|pausado|completado|cancelado)
- currentStage (enum: sow|jira|risks|planning|design|closure)

## Progreso
- [x] Fase 1: Análisis (2 a cerrar + 15 prueba identificados)
- [x] Fase 2: Respaldo auditable creado y verificado
- [ ] Fase 3: Cerrar MaxAgro y Ruta Pass (UPDATE status='completado' + audit_log)
- [ ] Fase 4: Eliminar 15 de prueba en cascada (30 tablas + projects) + audit_log
- [ ] Fase 5: Verificar resultado final y reportar

## Notas
- Auditoría: registrar DELETE_PROJECT por cada eliminado y CLOSE_PROJECT por cada cerrado.
- audit_logs usa entity_type='project', entity_id=CAST(id AS CHAR).

## Resultado final (verificado en BD)

| Métrica | Valor |
|---|---|
| Total proyectos | 16 |
| Proyectos de prueba restantes | 0 |
| Activos | 14 |
| Completados | 2 (Ruta Pass 210001, MaxAgro 300001) |
| Deletes auditados | 15 |
| Cierres auditados | 2 |

### Eliminación en cascada (174 filas)
- projects: 15
- project_stages: 90
- sow_documents: 6
- wbs_tasks: 36
- billing_milestones: 18
- lessons_learned: 3
- stage_closures: 3
- jira_spaces: 3
- audit_logs: 15 registros de auditoría insertados

### Nota de guardrail
El primer intento de eliminación hizo ROLLBACK porque el guardrail validaba el nombre del proyecto ("prueba") y el proyecto 1800002 se llama "Avance DOCX". Se corrigió el guardrail para validar por `clientName = 'Cliente de prueba'` (criterio más robusto) y la segunda ejecución hizo COMMIT OK. El rollback funcionó como protección esperada.

Respaldo íntegro en: /home/ubuntu/backups/cierre_proyectos_2026-08-19

## Cierre de pipeline (etapas) — 2026-08-19
- Causa raíz: el cierre administrativo previo actualizó projects.status pero no las etapas del pipeline (design quedó in_progress, closure locked).
- Acción: design y closure marcadas completed (progress=100), currentStage='closure', 2 registros en stage_closures por proyecto, audit_logs con motivo "Cierre administrativo — proyecto finalizado".
- Respaldo previo: /home/ubuntu/backups/cierre_pipeline_2026-08-19 (12 filas project_stages + 2 projects en CSV).
- Verificación: ambos proyectos 6/6 etapas completadas, status=completado, currentStage=closure. Transacción atómica con COMMIT OK.
