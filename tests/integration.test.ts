import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  createUser,
  registerUser,
  getAllUsers,
  getAllEvents,
  getUserById,
  createEvent,
  updateEvent,
  updateOutcomeOdds,
  placeBet,
  settleEvent,
  cancelEvent,
  recordBalance,
  getUserTransactions,
  getUserBets,
  generateReports,
  setUserRole,
} from "../lib/db";
import { POST as register } from "../app/api/auth/register/route";
import { POST as login } from "../app/api/auth/login/route";
import { POST as deposit } from "../app/api/balance/deposit/route";
import { POST as create } from "../app/api/admin/events/route";
import { GET as balance } from "../app/api/balance/[userId]/route";
import { generateToken, verifyToken } from "../lib/auth";
import { randomUUID } from "node:crypto";
// Fixtures are created only in an isolated temporary SQLite database.
const connection = new DatabaseSync(process.env.DATABASE_PATH!);
beforeEach(() => {
  connection.exec(
    "PRAGMA foreign_keys=ON; DELETE FROM notifications; DELETE FROM transactions; DELETE FROM balance_references; DELETE FROM bet_items; DELETE FROM bets; DELETE FROM outcomes; DELETE FROM markets; DELETE FROM events; DELETE FROM users;",
  );
});
async function account(role: "bettor" | "admin" = "bettor") {
  return await createUser({
    name: "Usuario de prueba",
    email: `${randomUUID()}@example.test`,
    password: "Strong-test-pass-123",
    role,
  });
}
async function event() {
  return await createEvent({
    sport: "Tenis",
    league: "Torneo de prueba aislado",
    homeTeam: "Competidor A",
    awayTeam: "Competidor B",
    startTime: new Date(Date.now() + 3600000).toISOString(),
    status: "PRE_MATCH",
    markets: [
      {
        id: "",
        eventId: "",
        name: "Ganador",
        type: "MONEYLINE",
        status: "ACTIVE",
        outcomes: [
          { id: "", marketId: "", name: "A", odds: 2, status: "OPEN" },
          { id: "", marketId: "", name: "B", odds: 3, status: "OPEN" },
        ],
      },
    ],
  });
}
async function bet(
  userId: string,
  e?: import("../lib/types").SportEvent,
  stake = 10,
) {
  e = e || (await event());
  return await placeBet({
    userId,
    type: "SINGLE",
    stake,
    items: [
      {
        eventId: e.id,
        marketId: e.markets[0].id,
        outcomeId: e.markets[0].outcomes[0].id,
        odds: e.markets[0].outcomes[0].odds,
      },
    ],
  });
}
function request(path: string, data?: unknown, token?: string) {
  return new Request(`http://localhost:3000/api/${path}`, {
    method: data ? "POST" : "GET",
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}
describe("Persistencia, reglas de negocio y permisos", () => {
  it("arranca vacío y no otorga saldo al registrar", async () => {
    expect(await getAllUsers()).toEqual([]);
    expect(await getAllEvents()).toEqual([]);
    const u = await registerUser({
      name: "Primer usuario",
      email: "first@example.test",
      password: "Strong-password123",
    });
    expect(u.balance).toBe(0);
    expect(u.role).toBe("admin");
    expect(
      (
        await registerUser({
          name: "Segundo usuario",
          email: "second@example.test",
          password: "Strong-password123",
        })
      ).role,
    ).toBe("bettor");
  });
  it("persiste usuarios en una conexión SQLite independiente", async () => {
    const u = await account();
    const other = new DatabaseSync(process.env.DATABASE_PATH!);
    expect(
      other.prepare("SELECT email FROM users WHERE id=?").get(u.id)?.email,
    ).toBe(u.email);
    other.close();
  });
  it("normaliza y evita correos duplicados", async () => {
    const u = await account();
    await expect(
      (async () =>
        await createUser({
          name: "Duplicado",
          email: u.email.toUpperCase(),
          password: "Strong-test-pass-123",
        }))(),
    ).rejects.toThrow();
  });
  it("no permite retirar por encima del saldo y revierte la referencia", async () => {
    const u = await account();
    await recordBalance(u.id, 30, "DEPOSIT", "Registro personal", "dep-1");
    await expect(
      (async () =>
        await recordBalance(
          u.id,
          31,
          "WITHDRAWAL",
          "Cuenta personal",
          "withdraw-1",
        ))(),
    ).rejects.toThrow("Saldo insuficiente");
    await recordBalance(
      u.id,
      20,
      "WITHDRAWAL",
      "Cuenta personal",
      "withdraw-1",
    );
    expect((await getUserById(u.id))?.balance).toBe(10);
  });
  it.each([NaN, Infinity, -1, 0, 0.001, 10001])(
    "rechaza monto inválido %s sin modificar saldo",
    async (amount) => {
      const u = await account();
      await expect(
        (async () =>
          await recordBalance(u.id, amount, "DEPOSIT", "Manual", "invalid"))(),
      ).rejects.toThrow();
      expect((await getUserById(u.id))?.balance).toBe(0);
      expect(await getUserTransactions(u.id)).toHaveLength(0);
    },
  );
  it("no acredita dos veces una referencia", async () => {
    const u = await account();
    await recordBalance(u.id, 10, "DEPOSIT", "Manual", "unique");
    await expect(
      (async () =>
        await recordBalance(u.id, 10, "DEPOSIT", "Manual", "unique"))(),
    ).rejects.toThrow();
    expect((await getUserById(u.id))?.balance).toBe(10);
  });
  it("la apuesta toma cuota vigente, debita y deja auditoría", async () => {
    const u = await account();
    await recordBalance(u.id, 100, "DEPOSIT", "Manual", "fund");
    const b = await bet(u.id);
    expect(b.success).toBe(true);
    expect(b.bet?.potentialPayout).toBe(20);
    expect((await getUserById(u.id))?.balance).toBe(90);
    expect(await getUserTransactions(u.id)).toHaveLength(2);
  });
  it("rechaza cuota manipulada o desactualizada sin descontar", async () => {
    const u = await account();
    await recordBalance(u.id, 100, "DEPOSIT", "Manual", "fund");
    const e = await event();
    await updateOutcomeOdds(e.id, e.markets[0].outcomes[0].id, 2.5);
    expect((await bet(u.id, e)).success).toBe(false);
    expect((await getUserById(u.id))?.balance).toBe(100);
  });
  it("dos apuestas sucesivas no pueden gastar el mismo saldo", async () => {
    const u = await account();
    await recordBalance(u.id, 10, "DEPOSIT", "Manual", "fund");
    const e = await event();
    expect((await bet(u.id, e, 10)).success).toBe(true);
    expect((await bet(u.id, e, 10)).success).toBe(false);
    expect((await getUserById(u.id))?.balance).toBe(0);
  });
  it("rechaza apuestas vacías y selecciones correlacionadas", async () => {
    const u = await account();
    await recordBalance(u.id, 100, "DEPOSIT", "Manual", "fund");
    const e = await event();
    expect(
      (await placeBet({ userId: u.id, stake: 10, type: "SINGLE", items: [] }))
        .success,
    ).toBe(false);
    const i = {
      eventId: e.id,
      marketId: e.markets[0].id,
      outcomeId: e.markets[0].outcomes[0].id,
      odds: 2,
    };
    expect(
      (
        await placeBet({
          userId: u.id,
          stake: 10,
          type: "PARLAY",
          items: [i, i],
        })
      ).success,
    ).toBe(false);
  });
  it("liquida una sola vez y cierra el evento", async () => {
    const u = await account();
    await recordBalance(u.id, 100, "DEPOSIT", "Manual", "fund");
    const e = await event();
    await bet(u.id, e);
    const winner = e.markets[0].outcomes[0].id;
    expect((await settleEvent(e.id, [winner])).totalPaidOut).toBe(20);
    expect((await settleEvent(e.id, [winner])).totalPaidOut).toBe(0);
    expect((await getUserById(u.id))?.balance).toBe(110);
    expect((await bet(u.id, e)).success).toBe(false);
  });
  it("una combinada espera todos los eventos ganados", async () => {
    const u = await account();
    await recordBalance(u.id, 100, "DEPOSIT", "Manual", "fund");
    const a = await event(),
      b = await event();
    const result = await placeBet({
      userId: u.id,
      stake: 10,
      type: "PARLAY",
      items: [a, b].map((e) => ({
        eventId: e.id,
        marketId: e.markets[0].id,
        outcomeId: e.markets[0].outcomes[0].id,
        odds: 2,
      })),
    });
    expect(result.success).toBe(true);
    await settleEvent(a.id, [a.markets[0].outcomes[0].id]);
    expect((await getUserBets(u.id))[0].status).toBe("PENDING");
    await settleEvent(b.id, [b.markets[0].outcomes[0].id]);
    expect((await getUserById(u.id))?.balance).toBe(130);
  });
  it("rechaza liquidación con resultados ajenos sin cerrar evento", async () => {
    const e = await event();
    await expect(
      (async () => await settleEvent(e.id, ["invalid"]))(),
    ).rejects.toThrow();
    expect((await getAllEvents())[0].status).toBe("PRE_MATCH");
  });
  it("cancela con devolución única y excluye cancelados del margen", async () => {
    const u = await account();
    await recordBalance(u.id, 100, "DEPOSIT", "Manual", "fund");
    const e = await event();
    await bet(u.id, e);
    await cancelEvent(e.id);
    await cancelEvent(e.id);
    expect((await getUserById(u.id))?.balance).toBe(100);
    expect((await getUserBets(u.id))[0].status).toBe("CANCELLED");
    expect((await generateReports()).grossGamingRevenue).toBe(0);
  });
  it("el desglose del reporte usa deporte y filtra por fecha", async () => {
    const u = await account();
    await recordBalance(u.id, 100, "DEPOSIT", "Manual", "fund");
    await bet(u.id);
    expect(
      (await generateReports({ sport: "Tenis" })).sportBreakdown[0].sport,
    ).toBe("Tenis");
    expect((await generateReports({ startDate: "2099-01-01" })).totalBets).toBe(
      0,
    );
  });
  it("no puede eliminar el último administrador", async () => {
    const u = await account("admin");
    await expect(
      (async () => await setUserRole(u.id, "bettor"))(),
    ).rejects.toThrow("Debe conservar");
  });
  it("valida marcadores y no reabre un evento finalizado", async () => {
    const e = await event();
    await expect(
      (async () => await updateEvent(e.id, { homeScore: -1 }))(),
    ).rejects.toThrow();
    await settleEvent(e.id, [e.markets[0].outcomes[0].id]);
    await expect(
      (async () => await updateEvent(e.id, { status: "LIVE" }))(),
    ).rejects.toThrow();
  });
});
describe("API autenticada sin mocks", () => {
  it("emite JWT válido y cookie HttpOnly al registrar", async () => {
    const response = await register(
      request("auth/register", {
        name: "Usuario nuevo",
        email: "new@example.test",
        password: "Long-password-123",
        role: "admin",
        initialBalance: 500,
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    const body = await response.json();
    expect(body.user.balance).toBe(0);
    expect(body.user.password).toBeUndefined();
    expect(verifyToken(body.token)?.userId).toBe(body.user.id);
  });
  it("el segundo registro no puede elegir rol admin", async () => {
    await account("admin");
    const response = await register(
      request("auth/register", {
        name: "Usuario nuevo",
        email: "other@example.test",
        password: "Long-password-123",
        role: "admin",
      }),
    );
    expect((await response.json()).user.role).toBe("bettor");
  });
  it("rechaza credenciales incorrectas", async () => {
    const u = await account();
    expect(
      (
        await login(
          request("auth/login", { email: u.email, password: "wrong" }),
        )
      ).status,
    ).toBe(401);
  });
  it("bloquea depósitos anónimos y acceso a saldo ajeno", async () => {
    expect(
      (await deposit(request("balance/deposit", { amount: 100 }))).status,
    ).toBe(401);
    const a = await account(),
      b = await account();
    expect(
      (await balance(request(`balance/${b.id}`, undefined, generateToken(a))))
        .status,
    ).toBe(403);
  });
  it("bloquea administración para apostadores", async () => {
    const u = await account();
    expect(
      (await create(request("admin/events", {}, generateToken(u)))).status,
    ).toBe(403);
  });
  it("usa el rol actual de base de datos aunque JWT contenga admin", async () => {
    const u = await account("admin");
    await account("admin");
    const token = generateToken(u);
    await setUserRole(u.id, "bettor");
    expect((await create(request("admin/events", {}, token))).status).toBe(403);
  });
  it("rechaza JWT alterado", async () => {
    const u = await account();
    const token = generateToken(u);
    expect(verifyToken(token + "tampered")).toBeNull();
    expect(
      (await balance(request(`balance/${u.id}`, undefined, token + "tampered")))
        .status,
    ).toBe(401);
  });
  it("rechaza origen externo para solicitudes con efectos", async () => {
    const u = await account();
    const req = request(
      "balance/deposit",
      { amount: 10, paymentMethod: "Manual", reference: "x" },
      generateToken(u),
    );
    req.headers.set("Origin", "https://foreign.example");
    expect((await deposit(req)).status).toBe(403);
  });
});
