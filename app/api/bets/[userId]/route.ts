import { route, owner, resourceId } from "@/lib/api";
import { getUserBets } from "@/lib/db";
export const GET = route(async (req, u) => {
  const userId = resourceId(req);
  owner(u, userId);
  const data = await getUserBets(
    userId,
    new URL(req.url).searchParams.get("status") || undefined,
  );
  return { success: true, data, count: data.length };
});
