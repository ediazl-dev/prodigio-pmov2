# Estado actual del proyecto Prodigio PMO — 2026-08-21

## Checkpoints en producción (más reciente primero)
- `f1fb81c9` — Corrección línea de corte Gantt Dashboard v2 (left calc compensando 260px labels)
- `a47af6d3` — Integración UF del día (findic.cl, stubs reemplazados en consolidado)
- `8c61d9ab` — Consola de Gobierno tema claro + BD limpia (10 proyectos prueba eliminados)
- `b6126071` — Consolidado de Facturación tema claro
- `eee30c99` — Corrección sidebar doble en FinancialConsolidated
- `7b8ceacc` — Permisos baseline para PM + fix status Eduardo Mercado
- `6a6a850f` — Fix frontend canManageBaseline para PM

## Trabajo completado hoy (2026-08-21)
1. **Tema claro Consolidado de Facturación** — variables df-* cambiadas a fondo blanco, texto oscuro
2. **Tema claro Consola de Gobierno** — variables cg-* cambiadas a fondo blanco, texto oscuro
3. **Limpieza BD** — 10 proyectos de prueba eliminados (quedan 11: 7 activos + 4 cerrados)
4. **Permisos Eduardo Mercado** — status corregido a activo, rol PM puede editar baseline (backend + frontend)
5. **Bug fix upsertUser** — usuarios invitados que hacen login con openId real se actualizan a activo
6. **Integración UF del día** — findic.cl como fuente principal (sin token), BCCh como fallback (token truncado por sistema de secretos, 30/60 chars)
7. **Corrección línea de corte Gantt** — left calc(260px + (100% - 260px - 32px) * X / 100 + 16px)

## Datos clave
- UF del día (findic.cl): $40.860,60 CLP (2026-08-21)
- Código serie UF BCCh: F073.UFF.PRE.Z.D (doble F)
- Token BCCh renovado: $2a$10$dvRriOu6TnVa5DsgB1EX2erST/Et1XHWDZTuNod7lfu.B1U9iRJ0m (60 chars, truncado a 30 por sistema de secretos)
- API findic.cl: https://findic.cl/api/uf (gratuita, sin auth)
- API BCCh: https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?user=EMAIL&pass=TOKEN&firstdate=YYYY-MM-DD&lastdate=YYYY-MM-DD&timeseries=F073.UFF.PRE.Z.D&function=GetSeries

## Proyectos activos (7)
- 180002: [PMO Banco Tanner] Implementacion SFA - Deal 1934 (único con baseline ejecutivo)
- 180003: [PMO Consalud] Implementación Apigee - Deal 4529
- 240002: [PMO Vida Cámara] Implementacion Apigee - Deal 2207
- 360001: [PMO Prodigio] Nexos SFA
- 390001: Producto_APIGEE_Implementación/Migración
- 450001: [PMO Prodigio] Producto Apigee
- 510001: [PMO_ST|Isapre Consalud] Servicio CloudOps|Deal 4687

## Proyectos cerrados (4)
- MaxAgro, Ruta Pass, Plan Vital, Caja los Andes

## Hitos Tanner (executive_contract_milestones, projectId=180002)
- M01 (02-02) y M02 (03-20): ACEPTADO con acta
- M03 (baseline 04-10, jira 07-27): VENCIDO_SIN_ACTA
- M05 (baseline 09-11, jira 08-03): VENCIDO_SIN_ACTA
- M06 (baseline 09-11, jira 08-10): VENCIDO_SIN_ACTA
- M08 (baseline 09-11, jira 08-17): VENCIDO_SIN_ACTA
- M04 (jira 10-02), M07 (jira 09-03), M09 (jira 08-25), M10 (jira 10-09): futuros

## Próximos pasos pendientes
1. F9: Exportación comité — PDF/Excel con resumen del portafolio
2. F10: Configuración de umbrales — alertas personalizables
3. Sincronización financiera automática (cron falla por GOOGLE_DRIVE_TOKEN — usar conector gws)
4. Dashboard Ejecutivo v2 en tema claro (opcional, para consistencia)
5. Revisar otros usuarios con status invitado que ya hicieron login
6. Verificar visualmente la corrección de la línea de corte en producción

## Archivos clave modificados hoy
- client/src/index.css — variables df-* y cg-* tema claro
- client/src/pages/FinancialConsolidated.tsx — stubs UF reemplazados, query ufDelDia
- client/src/pages/ConsolaGobierno.tsx — tema claro
- client/src/pages/stages/ExecutiveDashboardV2.tsx — línea de corte corregida
- client/src/pages/ProjectDetail.tsx — canManageBaseline incluye pm
- server/routers.ts — adminOrPmoOrPm middleware, ufDelDia procedure
- server/db.ts — upsertUser fix (status invitado → activo en login)
- server/ufService.ts — servicio UF (findic.cl + BCCh fallback + caché)
- server/ufService.test.ts — tests del servicio UF
