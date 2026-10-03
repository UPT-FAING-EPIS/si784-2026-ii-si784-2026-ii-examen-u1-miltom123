import { storage } from "./storage";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type {
  User,
  SportEvent,
  Bet,
  BetItem,
  Transaction,
  NotificationItem,
  ReportFilter,
  ReportMetrics,
} from "./types";
const now = () => new Date().toISOString();
const id = () => randomUUID();
const round = (n: number) => Math.round(n * 100) / 100;
async function atomic<T>(fn: () => Promise<T>): Promise<T> {
  return storage.transaction(fn);
}
function decode<T>(row: unknown): T | null {
  if (!row) return null;
  const data = (
    row as {
      data: unknown;
    }
  ).data;
  return (typeof data === "string" ? JSON.parse(data) : data) as T;
}
async function all<T>(sql: string, ...args: string[]): Promise<T[]> {
  return (await storage.all(sql, ...args)).map((r) => decode<T>(r)!);
}
async function saveUser(u: User) {
  await storage.run(
    "UPDATE users SET role=?, balance_cents=?, data=? WHERE id=?",
    u.role,
    Math.round(u.balance * 100),
    JSON.stringify(u),
    u.id,
  );
}
export async function getUserById(userId: string): Promise<User | null> {
  return decode(await storage.get("SELECT data FROM users WHERE id=?", userId));
}
export async function getUserByEmail(email: string): Promise<User | null> {
  return decode(
    await storage.get(
      "SELECT data FROM users WHERE email=?",
      email.toLowerCase().trim(),
    ),
  );
}
export async function getAllUsers(): Promise<User[]> {
  return (await all<User>("SELECT data FROM users")).map(
    ({ password, ...u }) => u,
  );
}
export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role?: "admin" | "bettor";
}): Promise<User> {
  const u: User = {
    id: id(),
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    password: bcrypt.hashSync(input.password, 12),
    role: input.role || "bettor",
    balance: 0,
    currency: "USD",
    createdAt: now(),
    updatedAt: now(),
  };
  await storage.run(
    "INSERT INTO users (id,email,role,balance_cents,data) VALUES (?,?,?,?,?)",
    u.id,
    u.email,
    u.role,
    0,
    JSON.stringify(u),
  );
  return u;
}
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  return await atomic(
    async () =>
      await createUser({
        ...input,
        role: (await getAllUsers()).length === 0 ? "admin" : "bettor",
      }),
  );
}
export async function setUserRole(userId: string, role: "admin" | "bettor") {
  if (!["admin", "bettor"].includes(role)) throw new Error("Rol inválido");
  return await atomic(async () => {
    const u = await getUserById(userId);
    if (!u) throw new Error("Usuario no encontrado");
    if (
      u.role === "admin" &&
      role !== "admin" &&
      (await getAllUsers()).filter((x) => x.role === "admin").length === 1
    )
      throw new Error("Debe conservar un administrador");
    u.role = role;
    u.updatedAt = now();
    await saveUser(u);
    return { ...u, password: undefined };
  });
}
async function saveEvent(e: SportEvent) {
  await storage.run(
    "UPDATE events SET data=? WHERE id=?",
    JSON.stringify(e),
    e.id,
  );
}
export async function getAllEvents(filters?: {
  sport?: string;
  status?: string;
  query?: string;
}): Promise<SportEvent[]> {
  return (await all<SportEvent>("SELECT data FROM events")).filter(
    (e) =>
      (!filters?.sport ||
        filters.sport === "Todos" ||
        e.sport === filters.sport) &&
      (!filters?.status ||
        filters.status === "ALL" ||
        e.status === filters.status) &&
      (!filters?.query ||
        `${e.homeTeam} ${e.awayTeam} ${e.league}`
          .toLowerCase()
          .includes(filters.query.toLowerCase())),
  );
}
export async function getEventById(
  eventId: string,
): Promise<SportEvent | null> {
  return decode(
    await storage.get("SELECT data FROM events WHERE id=?", eventId),
  );
}
function validateEvent(e: Partial<SportEvent>) {
  for (const field of [e.league, e.homeTeam, e.awayTeam, e.stadium, e.minute]) {
    if (
      field !== undefined &&
      (typeof field !== "string" || field.length > 150)
    )
      throw new Error(
        "Los textos del evento deben tener máximo 150 caracteres",
      );
  }
  if (
    !["Fútbol", "Baloncesto", "Tenis", "eSports", "Béisbol"].includes(
      e.sport || "",
    ) ||
    typeof e.league !== "string" ||
    !e.league.trim() ||
    typeof e.homeTeam !== "string" ||
    !e.homeTeam.trim() ||
    typeof e.awayTeam !== "string" ||
    !e.awayTeam.trim() ||
    e.homeTeam.trim().toLowerCase() === e.awayTeam.trim().toLowerCase() ||
    !Number.isFinite(Date.parse(e.startTime || ""))
  )
    throw new Error(
      "Evento inválido: deporte, liga, equipos distintos y fecha son obligatorios",
    );
  if (!["PRE_MATCH", "LIVE"].includes(e.status || "PRE_MATCH"))
    throw new Error("Un evento nuevo debe ser pre-partido o en vivo");
  if (
    (e.status || "PRE_MATCH") === "PRE_MATCH" &&
    Date.parse(e.startTime!) <= Date.now()
  )
    throw new Error("Un evento pre-partido debe tener fecha futura");
  if (!Array.isArray(e.markets) || !e.markets.length || e.markets.length > 20)
    throw new Error("Debe ingresar mercados y cuotas");
  for (const m of e.markets) {
    if (
      typeof m.name !== "string" ||
      !m.name.trim() ||
      m.name.length > 150 ||
      !["1X2", "MONEYLINE", "TOTALS", "BTTS", "HANDICAP", "SCORE"].includes(
        m.type,
      ) ||
      !Array.isArray(m.outcomes) ||
      m.outcomes.length < 2 ||
      m.outcomes.length > 50
    )
      throw new Error("Mercado inválido");
    for (const o of m.outcomes)
      if (
        typeof o.name !== "string" ||
        !o.name.trim() ||
        o.name.length > 150 ||
        !Number.isFinite(o.odds) ||
        o.odds <= 1 ||
        o.odds > 1000 ||
        Math.abs(o.odds * 100 - Math.round(o.odds * 100)) > 0.000001
      )
        throw new Error("Cuota inválida");
    if (
      new Set(m.outcomes.map((o) => o.name.trim().toLowerCase())).size !==
      m.outcomes.length
    )
      throw new Error("Las selecciones deben ser distintas");
  }
}
export async function createEvent(
  input: Partial<SportEvent>,
): Promise<SportEvent> {
  validateEvent(input);
  return await atomic(async () => {
    const eventId = id();
    const e: SportEvent = {
      id: eventId,
      sport: input.sport!,
      league: input.league!.trim(),
      homeTeam: input.homeTeam!.trim(),
      awayTeam: input.awayTeam!.trim(),
      homeScore: 0,
      awayScore: 0,
      status: input.status || "PRE_MATCH",
      startTime: input.startTime!,
      minute: input.minute || "",
      stadium: input.stadium || "",
      markets: input.markets!.map((m) => {
        const marketId = id();
        return {
          id: marketId,
          eventId,
          name: m.name,
          type: m.type,
          status: "ACTIVE",
          outcomes: m.outcomes.map((o) => ({
            id: id(),
            marketId,
            name: o.name,
            odds: o.odds,
            status: "OPEN",
            trend: "same",
          })),
        };
      }),
    };
    await storage.run(
      "INSERT INTO events(id,data) VALUES (?,?)",
      e.id,
      JSON.stringify(e),
    );
    for (const m of e.markets) {
      await storage.run(
        "INSERT INTO markets(id,event_id) VALUES (?,?)",
        m.id,
        e.id,
      );
      for (const o of m.outcomes)
        await storage.run(
          "INSERT INTO outcomes(id,market_id) VALUES (?,?)",
          o.id,
          m.id,
        );
    }
    return e;
  });
}
export async function updateEvent(
  eventId: string,
  updates: Partial<SportEvent>,
): Promise<SportEvent> {
  return await atomic(async () => {
    const e = await getEventById(eventId);
    if (!e) throw new Error("Evento no encontrado");
    if (["FINISHED", "CANCELLED"].includes(e.status))
      throw new Error("Evento cerrado");
    for (const key of ["homeScore", "awayScore"] as const) {
      if (updates[key] !== undefined) {
        if (
          !Number.isInteger(updates[key]) ||
          updates[key]! < 0 ||
          updates[key]! > 10000
        )
          throw new Error("Marcador inválido");
        e[key] = updates[key]!;
      }
    }
    if (updates.status) {
      if (!["PRE_MATCH", "LIVE"].includes(updates.status))
        throw new Error("Use liquidación o cancelación para cerrar el evento");
      if (e.status === "LIVE" && updates.status === "PRE_MATCH")
        throw new Error("Un evento en vivo no puede volver a pre-partido");
      e.status = updates.status;
    }
    if (updates.minute !== undefined)
      e.minute = String(updates.minute).slice(0, 50);
    await saveEvent(e);
    return e;
  });
}
export async function updateOutcomeOdds(
  eventId: string,
  outcomeId: string,
  odds: number,
): Promise<boolean> {
  if (
    !Number.isFinite(odds) ||
    odds <= 1 ||
    odds > 1000 ||
    Math.abs(odds * 100 - Math.round(odds * 100)) > 0.000001
  )
    throw new Error("Cuota inválida");
  return await atomic(async () => {
    const e = await getEventById(eventId);
    if (!e || ["FINISHED", "CANCELLED"].includes(e.status))
      throw new Error("Evento no disponible");
    const o = e.markets
      .flatMap((m) => m.outcomes)
      .find((x) => x.id === outcomeId);
    if (!o) throw new Error("Selección no encontrada");
    o.previousOdds = o.odds;
    o.odds = round(odds);
    o.trend =
      o.odds > o.previousOdds
        ? "up"
        : o.odds < o.previousOdds
          ? "down"
          : "same";
    await saveEvent(e);
    await addNotification({
      title: "Cambio de cuota",
      message: `${e.homeTeam} vs ${e.awayTeam}: ${o.name}, ${o.previousOdds} → ${o.odds}`,
      type: "odds_change",
    });
    return true;
  });
}
function money(amount: number) {
  if (
    !Number.isFinite(amount) ||
    amount < 1 ||
    amount > 10000 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001
  )
    throw new Error("Monto inválido (1–10000 USD, máximo dos decimales)");
}
async function ledger(
  user: User,
  amount: number,
  type: Transaction["type"],
  referenceId: string,
  paymentMethod: string,
) {
  const before = user.balance;
  user.balance = round(before + amount);
  user.updatedAt = now();
  if (user.balance < 0) throw new Error("Saldo insuficiente");
  await saveUser(user);
  const tx: Transaction = {
    id: id(),
    userId: user.id,
    type,
    amount,
    balanceBefore: before,
    balanceAfter: user.balance,
    referenceId,
    paymentMethod,
    status: "COMPLETED",
    description: `Registro de ${type}: ${referenceId}`,
    createdAt: now(),
  };
  await storage.run(
    "INSERT INTO transactions(id,user_id,reference_id,data) VALUES (?,?,?,?)",
    tx.id,
    user.id,
    referenceId,
    JSON.stringify(tx),
  );
  return tx;
}
export async function placeBet(p: {
  userId: string;
  type: "SINGLE" | "PARLAY";
  stake: number;
  items: Array<{
    eventId: string;
    marketId: string;
    outcomeId: string;
    odds?: number;
  }>;
}): Promise<{
  success: boolean;
  bet?: Bet;
  error?: string;
}> {
  try {
    return await atomic(async () => {
      money(p.stake);
      const u = await getUserById(p.userId);
      if (!u || u.balance < p.stake) throw new Error("Saldo insuficiente");
      if (
        !Array.isArray(p.items) ||
        p.items.length < 1 ||
        p.items.length > 20 ||
        new Set(p.items.map((i) => i.eventId)).size !== p.items.length
      )
        throw new Error("Seleccione entre 1 y 20 eventos diferentes");
      const betId = id();
      let odds = 1;
      const items: BetItem[] = await Promise.all(
        p.items.map(async (i) => {
          const e = await getEventById(i.eventId);
          if (
            !e ||
            !["PRE_MATCH", "LIVE"].includes(e.status) ||
            (e.status === "PRE_MATCH" && Date.parse(e.startTime) <= Date.now())
          )
            throw new Error("Evento no disponible");
          const m = e.markets.find((x) => x.id === i.marketId);
          const o = m?.outcomes.find((x) => x.id === i.outcomeId);
          if (!m || m.status !== "ACTIVE" || !o || o.status !== "OPEN")
            throw new Error("Mercado suspendido");
          if (!Number.isFinite(i.odds) || i.odds !== o.odds)
            throw new Error("La cuota cambió; actualice y confirme nuevamente");
          odds *= o.odds;
          return {
            id: id(),
            betId,
            eventId: e.id,
            eventName: `${e.homeTeam} vs ${e.awayTeam}`,
            marketId: m.id,
            marketName: m.name,
            outcomeId: o.id,
            outcomeName: o.name,
            odds: o.odds,
            status: "PENDING",
          };
        }),
      );
      if (!Number.isFinite(odds) || p.stake * odds > 1000000)
        throw new Error("El retorno supera el límite de 1000000 USD");
      const bet: Bet = {
        id: betId,
        userId: u.id,
        userName: u.name,
        type: items.length > 1 ? "PARLAY" : "SINGLE",
        stake: p.stake,
        totalOdds: round(odds),
        potentialPayout: round(p.stake * odds),
        status: "PENDING",
        createdAt: now(),
        items,
      };
      await storage.run(
        "INSERT INTO bets(id,user_id,data) VALUES (?,?,?)",
        bet.id,
        u.id,
        JSON.stringify(bet),
      );
      for (const i of items)
        await storage.run(
          "INSERT INTO bet_items(id,bet_id,event_id,outcome_id) VALUES (?,?,?,?)",
          i.id,
          bet.id,
          i.eventId,
          i.outcomeId,
        );
      await ledger(u, -p.stake, "BET_PLACED", bet.id, "Saldo");
      await addNotification({
        userId: u.id,
        title: "Apuesta registrada",
        message: `Boleto ${bet.id}, importe ${p.stake} USD`,
        type: "info",
      });
      return { success: true, bet };
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo registrar la apuesta",
    };
  }
}
export async function getAllBets(): Promise<Bet[]> {
  return await all<Bet>("SELECT data FROM bets ORDER BY rowid DESC");
}
export async function getUserBets(
  userId: string,
  status?: string,
): Promise<Bet[]> {
  return (await getAllBets()).filter(
    (b) =>
      b.userId === userId &&
      (!status || status === "ALL" || b.status === status),
  );
}
export async function settleEvent(eventId: string, winners: string[]) {
  return await atomic(async () => {
    const e = await getEventById(eventId);
    if (!e) throw new Error("Evento no encontrado");
    if (e.status === "FINISHED")
      return { settledBetsCount: 0, totalPaidOut: 0 };
    if (e.status === "CANCELLED") throw new Error("Evento cancelado");
    if (
      !Array.isArray(winners) ||
      winners.length !== e.markets.length ||
      new Set(winners).size !== winners.length ||
      e.markets.some(
        (m) => m.outcomes.filter((o) => winners.includes(o.id)).length !== 1,
      )
    )
      throw new Error(
        "Seleccione exactamente un resultado ganador por mercado",
      );
    e.status = "FINISHED";
    for (const m of e.markets) {
      m.status = "CLOSED";
      for (const o of m.outcomes) {
        o.status = "SETTLED";
        o.isWinner = winners.includes(o.id);
      }
    }
    await saveEvent(e);
    let settledBetsCount = 0,
      totalPaidOut = 0;
    for (const b of (await getAllBets()).filter(
      (b) =>
        b.status === "PENDING" && b.items.some((i) => i.eventId === eventId),
    )) {
      for (const i of b.items.filter((i) => i.eventId === eventId))
        i.status = winners.includes(i.outcomeId) ? "WON" : "LOST";
      if (b.items.some((i) => i.status === "LOST")) b.status = "LOST";
      else if (b.items.every((i) => i.status === "WON")) b.status = "WON";
      if (b.status !== "PENDING") {
        b.settledAt = now();
        settledBetsCount++;
        if (b.status === "WON") {
          await ledger(
            (await getUserById(b.userId))!,
            b.potentialPayout,
            "BET_WON",
            b.id,
            "Liquidación",
          );
          totalPaidOut = round(totalPaidOut + b.potentialPayout);
        }
        await addNotification({
          userId: b.userId,
          title: "Resultado de apuesta",
          message: `Boleto ${b.id}: ${b.status}`,
          type: b.status === "WON" ? "success" : "info",
        });
      }
      await storage.run(
        "UPDATE bets SET data=? WHERE id=?",
        JSON.stringify(b),
        b.id,
      );
    }
    return { settledBetsCount, totalPaidOut };
  });
}
export async function cancelEvent(eventId: string) {
  return await atomic(async () => {
    const e = await getEventById(eventId);
    if (!e || e.status === "FINISHED") throw new Error("Evento no disponible");
    if (e.status === "CANCELLED") return;
    e.status = "CANCELLED";
    for (const m of e.markets) {
      m.status = "CLOSED";
      for (const o of m.outcomes) o.status = "SUSPENDED";
    }
    await saveEvent(e);
    for (const b of (await getAllBets()).filter(
      (b) =>
        b.status === "PENDING" && b.items.some((i) => i.eventId === eventId),
    )) {
      b.status = "CANCELLED";
      b.settledAt = now();
      await ledger(
        (await getUserById(b.userId))!,
        b.stake,
        "BET_REFUND",
        b.id,
        "Cancelación y devolución completa del boleto",
      );
      await storage.run(
        "UPDATE bets SET data=? WHERE id=?",
        JSON.stringify(b),
        b.id,
      );
      await addNotification({
        userId: b.userId,
        title: "Apuesta cancelada",
        message: `Boleto ${b.id}: devolución de ${b.stake} USD`,
        type: "info",
      });
    }
  });
}
export async function getUserTransactions(
  userId: string,
): Promise<Transaction[]> {
  return await all(
    "SELECT data FROM transactions WHERE user_id=? ORDER BY rowid DESC",
    userId,
  );
}
export async function getAllTransactions(): Promise<Transaction[]> {
  return await all("SELECT data FROM transactions ORDER BY rowid DESC");
}
export async function recordBalance(
  userId: string,
  amount: number,
  kind: "DEPOSIT" | "WITHDRAWAL",
  detail: string,
  reference: string,
) {
  return await atomic(async () => {
    money(amount);
    const u = await getUserById(userId);
    if (!u) throw new Error("Usuario no encontrado");
    if (
      typeof detail !== "string" ||
      !detail.trim() ||
      detail.length > 200 ||
      typeof reference !== "string" ||
      !reference.trim() ||
      reference.length > 200
    )
      throw new Error(
        "Método/cuenta y referencia de operación son obligatorios",
      );
    await storage.run(
      "INSERT INTO balance_references(reference,user_id) VALUES (?,?)",
      reference.trim(),
      userId,
    );
    const tx = await ledger(
      u,
      kind === "DEPOSIT" ? amount : -amount,
      kind,
      reference.trim(),
      detail.trim(),
    );
    await addNotification({
      userId: u.id,
      title: "Movimiento de saldo registrado",
      message: `${kind}: ${amount} USD. Referencia: ${reference}`,
      type: "info",
    });
    return { success: true, transaction: tx, newBalance: u.balance };
  });
}
export async function getNotifications(
  userId?: string,
): Promise<NotificationItem[]> {
  return userId
    ? await all(
        "SELECT data FROM notifications WHERE user_id IS NULL OR user_id=? ORDER BY rowid DESC LIMIT 50",
        userId,
      )
    : await all(
        "SELECT data FROM notifications WHERE user_id IS NULL ORDER BY rowid DESC LIMIT 50",
      );
}
export async function addNotification(
  n: Omit<NotificationItem, "id" | "timestamp" | "read">,
): Promise<NotificationItem> {
  const x = { ...n, id: id(), timestamp: now(), read: false };
  await storage.run(
    "INSERT INTO notifications(id,user_id,data) VALUES (?,?,?)",
    x.id,
    x.userId || null,
    JSON.stringify(x),
  );
  return x;
}
export async function generateReports(
  filter: ReportFilter = {},
): Promise<ReportMetrics> {
  const eventIndex = new Map((await getAllEvents()).map((e) => [e.id, e]));
  for (const date of [filter.startDate, filter.endDate])
    if (date && !Number.isFinite(Date.parse(date)))
      throw new Error("Fecha de reporte inválida");
  const accept = (x: { userId: string; createdAt: string }) =>
    (!filter.userId || x.userId === filter.userId) &&
    (!filter.startDate ||
      Date.parse(x.createdAt) >= Date.parse(filter.startDate)) &&
    (!filter.endDate || Date.parse(x.createdAt) <= Date.parse(filter.endDate));
  const bets = (await getAllBets()).filter(
    (b) =>
      accept(b) &&
      (!filter.status ||
        filter.status === "ALL" ||
        b.status === filter.status) &&
      (!filter.sport ||
        b.items.some((i) => eventIndex.get(i.eventId)?.sport === filter.sport)),
  );
  const tx = (await getAllTransactions()).filter(accept),
    sum = (xs: Bet[], key: "stake" | "potentialPayout") =>
      round(xs.reduce((a, b) => a + b[key], 0));
  const won = bets.filter((b) => b.status === "WON"),
    lost = bets.filter((b) => b.status === "LOST"),
    stake = sum(bets, "stake"),
    payout = sum(won, "potentialPayout");
  const deposits = round(
      tx.filter((t) => t.type === "DEPOSIT").reduce((s, t) => s + t.amount, 0),
    ),
    withdrawals = round(
      -tx
        .filter((t) => t.type === "WITHDRAWAL")
        .reduce((s, t) => s + t.amount, 0),
    );
  const sports = [
    ...new Set(
      bets.map((b) => eventIndex.get(b.items[0].eventId)?.sport || "General"),
    ),
  ];
  return {
    generatedAt: now(),
    generatedBy: "Sistema de reportes",
    filter,
    totalBets: bets.length,
    totalStake: stake,
    totalPayout: payout,
    grossGamingRevenue: round(sum([...won, ...lost], "stake") - payout),
    winRatePercentage:
      won.length + lost.length
        ? round((won.length / (won.length + lost.length)) * 100)
        : 0,
    pendingBetsCount: bets.filter((b) => b.status === "PENDING").length,
    wonBetsCount: won.length,
    lostBetsCount: lost.length,
    totalDeposits: deposits,
    totalWithdrawals: withdrawals,
    netCashflow: round(deposits - withdrawals),
    sportBreakdown: sports.map((s) => {
      const bs = bets.filter(
        (b) => (eventIndex.get(b.items[0].eventId)?.sport || "General") === s,
      );
      return {
        sport: s,
        betsCount: bs.length,
        totalStake: sum(bs, "stake"),
        payout: sum(
          bs.filter((b) => b.status === "WON"),
          "potentialPayout",
        ),
      };
    }),
    recentBets: bets.slice(0, 20),
    recentTransactions: tx.slice(0, 20),
  };
}
