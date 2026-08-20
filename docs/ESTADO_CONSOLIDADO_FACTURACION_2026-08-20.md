# Estado del Consolidado de Facturación — 2026-08-20

## Completado
- **F0**: Auditoría de origen — 38 deals en financial_data, 10 hitos Tanner con pesos, 2 actas
- **F1**: Modelo de datos — 8 tablas nuevas (contract, payment_schedule_item, revenue_event, invoice, credit_note, payment, uf_value, internal_investment), migración 0034 aplicada, 38 contratos migrados, 10 ítems curva pago Tanner, 2 revenue events
- **F3**: Motor determinista financialEngine.ts (220 líneas) — 13/13 tests aprobados
- **F4 parcial**: Procedure getFinancialConsolidated insertado en routers.ts, página FinancialConsolidated.tsx creada (298 líneas)

## Pendiente inmediato
1. Registrar la ruta /admin/financial-consolidated en App.tsx
2. Agregar entrada en el menú de administración en DashboardLayout.tsx
3. Verificar TypeScript limpio
4. Ejecutar suite completa de tests
5. Checkpoint y publicación

## Archivos clave
- server/financialEngine.ts — Motor determinista (calculateContractFunnel, calculatePortfolioFunnel)
- server/financialEngine.test.ts — 13 tests (batería 12.1/12.2)
- server/routers.ts — Procedure getFinancialConsolidated en portfolioConsoleRouter
- client/src/pages/FinancialConsolidated.tsx — Página con Zonas 0-4 + detalle por contrato
- drizzle/schema.ts — 8 tablas nuevas (líneas 994+)

## Datos migrados
- 38 contratos desde financial_data (Deal IDs como dealId)
- 5 contratos vinculados a projectId (Deal1934→180002, Deal4529→180003, Deal2207→240002, Deal4669→360001, Deal4687→510001)
- 10 ítems curva pago Tanner desde executive_contract_milestones (M01-M10 con pesos)
- 2 revenue events Tanner desde executive_milestone_acceptances (M01, M02 con actas)

## Decisiones del usuario
1. Implementación por etapas (F0+F1+F3+F4 primero)
2. Sin integraciones externas (stubs [POR CONFIRMAR])
3. Curvas de pago como línea base desde billing_milestones
4. Roles actuales (admin/pmo/pm/consulta)
