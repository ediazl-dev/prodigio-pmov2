# Fuentes oficiales para vinculación de Spaces JSM existentes

**Fecha de consulta:** 16 de septiembre de 2026

## Service Desks de Jira Service Management

Fuente: [Atlassian — Service desk API](https://developer.atlassian.com/cloud/jira/service-desk/rest/api-group-servicedesk/)

- `GET /rest/servicedeskapi/servicedesk` devuelve los Service Desks a los que el usuario autenticado tiene acceso.
- La respuesta es paginada e incluye, por cada Service Desk, `id`, `projectId`, `projectName`, `projectKey` y enlace `self`.
- Atlassian recomienda este endpoint para listar Service Desks o localizar uno por nombre o palabra clave.
- `GET /rest/servicedeskapi/servicedesk/{serviceDeskId}` devuelve el detalle de un Service Desk específico.
- El listado declara permiso requerido `Any`; el detalle requiere acceso al Service Desk, por ejemplo como administrador, agente o usuario autorizado.
- Para OAuth, el scope recomendado es `read:servicedesk-request`; el granular indicado es `read:servicedesk:jira-service-management`.

## Proyectos Jira y validación del tipo

Fuente: [Atlassian — Jira Cloud Projects API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/)

- Jira distingue proyectos `business`, `service_desk`, `software` y `customer_service`.
- Un proyecto JSM válido para este requerimiento debe identificarse como `projectTypeKey = service_desk`.
- El endpoint de proyectos solo devuelve aquellos sobre los cuales el usuario posee permisos de exploración o administración.
- La creación de proyectos requiere privilegios globales de administración; el nuevo flujo de asociación existente debe ser de solo lectura hasta la confirmación local.

## Autenticación, permisos y paginación JSM

Fuente: [Atlassian — Jira Service Management REST API introduction](https://developer.atlassian.com/cloud/jira/service-desk/rest/intro/)

- JSM se apoya en la plataforma Jira, por lo que pueden combinarse las APIs de Jira Cloud Platform y Jira Service Management.
- Para integraciones con autenticación básica, las rutas usan `https://<site>/rest/servicedeskapi/<resource>`.
- Las colecciones JSM son paginadas mediante `start`, `limit`, `size` e `isLastPage`; la implementación debe recorrer páginas y no asumir que la primera contiene todos los Spaces.
- Los códigos `401`, `403` y `404` deben distinguir autenticación, permisos insuficientes y recurso inexistente.
- El acceso de clientes puede ser público, abierto o cerrado; ese modelo de acceso no debe inferirse solamente desde el proyecto Jira y debe tratarse como diagnóstico complementario.

## Implicaciones para Prodigio PMO

1. La fuente canónica del selector debe ser `GET /rest/servicedeskapi/servicedesk`, no el listado general de todos los proyectos Jira filtrado únicamente por nombre.
2. El preflight debe cruzar `serviceDeskId`, `projectId`, `projectKey` y `projectName`, y confirmar además `projectTypeKey = service_desk` con la API de proyectos.
3. Los resultados deben estar limitados a Service Desks realmente visibles para la cuenta técnica configurada.
4. La ausencia de un Space del listado puede significar falta de permisos, no necesariamente inexistencia; la interfaz debe distinguir ese estado.
5. El vínculo local puede persistir `jsmServiceDeskId` y `jsmProjectId` por separado, porque representan identidades distintas expuestas por Atlassian.
