import {describe,it,expect} from "vitest";
import {mergeRecurringCanonicalDocumentEvidence} from "./recurringServicesMetricsEngine";
import {diagnoseRecurringServicesQuality} from "./recurringServicesQualityEngine";

describe("integración Contrato o SoW recurrente",()=>{
 it("el contrato canónico de un servicio no borra documentos de otros servicios",()=>{
  const artifact={requirementCode:"contract",artifactStatus:"active",version:1,fileName:"contrato.pdf",entityType:"recurring_service"};
  const result=mergeRecurringCanonicalDocumentEvidence([{id:30,serviceId:3,docType:"contrato"}],[],[{...artifact,id:10,entityId:1},{...artifact,id:20,entityId:2}],[]);
  expect(result.documents.map(d=>d.serviceId).sort()).toEqual([1,2,3]);
  expect(result.documentControls.map(c=>c.serviceId).sort()).toEqual([1,2]);
 });
 it("no presume vigente una decisión válida sin plazo ni vigencia abierta",()=>{
  const result=mergeRecurringCanonicalDocumentEvidence([],[],[{id:1,entityId:1,entityType:"recurring_service",requirementCode:"contract",artifactStatus:"active",version:1,fileName:"base.pdf"}],[{id:1,artifactId:1,decision:"valid",openEndedValidity:false}]);
  expect(result.documentControls[0].validationStatus).toBe("pending");
 });
 it.each(["contrato","sow"])("calidad no exige el documento alternativo cuando existe %s",docType=>{
  const result=diagnoseRecurringServicesQuality({services:[{id:1,serviceType:"staffing",clientName:"Cliente",serviceName:"Servicio",dealId:"2397",currency:"UF",totalContractAmount:"100",formalStartDate:null,endDate:null,jsmProjectKey:null,jsmServiceDeskId:null,status:"activo"}],billingMonths:[],documents:[{serviceId:1,docType}],financialReferences:[]} as any);
  expect(result.services[0].issues.some(i=>i.dimension==="documents")).toBe(false);
 });
});
