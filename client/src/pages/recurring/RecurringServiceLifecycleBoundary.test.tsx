import React from "react";
import {describe,it,expect,vi,beforeEach} from "vitest";
import {render,screen,cleanup} from "@testing-library/react";
import {readFileSync} from "node:fs";
const mocks=vi.hoisted(()=>({query:vi.fn(),active:vi.fn()}));
vi.mock("@/lib/trpc",()=>({trpc:{recurringServices:{getById:{useQuery:mocks.query}}}}));
vi.mock("wouter",()=>({useParams:()=>({id:"2040001"}),Link:({children,...props}:any)=><a {...props}>{children}</a>}));
vi.mock("./ClosedRecurringServiceArchive",()=>({default:()=> <div>Archivo cerrado de sólo consulta</div>}));
import {withRecurringServiceLifecycle} from "./RecurringServiceLifecycleBoundary";
function Active(){mocks.active();return <button>Editar configuración</button>;}
const Guarded=withRecurringServiceLifecycle(Active);
describe("frontera de lifecycle recurrente",()=>{
 beforeEach(()=>{cleanup();vi.clearAllMocks();});
 it.each(["completado","cancelado"])("%s no monta página editable",status=>{mocks.query.mockReturnValue({isLoading:false,data:{service:{status}}});render(<Guarded/>);expect(screen.getByText("Archivo cerrado de sólo consulta")).toBeTruthy();expect(screen.queryByText("Editar configuración")).toBeNull();expect(mocks.active).not.toHaveBeenCalled();});
 it.each(["activo","pausado"])("%s conserva la página del servicio",status=>{mocks.query.mockReturnValue({isLoading:false,data:{service:{status}}});render(<Guarded/>);expect(screen.getByText("Editar configuración")).toBeTruthy();expect(mocks.active).toHaveBeenCalled();});
 it("sin estado confirmado falla cerrado, sin formularios",()=>{mocks.query.mockReturnValue({isLoading:false,error:new Error("No disponible")});render(<Guarded/>);expect(screen.getByText("No se pudo verificar el estado del servicio")).toBeTruthy();expect(mocks.active).not.toHaveBeenCalled();});
 it("protege las seis rutas incluida inicialización y ejecución",()=>{const source=readFileSync("client/src/App.tsx","utf8");for(const name of ["RecurringDetailRoute","RecurringInitRoute","RecurringPlanRoute","RecurringJsmRoute","RecurringExecutionRoute","RecurringClosureRoute"]){expect(source).toContain(`component={${name}}`);expect(source).toContain(`const ${name} = withRecurringServiceLifecycle(`);}});
});
