# Servicios recurrentes: Contrato o SoW

**Fecha:** 21 de octubre de 2026. **Base:** checkpoint `fcbc536e`. **Política nueva:** `2026-09-26.v2`.

## Regla aplicada

Para servicios recurrentes, la base contractual se cumple con **Contrato o SoW**, no con ambos obligatoriamente. Se conservan los dos tipos de archivo, sus versiones y decisiones. Un segundo documento se puede adjuntar voluntariamente, pero su ausencia no produce una brecha cuando la alternativa cumple. Si existen ambos, una alternativa válida y vigente puede satisfacer la base aunque la otra tenga un problema; el historial sigue disponible.

Los otros requisitos base siguen siendo **Propuesta técnico-económica** y **P&L con costeo**. El denominador recurrente pasa a tres obligaciones efectivas. No se cambia la política de proyectos, que mantiene sus cinco requisitos. La mera carga de un archivo no lo convierte en validado o vigente: revisión humana, vigencia y costeo conservan sus controles.

En una renovación como Claro Ecuador Deal 2397, el contrato cargado puede ser la base documental sin exigir un SoW adicional. No se presume ni fabrica una orden de compra, ni se altera la vigencia del documento para hacer desaparecer una alerta.

## Alcance técnico

Se alinearon catálogo canónico, cálculo de cumplimiento y gates; carga documental; filtros del reporte e historial administrativo; detalle, Clásico, calidad y métricas; cobertura documental suplementaria; y selección de fuente para el generador Staffing. La alternativa no exigible se presenta con tono neutral y queda fuera de los filtros de faltantes y del denominador.

Las métricas leen artefactos y decisiones del expediente canónico además de evidencia legacy, con precedencia canónica por servicio y requisito. La normalización preserva el aislamiento entre servicios y no revive documentos retirados. El generador acepta Contrato o SoW como fuente real, pero continúa deteniéndose si no puede verificar los términos requeridos. No se ejecutó ninguna generación de planes.

## Verificación real: PMO 3090001 / Deal 2397

| Control | Resultado |
|---|---|
| Base contractual | Contrato canónico existente; sin SoW obligatorio |
| Formalización contractual | 100%; ningún documento alternativo marcado como faltante |
| Expediente base | 3 de 3 requisitos cumplidos; 0 faltantes, 0 pendientes de validación |
| Procedencia de formalización | `document_artifacts` |
| Reporte suplementario | Una base contractual cumplida; sin requisito separado de SoW |
| Documentos y decisiones existentes | Sin cambios, comparados con snapshot previo |
| Ficha del servicio | Sin cambios de datos |

Se comprobó la ficha autenticada en vista previa: ya no presenta una señal de SoW/base contractual faltante. Conserva sus alertas independientes de incidentes, SLA y estado de facturación por verificar. Quitar una obligación documental incorrecta no significa declarar saludable todo el servicio.

## Certificación

- 1.194 pruebas aprobadas y 20 omitidas; 171 archivos de pruebas aprobados.
- Build de producción exitoso y `git diff --check` correcto.
- TypeScript conserva los cinco errores heredados: cuatro en `server/jiraMilestoneSync.ts` y uno de `estadoSII` en `server/routers.ts`. No se declara TypeScript en cero.
- Se excluyeron las pruebas live del Banco Central y `server/jira.test.ts` de la suite determinista. Esta última agotó su timeout de 15 segundos en una corrida anterior; no se modificó su límite para aparentar aprobación.
- Regresiones cubren ambas alternativas, aislamiento entre servicios, ausencia de vigencia explícita y preservación de proyectos.

## Límites y entrega

Esta corrección no escribe Jira/JSM ni cambia contratos, cuotas, fechas, estados de facturación o decisiones documentales. No modifica los datos de 4687, 4727 o 4775. La comparación del caso 2397 está en `/home/ubuntu/2397-final-verification.json`; el verificador reusable de sólo lectura es `scripts/verifyRecurringContractOr2397.ts`.

La corrección se guarda en un checkpoint para revisión/publicación. **Guardar un checkpoint no acredita publicación en `pmo.prodigio.tech`**; el dominio productivo debe publicar la versión nueva para adoptar la regla.
