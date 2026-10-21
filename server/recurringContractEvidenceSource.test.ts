import {describe,it,expect} from "vitest";
import {selectRecurringContractEvidence as select} from "./recurringContractEvidenceSource";
const contract={id:120001,requirementCode:"contract",artifactStatus:"active",version:1,fileName:"contrato.pdf",fileKey:"private/contract"};
const sow={...contract,id:2,requirementCode:"sow",fileName:"sow.pdf"};
const valid={id:1,artifactId:120001,decision:"valid",decidedAt:"2026-09-29"};
describe("fuente contractual alternativa recurrente",()=>{
 it("2397 admite contrato canónico sin SoW ni filas legacy",()=>{expect(select([contract],[valid],[])).toMatchObject({id:120001,docType:"contrato",sourceKind:"document_artifacts"});});
 it("sólo SoW o sólo contrato legacy son fuentes alternativas",()=>{for(const docType of ["sow","contrato"]){expect(select([],[],[{id:1,docType,fileName:"base.pdf",fileUrl:"https://files/base"}])?.docType).toBe(docType)}});
 it("prefiere contrato validado a SoW pendiente sin validar automáticamente",()=>{expect(select([sow,contract],[valid],[])?.id).toBe(120001)});
 it("no revive el contrato archivado desde legacy ni un SoW revocado",()=>{expect(select([{...contract,artifactStatus:"archived"}],[],[{id:1,docType:"contrato",fileName:"old.pdf",fileUrl:"https://files/old"}])).toBeNull();expect(select([sow],[{id:1,artifactId:2,decision:"revoked"}],[])).toBeNull()});
 it("sin ambos no presume la propuesta como contrato",()=>{expect(select([{...contract,requirementCode:"technical_economic_proposal"}],[],[])).toBeNull()});
});
