import { route, body, ApiError } from "@/lib/api";
import {
  createEvent,
  updateEvent,
  updateOutcomeOdds,
  cancelEvent,
} from "@/lib/db";
export const POST = route(
  async (req) => ({ success: true, data: await createEvent(await body(req)) }),
  "admin",
);
export const PUT = route(async (req) => {
  const b = await body(req);
  if (typeof b.eventId !== "string") throw new ApiError("eventId requerido");
  if (b.outcomeUpdate) {
    await updateOutcomeOdds(
      b.eventId,
      b.outcomeUpdate.outcomeId,
      b.outcomeUpdate.newOdds,
    );
    return { success: true };
  }
  return { success: true, data: await updateEvent(b.eventId, b.updates || {}) };
}, "admin");
export const DELETE = route(async (req) => {
  const b = await body(req);
  await cancelEvent(b.eventId);
  return { success: true };
}, "admin");
