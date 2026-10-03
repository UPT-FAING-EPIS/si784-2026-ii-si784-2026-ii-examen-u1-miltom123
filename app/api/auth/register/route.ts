import { route, body, authResponse, ApiError, authLimit } from "@/lib/api";
import { registerUser } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { validateRegister } from "@/lib/validation";
export const POST = route(async (req) => {
  const b = await body(req);
  const v = validateRegister(b);
  if (!v.valid) throw new ApiError(Object.values(v.errors).join(" "));
  authLimit(b.email);
  const u = await registerUser({
    name: b.name,
    email: b.email,
    password: b.password,
  });
  return authResponse(u, generateToken(u), 201);
}, "public");
