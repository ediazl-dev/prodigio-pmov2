import { TRPCError } from "@trpc/server";
import {
  getRecurringServiceById,
  getRecurringServiceIdForChild,
  type RecurringServiceChildResource,
} from "./recurringServicesDb";
import {
  isRecurringServiceClosed,
  RECURRING_SERVICE_CLOSED_MESSAGE,
} from "../shared/recurringServiceLifecycle";

/**
 * Authoritative lifecycle gate for recurring-service writes.
 *
 * This intentionally re-reads the service on every call instead of trusting a
 * client-provided status or a previously loaded service object. Closed
 * services are immutable for every role; reads remain available elsewhere.
 */
export async function assertRecurringServiceWritable(
  serviceId: number,
): Promise<void> {
  const service = await getRecurringServiceById(serviceId);
  if (!service) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Servicio recurrente no encontrado",
    });
  }
  if (isRecurringServiceClosed(service.status)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: RECURRING_SERVICE_CLOSED_MESSAGE,
    });
  }
}

/** Resolve a child row's real owner before allowing a mutation. */
export async function assertRecurringChildWritable(
  resource: RecurringServiceChildResource,
  childId: number,
  expectedServiceId?: number,
): Promise<number> {
  const ownerServiceId = await getRecurringServiceIdForChild(resource, childId);
  if (ownerServiceId === null) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Registro recurrente no encontrado",
    });
  }
  if (expectedServiceId !== undefined && ownerServiceId !== expectedServiceId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "El registro no pertenece al servicio recurrente indicado",
    });
  }
  await assertRecurringServiceWritable(ownerServiceId);
  return ownerServiceId;
}
