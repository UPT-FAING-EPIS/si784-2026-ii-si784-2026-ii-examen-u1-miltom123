import { route, body } from "@/lib/api";
import { generateReports } from "@/lib/db";
export const POST = route(
  async (req) => ({
    success: true,
    data: await generateReports(await body(req)),
  }),
  "admin",
);
export const GET = route(
  async (req) => ({
    success: true,
    data: await generateReports(
      Object.fromEntries(new URL(req.url).searchParams),
    ),
  }),
  "admin",
);
