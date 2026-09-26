# Reporte de Cobertura y Cumplimiento Documental

**Fecha:** 26-sep-2026  
**Checkpoint base:** `bec4f06a`  
**Alcance:** proyectos PMO y servicios recurrentes

## Propósito

La ruta **Reportes → Evidencia documental** deja de ser una portada de recibos técnicos. Su vista principal responde:

1. Qué entidades abiertas tienen brechas documentales activas.
2. Qué requisitos cumplen y con qué evidencia.
3. Qué archivos existen pero aún no acreditan cumplimiento.
4. Qué obligaciones no pueden medirse por falta de una regla persistida.
5. Qué expedientes históricos tienen brechas, sin convertirlas en trabajo operativo automático.

El historial de cargas se conserva en una pestaña secundaria para auditoría y gestión técnica.

## Fuentes locales

El read model usa consultas locales en lote sobre proyectos, servicios, usuarios, SoW, Gantt, documentos vinculados, baseline ejecutivo, hitos contractuales, actas, minutas, planes de recuperación, aprobaciones de etapa, cierre PMO, documentos/controles/reportes de servicios y snapshots ejecutivos. No consulta Jira/JSM en vivo ni escribe en sistemas externos.

## Reglas principales

- **Proyecto abierto:** `activo`, `en_progreso`, `pausado` o `suspendido`.
- **Proyecto histórico:** `completado` o `cancelado`.
- **Servicio abierto:** `activo` o `suspendido`.
- **Servicio histórico:** `finalizado` o `cancelado`.
- Un archivo sin aprobación, control o vínculo formal se muestra como **Pendiente de validación**, no como cumplimiento.
- Sin calendario persistido de reportes, el estado es **Por confirmar**; no se inventan períodos vencidos.
- Las actas se exigen sólo para hitos con cierre Jira o aceptación persistida.
- Las minutas no se miden sin una cadencia semanal explícita.
- Un plan de recuperación sólo es exigible con un gatillo persistido.
- Las brechas de entidades históricas se muestran como **Antecedentes del expediente** y no generan acciones operativas.

## Contrato visual

La vista principal incluye:

- KPIs del alcance filtrado y fecha de corte.
- Filtros de ciclo de vida, tipo de entidad, estado, cliente, responsable y búsqueda.
- Tarjetas por entidad con cobertura medible, cumplimiento, pendientes de validación y aspectos por confirmar.
- Acciones contextuales sólo para obligaciones activas y exigibles.
- Detalle expandible por requisito con evidencia visible y explicación de su estado.
- Alerta de calidad para SoW huérfanos que se preservan sin asignarlos a entidades vigentes.
- Pestaña **Historial de cargas** con recibos, adjuntos, expiraciones y descartes.

## Validación real

Con corte 25-sep-2026, el universo local contiene 15 entidades: 11 abiertas y 4 históricas.

- **Tanner, CCLA y Staffing:** abiertos, cobertura medible 100% y sin acciones falsas por requisitos no confirmados.
- **Camanchaca:** abierto; contrato, SoW y plan de trabajo presentes pero pendientes de validación; tres acciones activas.
- **Caja Los Andes, Ruta Pass y MaxAgro:** históricos; conservan brechas del expediente sin acciones operativas automáticas.
- **Calidad:** 16 SoW históricos sin entidad vigente se informan como alerta y no alteran coberturas.

## Acceso y seguridad

- Lectura del reporte: Admin, PMO, PM y Consulta.
- Descartar/restaurar recibos: sólo Admin.
- La interfaz no expone tokens, hashes, file keys ni URLs internas.
- La compactación visual no elimina registros ni trazabilidad histórica.
