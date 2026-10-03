import { route, body, owner } from "@/lib/api";
import { recordBalance } from "@/lib/db";
export const POST = route(async (req, u) => {
  const b = await body(req);
  if (b.userId) owner(u, b.userId);
  return {
    success: true,
    data: await recordBalance(
      u.id,
      b.amount,
      "WITHDRAWAL",
      b.destinationAccount,
      b.reference,
    ),
    message: "Retiro registrado en el proyecto",
  };
});
