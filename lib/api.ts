import { NextResponse } from "next/server";
import { extractTokenFromHeader, verifyToken } from "./auth";
import { getUserById } from "./db";
import type { User } from "./types";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function session(request: Request): Promise<User | null> {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("betsport_session="))
    ?.slice("betsport_session=".length);
  const token =
    extractTokenFromHeader(request.headers.get("authorization")) || cookie;
  const payload = token ? verifyToken(token) : null;
  return payload ? await getUserById(payload.userId) : null;
}
export function owner(user: User, userId: string) {
  if (user.id !== userId && user.role !== "admin")
    throw new ApiError("No autorizado", 403);
}
export function route(
  handler: (req: Request, user: User) => unknown | Promise<unknown>,
  access: "public" | "user" | "admin" = "user",
) {
  return async (request: Request) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        const origin = request.headers.get("origin");
        const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
        if (origin && origin !== expected)
          throw new ApiError("Origen no permitido", 403);
        if (Number(request.headers.get("content-length") || 0) > 65536)
          throw new ApiError("Solicitud demasiado grande", 413);
      }
      const user = await session(request);
      if (access !== "public" && !user)
        throw new ApiError("Inicie sesión", 401);
      if (access === "admin" && user?.role !== "admin")
        throw new ApiError("Requiere administrador", 403);
      const result = await handler(request, user!);
      if (result instanceof Response) return result;
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      if (error instanceof ApiError)
        return NextResponse.json(
          { success: false, message: error.message },
          { status: error.status },
        );
      if (error instanceof SyntaxError)
        return NextResponse.json(
          { success: false, message: "JSON inválido" },
          { status: 400 },
        );
      if (error instanceof Error && /UNIQUE constraint/.test(error.message))
        return NextResponse.json(
          {
            success: false,
            message: "El correo o la referencia ya está registrado",
          },
          { status: 409 },
        );
      // Business errors are safe messages; never send SQLite queries or internal paths.
      const message =
        error instanceof Error &&
        !/SQLITE|constraint|database|ENOENT/i.test(error.message)
          ? error.message
          : "No se pudo procesar la operación";
      return NextResponse.json({ success: false, message }, { status: 400 });
    }
  };
}
export function authResponse(user: User, token: string, status = 200) {
  const { password, ...safe } = user;
  const response = NextResponse.json(
    { success: true, user: safe, token },
    { status },
  );
  response.cookies.set("betsport_session", token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/",
    maxAge: 28800,
  });
  return response;
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 65536) throw new ApiError("Solicitud demasiado grande", 413);
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError("Objeto JSON requerido");
  return value;
}
export function resourceId(request: Request) {
  return decodeURIComponent(new URL(request.url).pathname.split("/").pop()!);
}
const attempts = new Map<
  string,
  {
    count: number;
    until: number;
  }
>();
export function authLimit(email: string) {
  const key = email.toLowerCase();
  const item = attempts.get(key);
  if (item && item.until > Date.now()) {
    if (item.count >= 20)
      throw new ApiError("Demasiados intentos; espere 15 minutos", 429);
    item.count++;
  } else {
    if (attempts.size > 10000) attempts.clear();
    attempts.set(key, { count: 1, until: Date.now() + 900000 });
  }
}
