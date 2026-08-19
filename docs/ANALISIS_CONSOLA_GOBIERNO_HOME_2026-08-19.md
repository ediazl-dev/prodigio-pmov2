# Análisis de la Consola de Gobierno PMO — Fase A (Zonas 0-2)
Fecha: 2026-08-19
Fuente: /home/ubuntu/upload/consola-gobierno-pmo-home.html (635 líneas)

## Paleta de colores CSS (variables)
```css
--fondo: #0B1120
--panel: #111A2B
--panel-2: #16213A
--panel-3: #1B2942
--linea: #22304A
--linea-suave: #1A2438
--texto: #E8EDF5
--texto-2: #93A4C0
--texto-3: #5D6E8C
--magenta: #E71F71
--cyan: #00BFFF
--rojo: #FF4D57
--ambar: #FFB020
--verde: #2FD69A
--azul: #5B8DEF
--sans: "DM Sans"
--mono: "JetBrains Mono"
```

## Estructura visual
- Grid: `236px sidebar + 1fr main`
- Sidebar: logo Prodigio, grupos de nav (Gobierno, Análisis, Administración), pie con usuario y fecha de corte
- Main: padding 26px 30px 60px, max-width 1500px

## Zona 0 — Barra de Triage (.triage)
- 5 botones de estado: Crítico (rojo, gatillos absolutos), Rojo (IGE<50), Naranjo (IGE 50-69), Amarillo (IGE 70-84), Verde/Estables (sin acción)
- Barra proporcional de colores (ancho = % de proyectos por estado)
- Pie: Exposición UF en riesgo, Exigencias P0 vencidas, Planes recuperación vencidos, Deteriorados, Mejoraron, total proyectos productivos

## Zona 1 — Encabezado dinámico
- Eyebrow: "Consola de gobierno · [día de la semana] [fecha]"
- H1: "[N] proyectos requieren tu atención hoy"
- Sub: descripción del estado más crítico
- Acciones: "Exportar comité" + "＋ Nuevo proyecto"

## Zona 2 — Cola Priorizada (.lista)
- Encabezado: "Requieren atención" + cuenta "N de M" + nota de fórmula PA
- Filtros: Todos, Míos, Deteriorándose, Sin evidencia, Con decisión pendiente, Ocultar prueba
- Filas (.fila) con grid: `58px PA | 1fr info | 96px IGE | 104px UF | 132px PM | 40px →`
- Columna PA: número 0-100 con color por estado
- Columna info: nombre, cliente/deal, chip de estado, chip de gatillos, motivo (texto), meta (alertas)
- Columna IGE: valor + delta (▼/▲ con color)
- Columna UF: valor en riesgo
- Columna PM: nombre del PM
- Border-left de 3px con color por estado (critico=rojo+gradiente, rojo, naranjo, amarillo, verde)

## Motor de Priorización PA
PA = (severidad × 0.4) + (deterioro × 0.25) + (exposición × 0.2) + (mora × 0.15)
- severidad: CRÍTICO=100, ROJO=75, NARANJO=50, AMARILLO=25, VERDE=0
- deterioro: 0 en Fase A (sin snapshot previo), escalar 0-100 según gatillos activos
- exposición: UF en riesgo / max_UF_portafolio × 100
- mora: hitos vencidos sin acta / total hitos exigibles × 100

## Tablas verificadas (schema.ts)
- executive_project_sources: dealId, jiraProjectKey, sourceStatus, approvedAt
- executive_contract_milestones: milestoneCode, title, billingWeight, baselineDate, jiraIssueKey, jiraDueDate, jiraClosedDate, isCritical
- executive_milestone_acceptances: acceptedAt, evidenceUrl, acceptanceStatus
- executive_meeting_minutes: isoWeek, reviewStatus
- executive_commitments: commitmentStatus, dueDate
- executive_requirements: priority, requirementStatus, dueDate
- executive_recovery_plans: recoveryStatus, dueDate
- executive_governance_assignments: governanceRole, personName, active
- executive_financial_snapshots: financialData JSON
- executive_dashboard_snapshots: cutoffDate, governanceState, metrics JSON
- executive_verdicts: semaphore, createdAt
- executive_verdict_reviews: reviewStatus, createdAt
- financial_data: dealId, pm, valorVentaUF, presupuestoUF, utilizadoUF
- projects: id, projectName, clientName, status, pmId, jiraProjectKey
- users: id, name, email, role

## Notas de implementación
- La consola usa su propia paleta CSS oscura (variables --cg-* para no colisionar con edv2-*)
- No hay valueUf por hito fuera del motor; retainedUf se calcula como billingWeight × valorVentaUF / 100 para hitos vencidos sin acta
- El motor de gobernanza ejecutivo (executiveGovernanceEngine.ts) produce IGE, estado, gatillos G-01..G-07, CHC_T, CHC_G, DRC, CPI_H, UF retenidas, DESCALCE
- Para la Fase A, el deterioro se aproxima a 0 (sin snapshot previo)
- La consola convive con la página de inicio actual (no la reemplaza)
- Visible para todos los roles (admin, pmo, pm, consulta)
