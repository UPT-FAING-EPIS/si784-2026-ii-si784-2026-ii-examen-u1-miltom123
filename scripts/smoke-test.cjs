const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { randomBytes } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const base = "http://127.0.0.1:3101";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3101",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ALLOW_SQLITE_TEST: "1",
      COOKIE_SECURE: "false",
      DATABASE_PATH: join(
        mkdtempSync(join(tmpdir(), "betsport-http-")),
        "isolated.sqlite",
      ),
      JWT_SECRET: randomBytes(48).toString("hex"),
    },
  },
);
let log = "";
child.stdout.on("data", (c) => {
  log += c;
});
child.stderr.on("data", (c) => {
  log += c;
});
async function ready(remaining = 90) {
  try {
    const r = await fetch(base + "/api/health");
    if (r.ok) return;
  } catch {
    /* Startup can briefly refuse connections. */
  }
  if (remaining === 0 || child.exitCode !== null)
    throw new Error("Servidor de prueba no disponible: " + log);
  await delay(300);
  return ready(remaining - 1);
}
async function main() {
  await ready();
  assert.equal((await fetch(base)).status, 200);
  const empty = await fetch(base + "/api/events");
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json()).data, []);
  assert.equal((await fetch(base + "/events")).status, 200);
  const denied = await fetch(base + "/api/admin/users");
  assert.equal(denied.status, 401);
  const deniedBet = await fetch(base + "/api/bets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stake: 1, items: [] }),
  });
  assert.equal(deniedBet.status, 401);
  console.log(
    "HTTP: página, API, alias, base vacía y control de acceso verificados en base temporal aislada.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => child.kill());
