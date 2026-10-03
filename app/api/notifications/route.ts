import { route, owner } from "@/lib/api";
import { getNotifications } from "@/lib/db";
export const GET = route(async (req, u) => {
  const requested = new URL(req.url).searchParams.get("userId") || u.id;
  owner(u, requested);
  return { success: true, data: await getNotifications(requested) };
});
