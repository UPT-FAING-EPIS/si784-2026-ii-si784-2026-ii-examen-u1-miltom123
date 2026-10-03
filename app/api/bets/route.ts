import { route, body, owner, ApiError } from "@/lib/api";
import { placeBet, getUserById } from "@/lib/db";
export const POST = route(async (req, u) => {
  const b = await body(req);
  if (b.userId) owner(u, b.userId);
  const result = await placeBet({ ...b, userId: u.id });
  if (!result.success) throw new ApiError(result.error!);
  return {
    success: true,
    data: result.bet,
    currentBalance: (await getUserById(u.id))!.balance,
  };
});
