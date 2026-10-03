const { spawn } = require("node:child_process");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { randomBytes } = require("node:crypto");
const assert = require("node:assert/strict");
const { WebSocket } = require("ws");
const base = "http://127.0.0.1:3101";
const environment = {
  ...process.env,
  PORT: "3101",
  HOST: "127.0.0.1",
  APP_ORIGIN: base,
  DATABASE_PATH: join(
    mkdtempSync(join(tmpdir(), "betsport-http-")),
    "test.sqlite",
  ),
  JWT_SECRET: randomBytes(48).toString("hex"),
};
let child,
  socket,
  log = "";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function start() {
  child = spawn(process.execPath, ["server.cjs"], {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => {
    log += chunk;
  });
  child.stderr.on("data", (chunk) => {
    log += chunk;
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base + "/api/health");
      if (r.ok) return;
    } catch {}
    if (child.exitCode !== null) throw new Error(log);
    await wait(300);
  }
  throw new Error("Servidor no respondió: " + log);
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill();
  await exited;
}
async function call(path, method = "GET", body, token) {
  const r = await fetch(base + "/api/" + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie"),
  };
}
async function main() {
  await start();
  assert.equal((await call("events")).data.data.length, 0);
  const admin = await call("auth/register", "POST", {
    name: "Administrador prueba HTTP",
    email: "admin@http.example.test",
    password: "Long-test-password123",
  });
  assert.equal(admin.status, 201);
  assert.equal(admin.data.user.role, "admin");
  assert.equal(admin.data.user.balance, 0);
  const token = admin.data.token;
  const bettor = await call("auth/register", "POST", {
    name: "Apostador prueba HTTP",
    email: "bettor@http.example.test",
    password: "Long-test-password123",
    role: "admin",
  });
  assert.equal(bettor.data.user.role, "bettor");
  assert.equal(
    (await call("admin/users", "GET", undefined, bettor.data.token)).status,
    403,
  );
  const snapshots = [];
  socket = new WebSocket(base.replace("http", "ws") + "/ws", {
    origin: base,
    headers: { cookie: admin.cookie.split(";")[0] },
  });
  socket.on("message", (data) => snapshots.push(JSON.parse(data)));
  async function snapshot(predicate) {
    for (let i = 0; i < 30; i++) {
      const found = snapshots.find(predicate);
      if (found) return found;
      await wait(200);
    }
    throw new Error("WebSocket no publicó el cambio esperado");
  }
  await snapshot((s) => s.events.length === 0);
  const created = await call(
    "admin/events",
    "POST",
    {
      sport: "Tenis",
      league: "Fixture HTTP aislada",
      homeTeam: "Jugador A",
      awayTeam: "Jugador B",
      status: "PRE_MATCH",
      startTime: new Date(Date.now() + 3600000).toISOString(),
      markets: [
        {
          name: "Ganador",
          type: "MONEYLINE",
          outcomes: [
            { name: "A", odds: 2 },
            { name: "B", odds: 3 },
          ],
        },
      ],
    },
    token,
  );
  assert.equal(created.status, 200);
  const e = created.data.data;
  await snapshot((s) => s.events.length === 1);
  const deposit = await call(
    "balance/deposit",
    "POST",
    { amount: 100, paymentMethod: "Registro personal", reference: "http-1" },
    token,
  );
  assert.equal(deposit.data.data.newBalance, 100);
  const b = await call(
    "bets",
    "POST",
    {
      stake: 10,
      items: [
        {
          eventId: e.id,
          marketId: e.markets[0].id,
          outcomeId: e.markets[0].outcomes[0].id,
          odds: 2,
        },
      ],
    },
    token,
  );
  assert.equal(b.data.currentBalance, 90);
  await call(
    "admin/events",
    "PUT",
    {
      eventId: e.id,
      outcomeUpdate: { outcomeId: e.markets[0].outcomes[0].id, newOdds: 2.2 },
    },
    token,
  );
  await snapshot((s) => s.events[0]?.markets[0].outcomes[0].odds === 2.2);
  assert.equal(
    (await call("notifications", "GET", undefined, token)).data.data.some(
      (n) => n.type === "odds_change",
    ),
    true,
  );
  const settle = await call(
    "admin/settle",
    "POST",
    { eventId: e.id, winningOutcomeIds: [e.markets[0].outcomes[0].id] },
    token,
  );
  assert.equal(settle.data.data.totalPaidOut, 20);
  assert.equal(
    (
      await call(
        "admin/settle",
        "POST",
        { eventId: e.id, winningOutcomeIds: [e.markets[0].outcomes[0].id] },
        token,
      )
    ).data.data.totalPaidOut,
    0,
  );
  assert.equal(
    (await call("balance/" + admin.data.user.id, "GET", undefined, token)).data
      .balance,
    110,
  );
  assert.equal(
    (
      await call(
        "balance/" + admin.data.user.id,
        "GET",
        undefined,
        bettor.data.token,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("reports", "POST", {}, token)).data.data.totalBets,
    1,
  );
  assert.equal((await fetch(base + "/events")).status, 200);
  assert.equal((await fetch(base)).status, 200);
  socket.close();
  await new Promise((r) => socket.once("close", r));
  await stop();
  await start();
  assert.equal((await call("events")).data.data.length, 1);
  assert.equal(
    (await call("balance/" + admin.data.user.id, "GET", undefined, token)).data
      .balance,
    110,
  );
  console.log(
    "HTTP + WebSocket + reinicio: registro, permisos, depósito, apuesta, cuota, notificación, liquidación idempotente y persistencia verificados. Base temporal aislada.",
  );
}
main()
  .catch((error) => {
    console.error(error);
    console.error(log);
    process.exitCode = 1;
  })
  .finally(async () => {
    socket?.terminate();
    await stop();
  });
