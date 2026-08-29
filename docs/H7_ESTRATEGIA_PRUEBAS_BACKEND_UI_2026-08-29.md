# H7 — Estrategia de validación backend/UI

La cobertura H7 separa deliberadamente tres niveles para evitar una afirmación de integración que no pueda demostrarse:

| Nivel | Evidencia | Alcance |
|---|---|---|
| Backend persistente | `server/jiraReconciliationPersistence.test.ts` crea un fixture aislado, ejecuta el runner y consulta `getJiraHomologationStatus` contra la base real. | Valida persistencia, idempotencia, protección de baseline y shape del resumen H7. |
| Aplicación live | El mismo fixture se mantuvo temporalmente disponible y se abrió `/projects/:id` en la aplicación real. | Valida que el tRPC productivo entregue el resumen a `ProjectDetail`; se revisaron botón, historial, resultados y faltantes en escritorio y móvil. |
| Contenedor UI automatizado | `client/src/pages/ProjectDetail.h7.integration.test.tsx` monta `ProjectDetail` completo con el transporte tRPC controlado. | Valida composición del contenedor, render de la tarjeta real y payload de la acción manual sin depender de OAuth, red o datos productivos. |

La prueba del contenedor **no es una prueba E2E por sí sola**. El transporte se mockea para mantener una prueba determinista, rápida y no destructiva; la integración con backend real queda cubierta por la prueba persistente y la inspección live sobre un fixture aislado con limpieza automática. Esta combinación evita fabricar datos productivos y permite localizar fallas de contrato, persistencia o presentación de forma independiente.
