# Análisis — Cierre de pipeline de etapas (MaxAgro 210001, Ruta Pass 300001)
Fecha: 2026-08-19

## Problema reportado por el usuario
El proyecto MaxAgro muestra badge "Completado" (status=completado en projects) pero el pipeline sigue en "Avance Proyecto" (etapa 5/6) con "4 de 6 etapas completadas". El cierre administrativo previo sólo actualizó projects.status, no las etapas.

## Diagnóstico verificado en BD (project_stages)
Ambos proyectos tienen el MISMO estado de pipeline:
- sow, jira, risks, planning: status=completed, progress=100, completedAt con fecha
- design (Avance Proyecto): status=in_progress, progress=0, completedAt=NULL
- closure (Cierre): status=locked, progress=0, completedAt=NULL

## Modelo de datos (drizzle/schema.ts)
- project_stages: projectId, stageId enum(sow,jira,risks,planning,design,closure), status enum(locked,in_progress,completed), progress int, completedAt timestamp
- stage_closures: projectId, stageId, closedBy, closedByName, confirmationText, notes, closedAt
- projects.currentStage: enum(sow,jira,risks,planning,design,closure)

## Lógica de cierre (server/db.ts líneas 236-243)
unlockNextStage(projectId, completedStageId):
1. Marca la etapa completada: status=completed, progress=100, completedAt=now
2. Desbloquea la siguiente: status=in_progress
3. Actualiza projects.currentStage = siguiente etapa
Orden: sow → jira → risks → planning → design → closure

## Cálculo del frontend (ProjectDetail.tsx línea 364)
"{completedCount} de {STAGES.length} etapas completadas" — cuenta project_stages con status=completed.

## Lo que falta para cerrar el pipeline de cada proyecto
1. design (Avance Proyecto): marcar completed, progress=100, completedAt=now
2. closure (Cierre): marcar completed, progress=100, completedAt=now
3. projects.currentStage: actualizar a 'closure'
4. Registrar en stage_closures el cierre de design y closure (auditoría)
5. Registrar en audit_logs la acción

## Restricción del enum
projects.currentStage es enum que INCLUYE 'closure', por lo que currentStage='closure' es válido.

## Nota
La etapa "design" se muestra en la UI como "Avance Proyecto" (Dashboard Ejecutivo). La etapa "closure" es "Cierre / Lecciones Aprendidas".
