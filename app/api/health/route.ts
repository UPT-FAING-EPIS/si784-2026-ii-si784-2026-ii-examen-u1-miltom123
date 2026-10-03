import { route } from "@/lib/api";
import { getAllEvents } from "@/lib/db";
export const GET = route(async () => {
  await getAllEvents();
  return { success: true, status: "ok" };
}, "public");
