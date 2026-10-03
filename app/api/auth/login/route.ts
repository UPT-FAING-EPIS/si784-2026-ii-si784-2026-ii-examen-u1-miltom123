import { route, body, authResponse, ApiError, authLimit } from "@/lib/api";
import { getUserByEmail } from "@/lib/db";
import { generateToken, comparePassword } from "@/lib/auth";
import { validateLogin } from "@/lib/validation";
export const POST = route(async (req) => {
  const b = await body(req);
  const v = validateLogin(b);
  if (!v.valid) throw new ApiError(Object.values(v.errors).join(" "));
  authLimit(b.email);
  const u = await getUserByEmail(b.email);
  if (!u?.password || !(await comparePassword(b.password, u.password)))
    throw new ApiError("Credenciales inválidas", 401);
  return authResponse(u, generateToken(u));
}, "public");
