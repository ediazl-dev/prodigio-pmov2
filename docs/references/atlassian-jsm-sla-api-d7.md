# Referencia Atlassian JSM para D7

Fuente oficial consultada: [Jira Service Management Cloud REST API — Request](https://developer.atlassian.com/cloud/jira/service-desk/rest/api-group-request/).

## Datos confirmados

La API de Jira Service Management Cloud expone solicitudes mediante `GET /rest/servicedeskapi/request` y permite expandir `sla`, `requestType`, `serviceDesk` y `status`. La respuesta es paginada mediante `start`, `limit`, `isLastPage` y `values`.

Cada solicitud incluye identificadores de issue y Service Desk, fecha de creación, estado actual y enlaces de agente/portal. La misma familia de recursos expone los SLA de una solicitud individual en `/rest/servicedeskapi/request/{issueIdOrKey}/sla`, con cero o más registros y ciclos en curso o completados.

## Aplicación en Prodigio PMO

D7 utilizará exclusivamente operaciones GET. Los issues se enumerarán por proyecto con la API Jira existente y los SLA se consultarán por issue solamente cuando el servicio tenga vínculo JSM confirmado. Si Jira/JSM no entrega métricas medibles, la aplicación persistirá N/D o estado parcial; nunca inferirá cumplimiento desde la mera configuración de reglas SLA.
