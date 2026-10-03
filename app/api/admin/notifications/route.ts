import { route, body, ApiError } from "@/lib/api";
import { addNotification } from "@/lib/db";
export const POST = route(async (req) => {
  const b = await body(req);
  if (
    typeof b.title !== "string" ||
    !b.title.trim() ||
    b.title.length > 120 ||
    typeof b.message !== "string" ||
    !b.message.trim() ||
    b.message.length > 1000
  )
    throw new ApiError(
      "Título y mensaje son obligatorios (120/1000 caracteres)",
    );
  return {
    success: true,
    data: await addNotification({
      title: b.title,
      message: b.message,
      type: "info",
    }),
  };
}, "admin");
