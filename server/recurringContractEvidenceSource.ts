import { and, eq, inArray } from "drizzle-orm";
import { documentArtifacts, documentValidationDecisions } from "../drizzle/schema";
import { getDb } from "./db";

export type RecurringContractEvidence = {
  id: number; docType: "contrato" | "sow"; fileName: string;
  fileUrl?: string | null; fileKey?: string | null;
  sourceKind: "document_artifacts" | "recurring_service_documents";
};
type Artifact = {id:number;requirementCode:string;artifactStatus:string;version:number;fileName:string;fileKey?:string|null;fileUrl?:string|null};
type Decision = {id:number;artifactId:number;decision:string;decidedAt?:Date|string|null};
type Legacy = {id:number;docType:string;fileName:string;fileUrl:string};

/** Una fuente contractual alternativa; nunca revive una versión archivada ni una decisión revocada. */
export function selectRecurringContractEvidence(artifacts:Artifact[],decisions:Decision[],legacy:Legacy[]):RecurringContractEvidence|null {
  const latest = (id:number)=>decisions.filter(d=>d.artifactId===id).sort((a,b)=>new Date(b.decidedAt??0).getTime()-new Date(a.decidedAt??0).getTime()||b.id-a.id)[0];
  const ownedCodes = new Set(artifacts.map(a=>a.requirementCode));
  const current = ["sow","contract"].map(code=>artifacts.filter(a=>a.requirementCode===code&&a.artifactStatus==="active").sort((a,b)=>b.version-a.version||b.id-a.id)[0]).filter((a):a is Artifact=>Boolean(a));
  const usable = current.filter(a=>(a.fileKey||a.fileUrl)&&!["rejected","revoked"].includes(latest(a.id)?.decision??"pending"));
  usable.sort((a,b)=>(latest(a.id)?.decision==="valid"?0:1)-(latest(b.id)?.decision==="valid"?0:1)||(a.requirementCode==="sow"?0:1)-(b.requirementCode==="sow"?0:1));
  if(usable[0]){const a=usable[0];return {id:a.id,docType:a.requirementCode==="sow"?"sow":"contrato",fileName:a.fileName,fileKey:a.fileKey,fileUrl:a.fileUrl,sourceKind:"document_artifacts"};}
  const d=legacy.filter(d=>["sow","contrato"].includes(d.docType)&&d.fileUrl&&!ownedCodes.has(d.docType==="sow"?"sow":"contract")).sort((a,b)=>(a.docType==="sow"?0:1)-(b.docType==="sow"?0:1))[0];
  return d?{...d,docType:d.docType as "sow"|"contrato",sourceKind:"recurring_service_documents"}:null;
}

export async function loadRecurringContractEvidence(serviceId:number,legacy:Legacy[]):Promise<RecurringContractEvidence|null>{
  const db=await getDb();if(!db)throw Error("Base de datos no disponible");
  const artifacts=await db.select().from(documentArtifacts).where(and(eq(documentArtifacts.entityType,"recurring_service"),eq(documentArtifacts.entityId,serviceId)));
  const decisions=artifacts.length?await db.select().from(documentValidationDecisions).where(inArray(documentValidationDecisions.artifactId,artifacts.map(a=>a.id))):[];
  return selectRecurringContractEvidence(artifacts,decisions,legacy);
}
