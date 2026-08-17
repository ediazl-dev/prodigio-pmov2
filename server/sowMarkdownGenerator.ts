/**
 * Genera el SoW en formato Markdown siguiendo el formato estándar de 11 secciones de Prodigio Tech.
 */

interface SowMarkdownInput {
  projectName: string;
  clientName: string;
  version?: string;
  date?: string;
  redactor?: string;
  redactorRole?: string;
  introText?: string;
  generalObjective?: string;
  specificObjectives?: string[];
  activitiesIncluded?: string[];
  deliverables?: Array<{ name: string; description?: string }>;
  limitations?: string[];
  assumptions?: string[];
  clientDependencies?: string[];
  risks?: string[];
  prerequisites?: string[];
  milestones?: Array<{ number?: number; description: string; deliverable?: string }>;
  meetingFrequency?: string;
  communicationChannel?: string;
  totalAmount?: string;
  currency?: string;
  billingMilestones?: Array<{ description: string; percentage?: string; amount?: string }>;
  prodigioTeam?: Array<{ role: string; name?: string; responsibilities?: string }>;
  clientTeam?: Array<{ role: string; name?: string; responsibilities?: string }>;
}

function list(items?: string[]): string {
  if (!items || items.length === 0) return "_Por definir._\n";
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n") + "\n";
}

function hr(): string {
  return "\n---\n\n";
}

export function sowToMarkdown(input: SowMarkdownInput): string {
  const {
    projectName,
    clientName,
    version = "1.0",
    date = new Date().toLocaleDateString("es-CL"),
    redactor = "Prodigio Tech",
    redactorRole = "Project Manager",
    introText,
    generalObjective,
    specificObjectives,
    activitiesIncluded,
    deliverables,
    limitations,
    assumptions,
    clientDependencies,
    risks,
    prerequisites,
    milestones,
    meetingFrequency,
    communicationChannel,
    totalAmount,
    currency = "USD",
    billingMilestones,
    prodigioTeam,
    clientTeam,
  } = input;

  const lines: string[] = [];

  // ── PORTADA ──────────────────────────────────────────────────────────────
  lines.push(`# STATEMENT OF WORK (SoW)`);
  lines.push(`## ${clientName}\n`);
  lines.push(`| Campo | Valor |`);
  lines.push(`|-------|-------|`);
  lines.push(`| **Proyecto** | ${projectName} |`);
  lines.push(`| **Cliente** | ${clientName} |`);
  lines.push(`| **Versión** | ${version} |`);
  lines.push(`| **Fecha** | ${date} |`);
  lines.push(`| **Redactor** | ${redactor} |`);
  lines.push(`| **Cargo** | ${redactorRole} |`);
  lines.push(hr());

  // ── 1. INTRODUCCIÓN Y OBJETIVOS ──────────────────────────────────────────
  lines.push(`## 1. Introducción y Objetivos\n`);
  lines.push(
    introText ||
      `El presente Statement of Work (SoW) tiene como objetivo definir de manera clara y formal el alcance, las condiciones, los lineamientos, compromisos y responsabilidades bajo los cuales Prodigio Tech prestará los servicios profesionales a **${clientName}**, en el marco del proyecto **${projectName}**.\n\nEste documento establece los supuestos, dependencias, limitaciones y exclusiones necesarios para asegurar una correcta ejecución del proyecto, alineando las expectativas de ambas Partes y constituyéndose como el documento rector durante todo el ciclo de vida del servicio.\n\nEl presente SoW entrará en vigor a partir de su firma por ambas Partes y será aplicable exclusivamente al contexto y a los servicios aquí descritos. Cualquier actividad, alcance o condición no expresamente contemplada en este SoW quedará excluida del mismo.`
  );
  lines.push(hr());

  // ── 2. OBJETIVOS DEL PROYECTO ────────────────────────────────────────────
  lines.push(`## 2. Objetivos del Proyecto\n`);
  lines.push(`### 2.1 Objetivo General\n`);
  lines.push(generalObjective || "_Por definir._");
  lines.push(`\n### 2.2 Objetivos Específicos\n`);
  lines.push(list(specificObjectives));
  lines.push(hr());

  // ── 3. ALCANCE DEL PROYECTO ──────────────────────────────────────────────
  lines.push(`## 3. Alcance del Proyecto\n`);

  lines.push(`### 3.1 Actividades Incluidas\n`);
  lines.push(list(activitiesIncluded));

  lines.push(`### 3.2 Entregables\n`);
  if (deliverables && deliverables.length > 0) {
    deliverables.forEach((d, i) => {
      lines.push(`${i + 1}. **${d.name}**${d.description ? ` — ${d.description}` : ""}`);
    });
    lines.push("\nCada entregable será revisado y aceptado conforme a los criterios definidos en este SoW.\n");
  } else {
    lines.push("_Por definir._\n");
  }

  lines.push(`### 3.3 Limitaciones y Exclusiones\n`);
  lines.push(
    list(
      limitations && limitations.length > 0
        ? limitations
        : [
            "El equipo de Prodigio debe contar con los accesos y permisos necesarios para todas las herramientas y servicios implicados en el proceso previo al inicio del proyecto.",
            "Actividades no descritas en la sección de Actividades Incluidas.",
            "Soporte posterior a la finalización del proyecto, salvo acuerdo expreso.",
            "Cambios de alcance no gestionados mediante el proceso formal de Gestión de Cambios.",
          ]
    )
  );

  lines.push(`### 3.4 Supuestos\n`);
  lines.push(
    list(
      assumptions && assumptions.length > 0
        ? assumptions
        : [
            "El Cliente dispondrá de los recursos y aprobaciones necesarias en los plazos acordados.",
            "La información proporcionada por el Cliente será completa, oportuna y veraz.",
            "No se consideran cambios significativos en el alcance, salvo acuerdo formal entre las partes.",
            "Cualquier modificación a estos supuestos podrá impactar en plazos, costos o alcance.",
          ]
    )
  );

  lines.push(`### 3.5 Dependencias del Cliente\n`);
  lines.push(
    list(
      clientDependencies && clientDependencies.length > 0
        ? clientDependencies
        : [
            "Designar un responsable del proyecto con poder de decisión.",
            "Proveer acceso oportuno a la información, sistemas y recursos necesarios antes de iniciar el servicio.",
            "Participación activa en instancias de validación y aprobación dentro de los plazos acordados.",
            "Retrasos en estas dependencias podrán afectar el cronograma del proyecto.",
          ]
    )
  );

  lines.push(`### 3.6 Riesgos\n`);
  lines.push(
    list(
      risks && risks.length > 0
        ? risks
        : [
            "Entregables, accesos o definiciones del cliente no se entregan en tiempo y forma.",
            "Falta de participación del cliente en revisiones, aprobaciones o comités.",
            "Retrasos en decisiones clave y aceptación de entregables.",
            "Complejidades técnicas no consideradas en la etapa de definición.",
          ]
    )
  );

  lines.push(`### 3.7 Pre-requisitos por parte del Cliente\n`);
  lines.push(
    list(
      prerequisites && prerequisites.length > 0
        ? prerequisites
        : [
            "Contar con TODOS los accesos necesarios para el equipo del proyecto antes de iniciar.",
            "Asignación del líder o contraparte técnica por parte del cliente, responsable de gestionar, aceptar y aprobar la implementación.",
            "Acceso a VPN, de ser necesario, para el equipo de Prodigio asignado.",
          ]
    )
  );
  lines.push(hr());

  // ── 4. HITOS DEL PROYECTO ────────────────────────────────────────────────
  lines.push(`## 4. Hitos del Proyecto\n`);
  if (milestones && milestones.length > 0) {
    milestones.forEach((m, i) => {
      const num = m.number ?? i + 1;
      const deliverableText = m.deliverable ? ` — *${m.deliverable}*` : "";
      lines.push(`${num}. **${m.description}**${deliverableText}`);
    });
    lines.push("");
  } else {
    lines.push("_Por definir en la fase de planificación._\n");
  }
  lines.push(hr());

  // ── 5. METODOLOGÍA Y GOBIERNO ────────────────────────────────────────────
  lines.push(`## 5. Metodología y Gobierno\n`);
  lines.push(`### 5.1 Gestión del Proyecto\n`);
  lines.push(
    `La gestión del proyecto será realizada por Prodigio Tech, asegurando la planificación, coordinación, seguimiento y control de las actividades, así como la gestión de riesgos, cambios y comunicaciones.\n\nEl proyecto se ejecutará bajo un enfoque híbrido, promoviendo la colaboración continua, la transparencia y la entrega incremental de valor.\n`
  );

  lines.push(`### 5.2 Definition of Done (DoD)\n`);
  lines.push(`Un entregable se considerará terminado cuando:`);
  lines.push(`1. Cumpla con los requerimientos acordados.`);
  lines.push(`2. Haya sido revisado internamente por Prodigio Tech.`);
  lines.push(`3. Sea validado y aceptado formalmente por el Cliente.\n`);

  lines.push(`### 5.3 Definition of Ready (DoR)\n`);
  lines.push(`Un requerimiento estará listo para ejecutarse cuando:`);
  lines.push(`1. Los requerimientos estén claramente definidos.`);
  lines.push(`2. Existan los insumos necesarios para su ejecución.`);
  lines.push(`3. Se cuente con la validación del Cliente cuando corresponda.\n`);

  lines.push(`### 5.4 Gobierno y Comunicación\n`);
  if (meetingFrequency || communicationChannel) {
    if (meetingFrequency) lines.push(`- **Frecuencia de reuniones:** ${meetingFrequency}`);
    if (communicationChannel) lines.push(`- **Canal oficial de comunicación:** ${communicationChannel}`);
    lines.push("");
  } else {
    lines.push(`1. Frecuencia de reuniones (definir y complementar en Kickoff).`);
    lines.push(`2. Tipo de comité o reporte de avance (operativo / ejecutivo).`);
    lines.push(`3. Canal oficial de comunicación (definir en Kickoff).\n`);
  }
  lines.push(hr());

  // ── 6. GESTIÓN DE CONTROL DE CAMBIOS ────────────────────────────────────
  lines.push(`## 6. Gestión de Control de Cambios\n`);
  lines.push(
    `Cualquier solicitud de cambio al alcance, cronograma o entregables deberá ser gestionada mediante un proceso formal de Gestión de Cambios.\n\nCada cambio será evaluado en términos de impacto en tiempo, costo y alcance, y deberá ser aprobado por ambas partes antes de su ejecución.\n`
  );
  lines.push(hr());

  // ── 7. ROLES Y RESPONSABILIDADES ─────────────────────────────────────────
  lines.push(`## 7. Roles y Responsabilidades\n`);

  lines.push(`### 7.1 Proveedor — Prodigio Tech\n`);
  if (prodigioTeam && prodigioTeam.length > 0) {
    lines.push(`| Rol | Nombre | Responsabilidades |`);
    lines.push(`|-----|--------|-------------------|`);
    prodigioTeam.forEach((m) => {
      lines.push(`| ${m.role} | ${m.name || "Por definir"} | ${m.responsibilities || ""} |`);
    });
    lines.push("");
  } else {
    lines.push(`1. Ejecución de los servicios definidos en este SoW.`);
    lines.push(`2. Gestión del proyecto y coordinación de actividades.`);
    lines.push(`3. Comunicación periódica del estado del proyecto.`);
    lines.push(`4. Entrega de los entregables comprometidos.\n`);
  }

  lines.push(`### 7.2 Cliente — ${clientName}\n`);
  if (clientTeam && clientTeam.length > 0) {
    lines.push(`| Rol | Nombre | Responsabilidades |`);
    lines.push(`|-----|--------|-------------------|`);
    clientTeam.forEach((m) => {
      lines.push(`| ${m.role} | ${m.name || "Por definir"} | ${m.responsibilities || ""} |`);
    });
    lines.push("");
  } else {
    lines.push(`1. Proveer información, accesos y recursos necesarios.`);
    lines.push(`2. Participar activamente en instancias de revisión y validación.`);
    lines.push(`3. Disponer de tiempo para reuniones técnicas.`);
    lines.push(`4. Aprobar entregables y solicitudes de cambio en los plazos acordados.`);
    lines.push(`5. Informar riesgos o impedimentos de negocio o técnico.`);
    lines.push(`6. Informar con anticipación cambios en decisiones de negocio.\n`);
  }
  lines.push(hr());

  // ── 8. CRONOGRAMA ────────────────────────────────────────────────────────
  lines.push(`## 8. Cronograma\n`);
  lines.push(
    `El proyecto contará con un cronograma de alto nivel que define las principales fases e hitos. Las fechas podrán ajustarse de común acuerdo en función de la ejecución del proyecto y las dependencias del Cliente en la fase de Planificación.\n`
  );
  lines.push(hr());

  // ── 9. PRECIO Y CONDICIONES DE PAGO ─────────────────────────────────────
  lines.push(`## 9. Precio y Condiciones de Pago\n`);
  const currencyLabel = currency || "USD";
  if (totalAmount) {
    lines.push(`El servicio será prestado bajo modalidad de **precio fijo** por un monto total de **${currencyLabel} ${totalAmount}**.\n`);
  } else {
    lines.push(`El servicio será prestado bajo modalidad de precio fijo por un monto total a definir.\n`);
  }

  if (billingMilestones && billingMilestones.length > 0) {
    lines.push(`**Condiciones de pago:**\n`);
    lines.push(`| Hito | % | Monto (${currencyLabel}) |`);
    lines.push(`|------|---|---------|`);
    billingMilestones.forEach((bm) => {
      lines.push(`| ${bm.description} | ${bm.percentage ?? "—"}% | ${bm.amount ?? "—"} |`);
    });
    lines.push(`\n**TOTAL: ${currencyLabel} ${totalAmount || "XXXX"}**\n`);
  }
  lines.push(hr());

  // ── 10. ACEPTACIÓN FINAL ─────────────────────────────────────────────────
  lines.push(`## 10. Aceptación Final\n`);
  lines.push(`Se considerará otorgada la Aceptación Final del Servicio cuando:`);
  lines.push(`1. Todos los entregables hayan sido entregados y aceptados.`);
  lines.push(`2. El alcance haya sido ejecutado conforme al SoW.`);
  lines.push(`3. Se firme el Acta de Aceptación Final.\n`);
  lines.push(hr());

  // ── 11. FIRMAS ───────────────────────────────────────────────────────────
  lines.push(`## 11. Firmas\n`);
  lines.push(`| | Cliente | Prodigio Tech |`);
  lines.push(`|--|---------|---------------|`);
  lines.push(`| **Nombre** | _________________________ | _________________________ |`);
  lines.push(`| **Cargo** | _________________________ | _________________________ |`);
  lines.push(`| **Firma** | _________________________ | _________________________ |`);
  lines.push(`| **Fecha** | _________________________ | _________________________ |`);
  lines.push("");

  return lines.join("\n");
}
