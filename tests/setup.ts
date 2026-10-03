import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "betsport-test-")),
  "test.sqlite",
);
process.env.JWT_SECRET = randomBytes(48).toString("hex");

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
const sqlite = new DatabaseSync(process.env.DATABASE_PATH!);
sqlite.exec(readFileSync("database/schema.sql", "utf8"));
sqlite.close();
