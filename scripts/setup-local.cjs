const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
if (!fs.existsSync(".env.local")) {
  fs.writeFileSync(
    ".env.local",
    `JWT_SECRET=${randomBytes(48).toString("hex")}\nSUPABASE_DB_PASSWORD=""\nNEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\nCOOKIE_SECURE=false\n`,
    { mode: 0o600 },
  );
  console.log(
    "Configuración local creada. No contiene usuarios ni datos de negocio.",
  );
}
