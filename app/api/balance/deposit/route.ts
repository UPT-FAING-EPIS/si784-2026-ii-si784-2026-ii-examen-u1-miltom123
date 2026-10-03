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
      "DEPOSIT",
      b.paymentMethod,
      b.reference,
    ),
    message: "Depósito registrado en el proyecto",
  };
});
