import { route } from "@/lib/api";
import { getAllEvents } from "@/lib/db";
export const GET = route(async (req) => {
  const q = new URL(req.url).searchParams;
  const data = await getAllEvents({
    sport: q.get("sport") || undefined,
    status: q.get("status") || undefined,
    query: q.get("query") || undefined,
  });
  return { success: true, count: data.length, data };
}, "public");
