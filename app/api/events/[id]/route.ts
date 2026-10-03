import { route, resourceId, ApiError } from "@/lib/api";
import { getEventById } from "@/lib/db";
export const GET = route(async (req) => {
  const data = await getEventById(resourceId(req));
  if (!data) throw new ApiError("Evento no encontrado", 404);
  return { success: true, data };
}, "public");
