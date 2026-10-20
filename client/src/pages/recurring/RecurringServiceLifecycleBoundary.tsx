import {trpc} from "@/lib/trpc";
import {isRecurringServiceClosed} from "@shared/recurringServiceLifecycle";
import {Loader2} from "lucide-react";
import React, {type ComponentType} from "react";
import {Link,useParams} from "wouter";
import ClosedRecurringServiceArchive from "./ClosedRecurringServiceArchive";

/** Never mount editing-stage hooks/forms for a closed service. */
export function withRecurringServiceLifecycle(ActivePage:ComponentType){
 return function RecurringServiceLifecycleRoute(){
  const params=useParams<{id:string}>();const id=Number(params.id);
  const query=trpc.recurringServices.getById.useQuery({id},{enabled:Number.isFinite(id)&&id>0,staleTime:0});
  if(query.isLoading)return <div className="grid min-h-[45vh] place-items-center"><Loader2 className="animate-spin text-slate-600" aria-label="Consultando estado del servicio"/></div>;
  if(query.error||!query.data)return <section className="rounded-xl border border-slate-300 bg-white p-6 text-slate-800"><h1 className="font-bold">No se pudo verificar el estado del servicio</h1><p className="mt-2 text-sm">No se habilita edición sin confirmar su estado.</p><Link href="/recurring-services" className="mt-4 inline-block underline">Volver a servicios</Link></section>;
  if(isRecurringServiceClosed(query.data.service.status))return <ClosedRecurringServiceArchive data={query.data}/>;
  return <ActivePage/>;
 };
}
