import { route, body } from "@/lib/api";
import { getAllUsers, setUserRole } from "@/lib/db";
export const GET = route(
  async () => ({ success: true, data: await getAllUsers() }),
  "admin",
);
export const PUT = route(async (req) => {
  const b = await body(req);
  return { success: true, data: await setUserRole(b.userId, b.role) };
}, "admin");
