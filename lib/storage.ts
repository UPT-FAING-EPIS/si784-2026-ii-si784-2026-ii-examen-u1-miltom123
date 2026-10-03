import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

// SQLite is available only for isolated tests, never as a production fallback.
const testing =
  process.env.NODE_ENV === "test" || process.env.ALLOW_SQLITE_TEST === "1";
const context = new AsyncLocalStorage<PoolClient | DatabaseSync>();
let pool: Pool | undefined;
let sqlite: DatabaseSync | undefined;
let initialized: Promise<void> | undefined;
let testQueue: Promise<unknown> = Promise.resolve();
function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_PASSWORD) {
    const url = new URL(
      "postgresql://postgres.vjsrxkfviackpkiyvgai@aws-0-ca-central-1.pooler.supabase.com:6543/postgres",
    );
    url.password = process.env.SUPABASE_DB_PASSWORD;
    return url.toString();
  }
  throw new Error(
    "Configure SUPABASE_DB_PASSWORD o DATABASE_URL para conectar Supabase",
  );
}
async function ready() {
  if (!initialized)
    initialized = (async () => {
      if (testing) {
        const path = resolve(
          /* turbopackIgnore: true */ process.env.DATABASE_PATH!,
        );
        if (!process.env.DATABASE_PATH)
          throw new Error("Las pruebas requieren una base temporal explícita");
        mkdirSync(dirname(path), { recursive: true });
        sqlite = new DatabaseSync(path);
        sqlite.exec(
          "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
        );
        sqlite.exec(readFileSync(resolve("database/schema.sql"), "utf8"));
      } else {
        pool = new Pool({
          connectionString: connectionString(),
          max: 3,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 10000,
          ssl: {
            rejectUnauthorized: true,
            ca: readFileSync(resolve("database/supabase-ca.crt"), "utf8"),
          },
        });
        // Migrations run explicitly through db:migrate, not during requests/builds.
      }
    })();
  await initialized;
}
async function query(sql: string, args: unknown[] = []) {
  await ready();
  if (sqlite) {
    const statement = sqlite.prepare(sql);
    const params = args as (string | number | null)[];
    return /^\s*(SELECT|PRAGMA)/i.test(sql)
      ? statement.all(...params)
      : (statement.run(...params), []);
  }
  let index = 0;
  const postgresSql = sql
    .replace(/\?/g, () => `$${++index}`)
    .replace(/\browid\b/g, "created_order")
    .replace(
      /\b(FROM|INTO|UPDATE|JOIN)\s+(users|events|markets|outcomes|bets|bet_items|transactions|balance_references|notifications)\b/gi,
      "$1 betsport.$2",
    );
  const client = context.getStore() as PoolClient | undefined;
  const result = await (client || pool!).query(postgresSql, args);
  return result.rows;
}
export const storage = {
  async run(sql: string, ...args: unknown[]) {
    await query(sql, args);
  },
  async get(sql: string, ...args: unknown[]) {
    return (await query(sql, args))[0];
  },
  async all(sql: string, ...args: unknown[]) {
    return query(sql, args);
  },
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await ready();
    if (sqlite) {
      const work = testQueue.then(async () => {
        sqlite!.exec("BEGIN IMMEDIATE");
        try {
          const result = await context.run(sqlite!, fn);
          sqlite!.exec("COMMIT");
          return result;
        } catch (error) {
          sqlite!.exec("ROLLBACK");
          throw error;
        }
      });
      testQueue = work.catch(() => {});
      return work;
    }
    const client = await pool!.connect();
    try {
      await client.query("BEGIN");
      // Serialize monetary and administrative mutations across Vercel instances.
      await client.query("SELECT pg_advisory_xact_lock(812531)");
      const result = await context.run(client, fn);
      await client.query(
        "UPDATE public.betsport_updates SET version=version+1, updated_at=now() WHERE id=1",
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  async close() {
    sqlite?.close();
    await pool?.end();
  },
};
