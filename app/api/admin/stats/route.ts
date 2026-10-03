import { route } from "@/lib/api";
import { generateReports, getAllUsers, getAllEvents } from "@/lib/db";
export const GET = route(
  async () => ({
    success: true,
    data: {
      totalUsers: (await getAllUsers()).length,
      totalEvents: (await getAllEvents()).length,
      metrics: await generateReports(),
    },
  }),
  "admin",
);
