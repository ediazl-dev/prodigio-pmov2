# H7 — Decisión de sincronización Jira → Prodigio PMO

**Fecha:** 29 de agosto de 2026  
**Decisión aprobada:** opción A, sincronización manual más conciliación diaria determinista.

## Alcance aprobado

H7 debe reutilizar el modelo de onboarding y las entidades canónicas implementadas en H0–H6. La dirección automática será exclusivamente Jira → PMO. El usuario podrá ejecutar una sincronización manual desde la interfaz y el sistema realizará una conciliación diaria en segundo plano, sin usar polling frecuente, sin invocar sesiones agénticas y sin escribir en Jira.

| Alternativa evaluada | Decisión | Motivo |
|---|---|---|
| Manual + conciliación diaria | Aprobada | Menor riesgo de loops, operación determinista, reintentos idempotentes y ausencia de costo por créditos en cada ejecución. |
| Webhook + conciliación diaria | Diferida | Jira Cloud lo soporta, pero exige configuración administrativa, endpoint seguro, deduplicación y operación adicional. |
| Solo manual | Descartada para H7 | Reduce complejidad, pero no garantiza actualización periódica del portafolio. |

## Evidencia externa conservada

Atlassian documenta que los webhooks de Jira Cloud usan callbacks HTTPS, pueden filtrar eventos de issues con JQL y evitan el polling periódico. También documenta reintentos de entrega y el encabezado `X-Atlassian-Webhook-Identifier`, por lo que una futura implementación por eventos tendría que deduplicar payloads. La administración manual de webhooks requiere el permiso global **Administer Jira**.

Estas capacidades sustentan que la opción webhook es viable, pero no forman parte de H7 aprobado.

## Referencias

[1]: https://developer.atlassian.com/cloud/jira/platform/webhooks/ "Atlassian Developer — Jira Cloud platform webhooks"
[2]: https://support.atlassian.com/jira-cloud-administration/docs/manage-webhooks/ "Atlassian Support — Manage webhooks"
