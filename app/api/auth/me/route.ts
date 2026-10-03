import { route } from "@/lib/api";
export const GET = route(async (req, user) => {
  const { password, ...safe } = user;
  return { success: true, user: safe };
});
