# Estado del Backlog — Consola de Gobierno PMO (2026-08-20)

## Fases completadas
- Fase A: Zonas 0-2 básicas (triage, encabezado, cola priorizada) — checkpoint 46eadc2c
- Fase B: Zonas 3-6 (Decisiones, Causa raíz, Higiene, Resto portafolio) — checkpoint 7ec37860
- Fase C+D: Tabla project_health_snapshot (migración 0033), job captura diaria, deterioro real (ΔIGE), tooltip PA — checkpoint 93be1868
- Fase E: Fidelidad visual total — barra proporcional triage, pie métricas globales, motivo con cifra en negrita, señales de mora (◉ rojo), grid exacto 6 columnas (58px PA | 1fr info | 96px IGE | 104px UF | 132px PM | 40px →)

## Verificación Fase E (ya implementado en código)
- CSS: .cg-triage-barra (línea 765), .cg-triage-pie (776), .cg-motivo b (960), .cg-meta (965), .cg-mora (974) en client/src/index.css
- CSS: .cg-fila con grid-template-columns: 58px minmax(0,1fr) 96px 104px 132px 40px (línea 878)
- TSX: barra proporcional con 5 segmentos de color (líneas 198-204), pie con 6 métricas (207-215) en ConsolaGobierno.tsx
- TSX: motivo con <b> cifra en negrita (línea 313), señales con ◉ y clase cg-mora (316-321)

## Resultado
- Backlog del HTML de referencia: 100% implementado
- TypeScript: limpio
- todo.md: 0 ítems pendientes de la consola
