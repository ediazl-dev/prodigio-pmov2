import {describe,it,expect,vi,beforeEach} from "vitest";
const mock=vi.hoisted(()=>({status:"completado",storagePut:vi.fn(),service:vi.fn()}));
vi.mock("./recurringServicesDb",()=>({getRecurringServiceById:mock.service,getRecurringServiceIdForChild:vi.fn()}));
vi.mock("./storage",()=>({storagePut:mock.storagePut,storageGet:vi.fn()}));
vi.mock("./documentGovernanceRepository",async original=>{const real=await original<typeof import("./documentGovernanceRepository")>();return {...real,getDocumentArtifactById:vi.fn(async()=>({id:1,entityType:"recurring_service",entityId:2040001,requirementCode:"contract",fileName:"contrato.pdf",fileKey:"private/key"}))};});
import {documentGovernanceRouter} from "./documentGovernanceRouter";
import {assertRecurringServiceWritable} from "./recurringServiceWriteGuard";
describe("documentos de un servicio cerrado",()=>{
 beforeEach(()=>{vi.clearAllMocks();mock.status="completado";mock.service.mockImplementation(async(id:number)=>({id,serviceName:"Staffing",status:mock.status,pmId:null}));});
 for(const role of ["admin","pmo","pm","consulta"]){
  it(`${role}: carga, revisión, archivo y aplicabilidad bloqueados por lifecycle`,async()=>{
   const caller=documentGovernanceRouter.createCaller({user:{id:1,role,name:"Usuario"}} as any);
   const operations=[()=>caller.upload({entityType:"recurring_service",entityId:2040001,requirementCode:"contract",fileName:"contrato.pdf",mimeType:"application/pdf",fileBase64:"JVBERi0xLjQ="}),()=>caller.decide({artifactId:1,decision:"valid",openEndedValidity:true,reason:"Validación posterior"}),()=>caller.archive({artifactId:1,reason:"Archivo posterior"}),()=>caller.setApplicability({entityType:"recurring_service",entityId:2040001,requirementCode:"contract",applicability:"required",reason:"Cambio posterior al cierre"})];
   for(const operation of operations)await expect(operation()).rejects.toMatchObject({code:"FORBIDDEN"});
   expect(mock.storagePut).not.toHaveBeenCalled();
  });
 }
 it("cancelado también está bloqueado, mientras activo/pausado permiten el guard",async()=>{mock.status="cancelado";await expect(assertRecurringServiceWritable(2040001)).rejects.toMatchObject({code:"FORBIDDEN"});mock.status="activo";await expect(assertRecurringServiceWritable(2040001)).resolves.toBeUndefined();mock.status="pausado";await expect(assertRecurringServiceWritable(2040001)).resolves.toBeUndefined();});
});
