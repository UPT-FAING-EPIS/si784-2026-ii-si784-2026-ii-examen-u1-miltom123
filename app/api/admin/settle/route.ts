import { route, body } from "@/lib/api";
import { settleEvent } from "@/lib/db";
export const POST = route(async (req) => {
  const b = await body(req);
  return {
    success: true,
    data: await settleEvent(b.eventId, b.winningOutcomeIds),
  };
}, "admin");
