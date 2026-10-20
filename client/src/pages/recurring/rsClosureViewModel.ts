type BillingEvidence={jiraAvailable:boolean;summary:{totalItems:number;unknownItems:number;billedItems:number;billedByCurrency:Array<{currency:string;amount:number}>}};
export function buildRecurringClosurePresentation(stageData:unknown,evidence:BillingEvidence|null|undefined){
 const data=stageData&&typeof stageData==="object"?stageData as Record<string,unknown>:{};
 const isAdministrative=data.closureMode==="administrative";
 const reason=typeof data.reason==="string"?data.reason:null;
 const remainingEvidence=Array.isArray(data.remainingEvidence)?data.remainingEvidence.filter((x):x is string=>typeof x==="string"):[];
 let billingLabel="Facturación Jira: N/D · consulta pendiente";
 if(evidence?.jiraAvailable){
  const s=evidence.summary;
  const confirmed=s.billedByCurrency.map(b=>`${b.currency} ${b.amount.toLocaleString("es-CL",{maximumFractionDigits:2})}`).join(" · ");
  if(s.unknownItems>0)billingLabel=confirmed?`Facturado según Jira: ${confirmed} · ${s.unknownItems} cuota(s) N/D`:`Facturación Jira: N/D · ${s.unknownItems} cuota(s) por verificar`;
  else if(confirmed)billingLabel=`Facturado según Jira: ${confirmed}`;
  else if(s.totalItems>0)billingLabel="Sin cuotas facturadas según estado explícito Jira";
  else billingLabel="Facturación Jira: N/D · sin hitos asociados";
 }
 return {isAdministrative,reason,remainingEvidence,billingLabel,title:isAdministrative?"Cierre administrativo — servicio finalizado":"Servicio Cerrado",closureVerb:isAdministrative?"administrativamente":"formalmente",disclaimer:isAdministrative?`El cierre finaliza la gestión activa del servicio; no acredita entrega, aceptación de reportes ni emisión de facturas.${data.slaApplicability==="not_applicable_staffing"?" El SLA de incidentes no aplica a este Staffing.":""}`:null};
}
