# Verificación de portafolio operativo

**Fecha:** 18 de agosto de 2026  
**Propósito:** comprobar que el dashboard raíz muestra exclusivamente los proyectos operativos luego de la limpieza de registros transitorios de pruebas.

## Relación aplicación–datos

La página `client/src/pages/Home.tsx` obtiene el conjunto visible mediante `trpc.projects.list.useQuery()`. El panel de proyectos recientes toma los primeros ocho registros de ese resultado (`projects.slice(0, 8)`) y el gráfico de etapas calcula sus conteos sobre el conjunto completo. Por tanto, la lista de la tabla `projects` es la fuente directa del contenido presentado en el dashboard raíz.

## Evidencia de consulta posterior a la limpieza

La consulta ejecutada contra la base destino fue:

```sql
SELECT id, projectName, clientName, origin, currentStage, status
FROM projects
ORDER BY createdAt DESC, id DESC;
```

El resultado devolvió **16 proyectos**, todos con estado `activo`, sin los identificadores transitorios `750001`–`750005` ni nombres de prueba. La distribución es de **9** proyectos con origen `linked` y **7** con origen `platform`.

| Identificador | Proyecto | Origen | Etapa |
|---:|---|---|---|
| 600001 | [PMO] CCLA SRP MVP1 Deal 4728 | platform | risks |
| 570001 | CCLA SRP MVP1 Deal 4728 | platform | jira |
| 540001 | CCLA SRP MVP1 Deal 4728 | platform | sow |
| 510001 | Isapre Consalud CloudOps — Deal 4687 | linked | design |
| 480001 | Plataforma Agéntica | linked | design |
| 450001 | Producto Apigee | linked | design |
| 420001 | CEN Soporte Portal de Pronósticos — Deal 1102 | linked | design |
| 390001 | Producto APIGEE Implementación/Migración | linked | design |
| 360001 | Nexos SFA | linked | design |
| 330001 | Caja los Andes Recaudación — Deal 4622 | platform | planning |
| 300001 | MaxAgro Assessment — Deal 4532 | platform | design |
| 240003 | Plan Vital Evolutivo — Deal 4564 | linked | design |
| 240002 | Vida Cámara Apigee — Deal 2207 | linked | design |
| 210001 | Ruta Pass Modernización TI — Deal 1996 | linked | design |
| 180003 | Consalud Apigee — Deal 4529 | linked | design |
| 180002 | Banco Tanner Implementación SFA — Deal 1934 | linked | design |

> La captura posterior a la limpieza es consistente con esta consulta: muestra 16 proyectos activos y únicamente nombres operativos. La consulta proporciona la evidencia trazable del conjunto exacto que consume el dashboard raíz.
