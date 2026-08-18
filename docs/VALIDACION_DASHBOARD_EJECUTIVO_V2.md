# Validación — Dashboard Ejecutivo v2 (Tanner)

## Alcance y estado

Este documento concentra la evidencia de cierre del piloto Tanner en la ruta `/projects/180002/executive-dashboard-v2`. La validación comprueba que el dashboard conserva el principio de gobierno aprobado: el avance contractual se deriva exclusivamente de la cardinalidad de hitos con acta de aceptación; Jira aporta señal operativa secundaria y no puede mejorar el estado.

| Control | Evidencia actual | Estado |
| --- | --- | --- |
| Base recuperable | Checkpoint `4ed43986` previo a esta ronda de validación | Conforme |
| Ruta publicada | `https://prodigio-pmo-neyq89tj.manus.space/projects/180002/executive-dashboard-v2` | Protegida por autenticación |
| Verificación visual externa | El 18-ago-2026 el visor abrió la ruta y mostró el estado de carga; al resolver sesión fue redirigido al acceso OAuth, sin credenciales de una cuenta autorizada | Limitada, no es un defecto funcional |
| Datos reales Tanner | No se alteraron datos ni se registraron actas, minutas, exigencias o valores financieros durante la validación | Conforme |

## Criterios a completar

La evidencia automatizada y estática se complementará con revisión de TypeScript, Vitest, semántica de la interfaz, foco visible y contraste. La comprobación publicada bajo sesión autorizada requiere una cuenta con acceso al piloto Tanner; el redireccionamiento al acceso OAuth confirma que la ruta no expone sus datos sin autenticación.
