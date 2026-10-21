import {readFileSync,writeFileSync} from "node:fs";
import assert from "node:assert/strict";
import {eq,inArray} from "drizzle-orm";
import {getDb} from "../server/db";
import {recurringServices,recurringServiceDocuments,documentArtifacts,documentValidationDecisions} from "../drizzle/schema";
import {getRecurringDashboardV2Data} from "../server/recurringServicesDb";
import {buildRecurringServicesDashboardV2} from "../server/recurringServicesDashboardV2";
import {calculateRecurringServicesMetrics} from "../server/recurringServicesMetricsEngine";
import {loadDocumentGovernancePortfolio} from "../server/documentGovernanceSource";
import {loadDocumentCoveragePortfolio} from "../server/documentCoverageSource";

async function main(){
 const before=JSON.parse(readFileSync("/home/ubuntu/2397-document-before.json","utf8"));const id=before.service.id;const cutoff="2026-10-21";
 const db=await getDb();if(!db)throw Error("DB no disponible");
 const source=await getRecurringDashboardV2Data();
 const dashboard=buildRecurringServicesDashboardV2(source,{cutOffDate:cutoff});
 const metrics=calculateRecurringServicesMetrics({...source,cutOffDate:cutoff});
 const metric=metrics.services.find(s=>s.id===id);assert(metric);assert.equal(metric.formalization.coveragePercent,100);assert.deepEqual(metric.formalization.missing,[]);
 assert(!metric.healthSignals.some(s=>["CONTRACT_DOCUMENT_MISSING","FORMAL_DOCUMENT_MISSING"].includes(s.code)));
 const analytics=dashboard.documents.services.find(s=>s.serviceId===id);assert.equal(analytics?.status,"valid");assert.equal(analytics?.documents.length,1);
 const canonical=await loadDocumentGovernancePortfolio({entityType:"recurring_service",entityId:id,coverageStatus:"all",cutoffAt:cutoff,pageSize:100});const entity=canonical.items.find(e=>e.entityId===id);assert(entity);
 const required=entity.requirements.filter(r=>r.exigibility!=="alternative");assert.equal(required.length,3);assert(required.every(r=>r.status==="compliant"));
 const coverage=await loadDocumentCoveragePortfolio({entityType:"recurring_service",coverageStatus:"all",cutoffAt:cutoff,pageSize:100});const legacyCoverage=coverage.items.find(e=>e.entityId===id);assert(legacyCoverage);assert.equal(legacyCoverage.requirements.find(r=>r.kind==="service_contract")?.status,"compliant");assert(!legacyCoverage.requirements.some(r=>r.kind==="service_sow"));
 const [service]=await db.select().from(recurringServices).where(eq(recurringServices.id,id));
 const legacy=await db.select().from(recurringServiceDocuments).where(eq(recurringServiceDocuments.serviceId,id));
 const artifacts=await db.select().from(documentArtifacts).where(eq(documentArtifacts.entityId,id));
 const decisions=artifacts.length?await db.select().from(documentValidationDecisions).where(inArray(documentValidationDecisions.artifactId,artifacts.map(a=>a.id))):[];
 const normalize=(v:any)=>JSON.parse(JSON.stringify(v));const sorted=(v:any[])=>normalize(v).sort((a:any,b:any)=>a.id-b.id);
 assert.deepEqual(normalize(service),before.service);assert.deepEqual(sorted(legacy),sorted(before.documents));assert.deepEqual(sorted(artifacts),sorted(before.artifacts));assert.deepEqual(sorted(decisions),sorted(before.decisions));
 const result={id,cutoff,policyVersion:canonical.policyVersion,formalization:metric.formalization,contractualAnalytics:analytics,canonical:{coverage:entity.coverage,requirements:entity.requirements.map(r=>({code:r.code,status:r.status,exigibility:r.exigibility}))},supplementaryContract:legacyCoverage.requirements.find(r=>r.kind==="service_contract"),evidenceUnchanged:true};
 writeFileSync("/home/ubuntu/2397-final-verification.json",JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
