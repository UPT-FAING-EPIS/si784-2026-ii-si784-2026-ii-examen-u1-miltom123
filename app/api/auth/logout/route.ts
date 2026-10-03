import { route } from "@/lib/api";
import { NextResponse } from "next/server";
export const POST = route(async () => {
  const r = NextResponse.json({ success: true });
  r.cookies.set("betsport_session", "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return r;
}, "public");
