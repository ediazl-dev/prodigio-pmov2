# Estado — Botón "Sincronizar ahora" (2026-08-19)

## Objetivo
Agregar botón "Sincronizar ahora" en la vista /admin/financial-sync que ejecuta la sincronización manualmente.

## Progreso
- [x] Fase 1: Análisis — runFinancialSync(triggeredBy) ahora acepta "cron"|"manual" (server/financialSync.ts)
- [x] Fase 2: Procedure syncNow (adminOnly.mutation) añadido al financialRouter en routers.ts (después de latestSync). TypeScript limpio (0 errores).
- [ ] Fase 3: Botón en AdminFinancialSync.tsx con estados de carga/resultado y refresco del historial
- [ ] Fase 4: Validar TypeScript, pruebas y checkpoint

## Datos clave para Fase 3
- Archivo: client/src/pages/admin/AdminFinancialSync.tsx (134 líneas)
- Query actual: trpc.financial.syncLogs.useQuery({ limit: 100 }) → variable `logs`, `isLoading`
- Mutation a usar: trpc.financial.syncNow.useMutation({ onSuccess: () => utils.financial.syncLogs.invalidate() })
- Resultado de syncNow: { timestampUtc, inputDeals, insert, update, status: "applied" }
- Estilos disponibles en adminStyles: C (colores: C.accent=#e91e8c, C.green, C.red, C.navy, C.g100-g400, C.blue2), headerGradient, cardStyle, thStyle, tdStyle, badgeStyle
- Iconos lucide ya importados: RefreshCw, CheckCircle2, XCircle, Clock, Database
- Patrón de utils: const utils = trpc.useUtils(); luego utils.financial.syncLogs.invalidate()
- Botón va en el header junto al badge "{total} registros" (línea 59-61)
- Resultado se muestra como banner bajo el header o junto al botón
