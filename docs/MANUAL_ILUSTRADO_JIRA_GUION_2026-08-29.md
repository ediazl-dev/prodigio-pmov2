# Guion visual — Vinculación y homologación de un proyecto Jira existente

## Objetivo

El manual mostrará el recorrido completo desde **Administración → Spaces JIRA** hasta que el proyecto quede materializado con seis etapas y listo para conciliación Jira → Prodigio. Las capturas usarán la interfaz real con datos sanitizados o escenarios visuales aislados; ninguna captura debe modificar proyectos productivos.

## Secuencia de pantallas

| Figura | Pantalla | Acción principal | Resultado que debe explicar |
|---:|---|---|---|
| 1 | Navegación lateral | Abrir **Administración → Spaces JIRA** | Acceso reservado a Admin/PMO operativo; la entrada de menú administrativa es visible para Admin. |
| 2 | Página **Spaces JIRA** | Pulsar **Vincular Proyecto** | Inicia el asistente para un proyecto ya existente; no crea otro Space Jira. |
| 3 | Paso **Proyecto** | Buscar por nombre o key y seleccionar | Se elige un proyecto Jira disponible y comienza un diagnóstico de solo lectura. |
| 4 | Paso **Preflight** | Revisar Issues, Hitos, Riesgos, Épicas, PPDC, fechas, bloqueos y brechas | El dry-run no crea proyecto PMO ni escribe Jira. Solo se avanza si aparece **Continuar a identidad**. |
| 5 | Paso **Identidad** | Confirmar proyecto, cliente, tipo, Deal, PM y Delivery | Todos los campos son decisiones humanas; el Deal debe existir en datos financieros sincronizados. |
| 6 | Paso **Mapeo** | Asignar cada issue a Hito, Riesgo, Épica, Tarea, Documento, Evidencia o Exclusión | Cada issue debe quedar homologado o excluido explícitamente; no hay clasificación silenciosa. |
| 7 | Estado **Identidad y mapeo aprobados** | Pulsar **Materializar seis etapas** | Se prepara el proyecto canónico sin autocerrar etapas ni inventar evidencia. |
| 8 | Estado **Proyecto PMO materializado** | Abrir SoW y registrar evidencia | Se crean exactamente SoW, Jira, Riesgos, Planificación, Avance y Cierre; solo SoW queda en progreso. |
| 9 | Baseline provisional | Revisar hitos importados, completar fechas y aprobar | Jira propone un draft; Admin/PMO o el PM asignado aprueba. Solo entonces el onboarding llega a `ready`. |
| 10 | Tarjeta **Homologación Jira → Prodigio** | Ver Deal, importados, evidencia, faltantes y excepciones | `ONBOARDING LISTO` confirma que el proyecto puede sincronizarse; `[PENDIENTE]` o `[POR CONFIRMAR]` deben resolverse, no ocultarse. |
| 11 | Sincronización e historial | Pulsar **Sincronizar ahora** o esperar la corrida diaria | Actualiza observaciones Jira y registra Manual/Diaria/Reintento; no cambia baseline, aceptación ni Jira. |
| 12 | Pipeline y evidencias | Cerrar cada etapa en secuencia con evidencia | El proyecto queda gestionado igual que uno nativo; el cierre Jira no equivale a aceptación del cliente. |

## Convenciones de imagen

Cada captura tendrá: número de figura, título breve, datos sanitizados, uno o más llamados numerados y un pie que indique **qué debe verificar el usuario antes de continuar**. Los estados que requieren persistencia se representarán mediante fixtures aislados con limpieza automática o recreaciones fieles de capacitación claramente identificadas; no se usarán datos productivos inventados.

## Criterio de “listo”

Un proyecto queda listo cuando existe proyecto PMO materializado, identidad confirmada, mappings aprobados, baseline en draft revisado y aprobado por una persona, onboarding `ready`, Deal válido o excepción visible, y tarjeta de homologación habilitada para sincronización. La existencia de un vínculo Jira heredado por sí sola no cumple este criterio.
