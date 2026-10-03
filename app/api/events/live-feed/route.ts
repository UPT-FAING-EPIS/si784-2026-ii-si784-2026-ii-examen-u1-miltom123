import { route } from "@/lib/api";
import { getAllEvents } from "@/lib/db";
export const GET = route(
  async () => ({
    success: true,
    liveEvents: await getAllEvents({ status: "LIVE" }),
    timestamp: new Date().toISOString(),
  }),
  "public",
);
