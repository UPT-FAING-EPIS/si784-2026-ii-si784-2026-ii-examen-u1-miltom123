import { route, owner, resourceId, ApiError } from "@/lib/api";
import { getUserById, getUserTransactions } from "@/lib/db";
export const GET = route(async (req, u) => {
  const userId = resourceId(req);
  owner(u, userId);
  const user = await getUserById(userId);
  if (!user) throw new ApiError("Usuario no encontrado", 404);
  return {
    success: true,
    balance: user.balance,
    currency: user.currency,
    transactions: await getUserTransactions(userId),
  };
});
