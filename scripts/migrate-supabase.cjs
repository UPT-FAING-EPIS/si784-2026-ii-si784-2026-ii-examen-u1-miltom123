const { readFileSync, existsSync } = require("node:fs");
const { Pool } = require("pg");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
let connectionString = process.env.DATABASE_URL;
if (!connectionString && process.env.SUPABASE_DB_PASSWORD) {
  const url = new URL(
    "postgresql://postgres.vjsrxkfviackpkiyvgai@aws-0-ca-central-1.pooler.supabase.com:6543/postgres",
  );
  url.password = process.env.SUPABASE_DB_PASSWORD;
  connectionString = url.toString();
}
if (!connectionString)
  throw new Error("Falta la contraseña PostgreSQL de Supabase");
const pool = new Pool({
  connectionString,
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("database/supabase-ca.crt", "utf8"),
  },
});
(async () => {
  await pool.query(readFileSync("database/postgres.sql", "utf8"));
  const result = await pool.query(
    "SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema='betsport'",
  );
  console.log(
    `Supabase conectado: ${result.rows[0].tables} tablas del proyecto verificadas.`,
  );
})()
  .catch((error) => {
    console.error(
      "No se pudo aplicar la migración: " +
        error.message.replace(/postgresql:\/\/\S+/g, "[CONNECTION REDACTED]"),
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
