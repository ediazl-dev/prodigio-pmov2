# Manual de usuario

## Vinculación y homologación de un proyecto Jira existente en Prodigio

**Versión:** 1.0  
**Fecha:** 29 de agosto de 2026  
**Audiencia:** Administración, PMO y Project Managers  
**Preparado por:** Manus AI para Prodigio Tech  
**Clasificación:** Uso interno

---

## Propósito

Este manual explica cómo incorporar a Prodigio un proyecto que **ya existe en Jira**, reconstruir su estructura PMO y dejarlo en estado **listo para sincronización**. El procedimiento no crea un segundo Space Jira, no inventa información ausente y no marca etapas como completadas sin evidencia. El resultado es un proyecto gobernado mediante el mismo pipeline obligatorio de seis etapas utilizado por los proyectos creados desde cero en Prodigio.[1] [2]

> **Importante:** las pantallas de este documento son escenarios de capacitación con datos sanitizados. Reproducen la interfaz y las reglas implementadas, pero no corresponden a un proyecto productivo.

## Resultado esperado

Al finalizar, el proyecto tendrá identidad PMO confirmada, issues Jira mapeados, seis etapas canónicas materializadas, baseline provisional revisado y aprobado, Deal validado o una excepción visible, y onboarding en estado **`ready`**. A partir de ese momento, Admin/PMO podrá ejecutar **Sincronizar ahora** y el proyecto participará en la conciliación diaria Jira → Prodigio.[2] [3]

| Condición final | Evidencia en la aplicación |
|---|---|
| Proyecto PMO creado | El detalle muestra el proyecto y sus seis etapas. |
| Identidad confirmada | Cliente, tipo, Deal, PM y Delivery aparecen asociados. |
| Issues homologados | Cada issue tiene destino PMO o exclusión explícita. |
| Baseline gobernado | La propuesta Jira fue revisada y aprobada por una persona autorizada. |
| Onboarding listo | La tarjeta muestra **ONBOARDING LISTO**. |
| Sincronización habilitada | Admin/PMO ve **Sincronizar ahora** y su historial. |

---

## Índice

1. Prerrequisitos y permisos
2. Acceso a Spaces Jira
3. Selección del proyecto existente
4. Diagnóstico Preflight
5. Confirmación de identidad
6. Mapeo de issues
7. Materialización de las seis etapas
8. Revisión y aprobación del baseline
9. Verificación del estado `ready`
10. Sincronización manual y diaria
11. Gestión posterior por etapas
12. Datos actualizables y datos protegidos
13. Estados y mensajes
14. Solución de problemas
15. Checklist final

---

# 1. Prerrequisitos y permisos

Antes de iniciar, confirme que el proyecto existe en Jira y que el usuario cuenta con permisos de **Admin** o **PMO**. El diagnóstico, la identidad, el mapeo, la materialización y la sincronización manual son acciones gobernadas. El PM asignado puede revisar y aprobar el baseline y gestionar documentos autorizados, pero no ejecutar el onboarding administrativo completo.[1] [3]

| Requisito | Cómo verificarlo | Si falta |
|---|---|---|
| Space Jira existente | Conoce el nombre o project key. | Solicite acceso o creación en Jira antes de continuar. |
| Rol Admin o PMO | Puede entrar a **Administración → Spaces JIRA**. | Solicite el rol correspondiente; no comparta credenciales. |
| Deal sincronizado | El Deal aparece en el selector de identidad. | Ejecute primero la sincronización financiera; no lo infiera por nombre. |
| PM y Delivery disponibles | Ambos aparecen en sus catálogos. | Regularice usuarios o responsables antes de aprobar identidad. |
| Información suficiente en Jira | Existen issues y campos observables. | Continúe solo si acepta resolver faltantes como excepciones. |

> **Regla de control:** si Jira no entrega un dato y no existe una decisión humana confirmada, Prodigio debe mostrar **`[PENDIENTE]`** o **`[POR CONFIRMAR]`**. Nunca complete esos campos por aproximación.

# 2. Acceso a Spaces Jira

Ingrese a [Prodigio PMO](https://pmo.prodigio.tech), abra **Administración** en la barra lateral y seleccione **Spaces JIRA**. En la página se presentan los proyectos vinculados y la acción **Vincular Proyecto**.[1]

![Figura 1. Acceso a Administración y Spaces JIRA](https://files.manuscdn.com/user_upload_by_module/session_file/310519663043443217/rrmuAfVkQcPRLuVv.png)

**Figura 1. Acceso al módulo administrativo.** Utilice **Vincular Proyecto** para iniciar el asistente. Esta acción no crea un proyecto nuevo en Jira; prepara la incorporación de uno existente.

| Verificación antes de continuar | Resultado correcto |
|---|---|
| Menú activo | **Administración** está seleccionado. |
| Página abierta | El título muestra **Spaces JIRA**. |
| Acción disponible | Se visualiza **Vincular Proyecto**. |

# 3. Selección del proyecto existente

Busque el proyecto por nombre o project key. Seleccione un único resultado y pulse **Ejecutar diagnóstico**. El sistema obtiene metadatos e issues en modo de solo lectura; todavía no crea el proyecto PMO.[1]

![Figura 2. Selección del proyecto Jira existente](https://files.manuscdn.com/user_upload_by_module/session_file/310519663043443217/BAvjFRbneNTkwReu.png)

**Figura 2. Selección del proyecto.** El llamado 1 identifica el proyecto encontrado; el llamado 2 inicia el diagnóstico de solo lectura.

| Acción | Criterio correcto |
|---|---|
| Buscar | Use nombre o key exacta cuando existan proyectos similares. |
| Seleccionar | Confirme nombre, key y tipo antes de avanzar. |
| Diagnosticar | Pulse una sola vez y espere el resultado. |

> **No continúe** si seleccionó el Space equivocado. Cancele el asistente y repita la búsqueda; no intente corregir la identidad con otro proyecto Jira.

# 4. Diagnóstico Preflight

El Preflight resume issues, candidatos a hitos, riesgos y épicas, configuración PPDC, cobertura de fechas, duplicidad y bloqueos. Esta pantalla es un **dry-run**: no crea proyecto PMO, no modifica Jira y no cierra etapas.[1] [2]

![Figura 3. Diagnóstico Preflight](https://files.manuscdn.com/user_upload_by_module/session_file/310519663043443217/XFIWRRPKyIjkAfLb.png)

**Figura 3. Diagnóstico de preparación.** Revise las métricas y advertencias antes de usar **Continuar a identidad**.

| Resultado del Preflight | Acción recomendada |
|---|---|
| Sin bloqueos | Continúe a identidad. |
| Advertencias | Continúe solo si puede resolverlas mediante identidad, mapeo o excepciones visibles. |
| Bloqueo por duplicidad | No materialice; determine si el proyecto ya fue incorporado. |
| Fechas incompletas | No invente fechas; manténgalas pendientes para revisión. |
| PPDC no conforme | Registre la brecha y regularice la configuración Jira cuando corresponda. |

> **Criterio de salida:** el botón **Continuar a identidad** debe estar habilitado. Si permanece bloqueado, resuelva primero la causa informada por el diagnóstico.

# 5. Confirmación de identidad

Confirme el proyecto Jira y complete las asociaciones de negocio: proyecto PMO, cliente, tipo de proyecto, Deal, Project Manager y Delivery. Estas selecciones son decisiones humanas y quedan persistidas para reanudar el asistente sin perder el avance.[1] [2]

![Figura 4. Confirmación de identidad PMO](https://files.manuscdn.com/user_upload_by_module/session_file/310519663043443217/iuPPtTBYuIxXDDhi.png)

**Figura 4. Identidad del proyecto.** El llamado 1 destaca los campos obligatorios; el llamado 2 recuerda que Prodigio no infiere asociaciones por similitud de nombres.

| Campo | Regla de selección |
|---|---|
| Proyecto PMO | Use el nombre oficial que será visible en Prodigio. |
| Cliente | Seleccione el cliente contractual correcto. |
| Tipo | Elija la clasificación PMO aplicable. |
| Deal | Seleccione el identificador confirmado disponible en datos financieros. |
| PM | Seleccione a la persona responsable del proyecto. |
| Delivery | Seleccione al responsable de entrega correspondiente. |

> **Deal no disponible:** no lo reemplace por otro ni lo deduzca por nombre. Continúe únicamente si el flujo permite mantenerlo como **`[POR CONFIRMAR]`** y registre la excepción para resolverla después.

# 6. Mapeo de issues

Asigne un destino PMO a cada issue Jira. Los destinos disponibles incluyen **Hito**, **Riesgo**, **Épica**, **Tarea**, **Documento**, **Evidencia de etapa** o **Exclusión explícita**. Todos los issues deben quedar decididos antes de aprobar el mapeo.[1] [2]

![Figura 5. Mapeo explícito de issues Jira](https://files.manuscdn.com/user_upload_by_module/session_file/310519663043443217/brmWyZaKBMzdFQMM.png)

**Figura 5. Mapeo issue por issue.** El llamado 1 muestra la selección de destino; el llamado 2 confirma que el conjunto está listo para aprobación.

| Destino | Cuándo usarlo | Resultado en Prodigio |
|---|---|---|
| Hito | Entregable o milestone que se gobernará en el baseline. | Propuesta de hito en estado draft. |
| Riesgo | Issue que representa un riesgo real. | UPSERT en la matriz de riesgos. |
| Épica | Contenedor jerárquico real de trabajo. | Nodo WBS con key Jira. |
| Tarea | Historia o tarea ejecutable. | Ítem WBS con estado y responsable observados. |
| Documento | Referencia a un documento de proyecto. | Solo se incorpora si existe archivo o clave S3 real. |
| Evidencia de etapa | Archivo que respalda un cierre de etapa. | Solo se registra con referencia verificable. |
| Exclusión explícita | Issue fuera del alcance PMO. | Queda trazabilidad de la decisión; no se importa. |

> **Jerarquía WBS:** Prodigio conserva un padre únicamente cuando el `parentKey` real está disponible y aprobado. Si falta, genera una excepción; no inventa relaciones.

# 7. Materialización de las seis etapas

Después de aprobar identidad y mapeo, pulse **Materializar seis etapas**. Prodigio crea el proyecto y exactamente seis etapas: **SoW, Jira, Riesgos, Planificación, Avance y Cierre**. SoW queda disponible para trabajar; las etapas posteriores permanecen bloqueadas hasta cumplir el cierre secuencial con evidencia.[2]

![Figura 6. Materialización canónica](https://files.manuscdn.com/user_upload_by_module/session_file/310519663043443217/wcVXthLnowuUySHu.png)

**Figura 6. Proyecto materializado.** El llamado 1 identifica el botón de materialización; el llamado 2 muestra el resultado: seis etapas canónicas sin autocierre.

| Control | Comportamiento esperado |
|---|---|
| Número de etapas | Exactamente seis. |
| SoW | Disponible o en progreso, según el estado operativo. |
| Etapas siguientes | Bloqueadas hasta el cierre válido de la etapa anterior. |
| Historia Jira | No se usa para fabricar cierres retroactivos. |
| Evidencia | Cada cierre debe identificar archivo, referencia y fecha. |

> **No confunda materialización con finalización.** El proyecto ya existe en Prodigio, pero todavía no queda `ready` para conciliación continua hasta aprobar el baseline provisional.

# 8. Revisión y aprobación del baseline

Los issues mapeados como hitos generan una **propuesta provisional** en estado `draft`. Revise nombre, fechas y trazabilidad; complete los datos contractuales que tengan respaldo y pulse **Aprobar baseline**. La aprobación es una decisión humana disponible para Admin, PMO o el PM asignado.[2] [4]

![Figura 7. Baseline provisional y aprobación humana](https://files.manuscdn.com/user_upload_by_module/session_file/310519663043443217/KvBckDtgBPeTfdyp.png)

**Figura 7. Revisión del baseline.** Los llamados destacan la aprobación humana y la separación entre fecha contractual, fecha Jira planificada, cierre Jira y aceptación del cliente.

| Fecha | Significado | ¿La sincronización Jira puede sobrescribirla? |
|---|---|---:|
| Baseline contractual | Compromiso aprobado con el cliente. | No |
| Jira planificada/replanificada | Fecha operativa observada en Jira. | Sí, solo en su campo Jira |
| Cierre Jira | Fecha en que Jira registró el issue como cerrado. | Sí, solo en su campo Jira |
| Aceptación del cliente | Fecha respaldada por acta de aceptación. | No |

> **Regla de avance:** el progreso contractual se calcula por cardinalidad de hitos aceptados con evidencia. El valor financiero y los pesos no determinan el porcentaje de avance.[2]

# 9. Verificación del estado `ready`

Después de la aprobación humana del baseline, el onboarding pasa a `ready`. Abra el detalle del proyecto y revise la tarjeta **Homologación Jira → Prodigio**. Debe mostrar **ONBOARDING LISTO**, Deal confirmado o excepción visible, conteos importados, evidencia documental, faltantes y última sincronización.[3]

![Figura 8. Proyecto listo y sincronización](https://files.manuscdn.com/user_upload_by_module/session_file/310519663043443217/OLtZBixJGzVwkfxl.png)

**Figura 8. Estado final del onboarding.** El llamado 1 identifica la sincronización manual; el llamado 2 muestra el historial auditable.

| Indicador | Lectura correcta |
|---|---|
| ONBOARDING LISTO | El proyecto es elegible para conciliación manual y diaria. |
| Deal | Debe estar confirmado o mostrar una excepción resoluble. |
| Riesgos / WBS | Compara mapeados e importados sin ocultar faltantes. |
| Evidencia documental | Cuenta solo archivos o referencias S3 reales. |
| Excepciones | Deben revisarse y resolverse; no impiden ver el resto del estado. |
| Historial | Distingue corridas Manual, Diaria y Reintento. |

> **Criterio de aceptación:** no considere listo un proyecto solo porque aparece como “vinculado a Jira”. Debe completar el onboarding y mostrar explícitamente **ONBOARDING LISTO**.

# 10. Sincronización manual y diaria

Admin/PMO puede pulsar **Sincronizar ahora** en la tarjeta del proyecto. La misma conciliación se ejecuta diariamente a las **04:00 UTC** para todos los onboardings `ready`. Ambas rutas utilizan el mismo motor Jira → Prodigio, registran resultados y aplican idempotencia para que un reintento no duplique entidades.[3] [5]

| Modalidad | Quién la inicia | Registro |
|---|---|---|
| Manual | Admin o PMO | Historial del proyecto con fuente Manual. |
| Diaria | Job autenticado | Historial con fuente Diaria y ejecución técnica del scheduler. |
| Reintento | Motor ante una corrida fallida recuperable | Reutiliza la operación sin duplicar efectos. |

Durante la sincronización, Prodigio consulta únicamente issues aprobados en el mapeo. Una falla parcial se registra como excepción y no detiene los demás proyectos elegibles. La sincronización no escribe en Jira.[3] [5]

# 11. Gestión posterior por etapas

Una vez homologado, el proyecto se gestiona igual que uno creado desde cero. Complete cada etapa y registre evidencia para cerrarla; solo entonces se desbloquea la siguiente. Un issue Jira en `Done` es una observación operativa y no constituye aceptación del cliente.[2]

![Figura 9. Gestión posterior con seis etapas y evidencia](https://files.manuscdn.com/user_upload_by_module/session_file/310519663043443217/aqZNfzXaDLkaNSLm.png)

**Figura 9. Pipeline canónico.** El llamado 1 identifica el cierre de la etapa activa con evidencia; el llamado 2 explica el desbloqueo secuencial.

| Etapa | Evidencia mínima esperada |
|---|---|
| SoW | SoW contractual o referencia aprobada. |
| Jira | Configuración o referencia verificable del Space. |
| Riesgos | Matriz revisada y evidencia de aprobación. |
| Planificación | WBS/Gantt o documento equivalente. |
| Avance | Reporte y evidencias del seguimiento. |
| Cierre | Acta, lecciones aprendidas y antecedentes finales requeridos. |

> **Actas por hito:** las actas de aceptación permanecen asociadas a cada hito. No deben cargarse como un documento genérico del proyecto, porque se perdería la trazabilidad de qué entregable fue aceptado.

---

# 12. Datos actualizables y datos protegidos

La sincronización continua actualiza observaciones Jira y preserva las decisiones contractuales o PMO confirmadas. Esta separación evita loops y protege el gobierno del proyecto.[2] [3]

| Dominio | Jira → Prodigio actualiza | Nunca actualiza automáticamente |
|---|---|---|
| Hitos | Estado Jira, categoría, fecha planificada/replanificada y cierre Jira. | Baseline contractual, aceptación, acta y avance contractual. |
| Riesgos | Resumen y metadatos observados en Jira. | Categoría, probabilidad, impacto y clasificación PMO confirmadas. |
| WBS | Resumen, estado, responsable y padre Jira real. | Fase, story points y planificación PMO confirmados. |
| Documentos | Referencias S3 reales ya aprobadas. | Archivos, URLs, evidencias o actas inexistentes. |
| Finanzas | No ejecuta resincronización financiera. | Deal confirmado y valores de `financial_data`. |
| Pipeline | No cambia estados de etapa. | Cierres, desbloqueos y evidencias. |

# 13. Estados y mensajes

| Estado o mensaje | Significado | Acción |
|---|---|---|
| Diagnóstico requerido | Aún no se ejecuta Preflight. | Ejecute el diagnóstico. |
| Identidad pendiente | Faltan asociaciones de negocio. | Complete y confirme los campos. |
| Mapeo pendiente | Hay issues sin decisión. | Mapéelos o exclúyalos explícitamente. |
| Materializado | Ya existen proyecto y seis etapas. | Revise baseline y evidencia. |
| Baseline draft | Jira propuso hitos, pero falta aprobación. | Revise y apruebe humanamente. |
| ONBOARDING LISTO | El proyecto puede sincronizarse. | Use sincronización manual o espere la diaria. |
| `[PENDIENTE]` | Falta una acción o antecedente necesario. | Identifique responsable y resuelva. |
| `[POR CONFIRMAR]` | El origen no permite afirmar el dato. | Confirme con evidencia; no infiera. |
| Excepción abierta | Una entidad no pudo incorporarse o validarse. | Revise detalle, corrija origen/mapping y reintente. |

# 14. Solución de problemas

| Síntoma | Causa probable | Resolución segura |
|---|---|---|
| No aparece **Continuar a identidad** | El Preflight encontró un bloqueo. | Revise duplicidad, calidad o PPDC; no fuerce la materialización. |
| El Deal no aparece | No existe en `financial_data` sincronizado. | Sincronice finanzas o confirme el Deal correcto; no use coincidencia por nombre. |
| No se puede aprobar el mapeo | Existen issues sin destino o exclusión. | Complete todas las decisiones. |
| No se puede materializar | Identidad o mapeo no están aprobados. | Retome el asistente en el paso indicado. |
| La tarjeta muestra onboarding pendiente | Falta materialización o aprobación del baseline. | Complete el paso pendiente y vuelva al detalle. |
| **Sincronizar ahora** está deshabilitado | Onboarding no `ready` o rol sin permiso. | Confirme estado y rol Admin/PMO. |
| Jira muestra `Done`, pero el avance no aumenta | No existe aceptación del cliente con acta. | Cargue el acta en el hito correspondiente. |
| La corrida diaria procesa cero proyectos | No existen onboardings `ready`. | Termine al menos un onboarding; no es un error del scheduler. |
| Falta un padre en WBS | Jira no entregó un `parentKey` aprobado. | Corrija Jira/mapping y reintente; no invente jerarquía. |
| Documento no importado | El mapping no posee referencia S3 real. | Cargue el archivo mediante el flujo documental de Prodigio. |

# 15. Checklist final

Use esta lista antes de comunicar que el proyecto está listo:

| Nº | Control | Cumple |
|---:|---|:---:|
| 1 | El Space Jira correcto fue seleccionado. | ☐ |
| 2 | El Preflight no presenta bloqueos pendientes. | ☐ |
| 3 | Cliente, tipo, PM y Delivery están confirmados. | ☐ |
| 4 | El Deal es exacto o existe una excepción visible y asignada. | ☐ |
| 5 | Todos los issues tienen destino o exclusión explícita. | ☐ |
| 6 | Se materializaron exactamente seis etapas. | ☐ |
| 7 | No existen etapas autocerradas sin evidencia. | ☐ |
| 8 | Los hitos Jira se encuentran en baseline draft revisado. | ☐ |
| 9 | El baseline fue aprobado por una persona autorizada. | ☐ |
| 10 | La tarjeta muestra **ONBOARDING LISTO**. | ☐ |
| 11 | Riesgos/WBS, documentos y excepciones fueron revisados. | ☐ |
| 12 | **Sincronizar ahora** está disponible para Admin/PMO. | ☐ |
| 13 | El historial muestra una corrida exitosa o el proyecto espera la diaria. | ☐ |
| 14 | El equipo entiende que Jira `Done` no equivale a aceptación del cliente. | ☐ |

## Cierre operativo

El proyecto queda correctamente vinculado y listo cuando cumple los catorce controles anteriores. A partir de ese momento, la información operativa observada en Jira puede conciliarse con Prodigio, mientras las fechas contractuales, la aceptación del cliente, las evidencias y los cierres de etapa continúan bajo control humano y trazable.

---

## Referencias

[1]: https://github.com/ediazl-dev/prodigio-pmov2/blob/main/client/src/pages/admin/JiraSpaces.tsx "Asistente de homologación de Spaces Jira"
[2]: https://github.com/ediazl-dev/prodigio-pmov2/blob/main/docs/IMPLEMENTACION_HOMOLOGACION_JIRA_LOG.md "Bitácora H0–H6 de homologación Jira"
[3]: https://github.com/ediazl-dev/prodigio-pmov2/blob/main/client/src/components/JiraHomologationStatusCard.tsx "Tarjeta de homologación y sincronización Jira"
[4]: https://github.com/ediazl-dev/prodigio-pmov2/blob/main/client/src/components/BaselineExecutiveCard.tsx "Baseline provisional y aprobación humana"
[5]: https://github.com/ediazl-dev/prodigio-pmov2/blob/main/docs/H7_AUDITORIA_SINCRONIZACION_JIRA_2026-08-29.md "Arquitectura y programación H7"
