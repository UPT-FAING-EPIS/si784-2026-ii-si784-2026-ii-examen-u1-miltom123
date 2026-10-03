"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Trophy,
  Wallet,
  Radio,
  ShieldCheck,
  LogOut,
  Bell,
  Search,
  Trash2,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import type {
  User,
  SportEvent,
  Market,
  Outcome,
  Bet,
  Transaction,
  NotificationItem,
  ReportMetrics,
} from "@/lib/types";

async function api(path: string, method = "GET", payload?: unknown) {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || !result.success)
    throw new Error(result.message || "No se pudo completar la operación");
  return result;
}
const currency = (value: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "USD" }).format(
    value,
  );
const date = (value: string) => new Date(value).toLocaleString("es-PE");
const states: Record<string, string> = {
  PRE_MATCH: "Pre-partido",
  LIVE: "En vivo",
  FINISHED: "Finalizado",
  CANCELLED: "Cancelado",
  PENDING: "Pendiente",
  WON: "Ganada",
  LOST: "Perdida",
};
type Selection = {
  eventId: string;
  marketId: string;
  outcomeId: string;
  odds: number;
  label: string;
};
type DraftMarket = {
  name: string;
  type: Market["type"];
  outcomes: { name: string; odds: string }[];
};
const blankMarket = (): DraftMarket => ({
  name: "",
  type: "MONEYLINE",
  outcomes: [
    { name: "", odds: "" },
    { name: "", odds: "" },
  ],
});

export default function SportsBettingApp() {
  const [user, setUser] = useState<User | null>(null),
    [events, setEvents] = useState<SportEvent[]>([]),
    [bets, setBets] = useState<Bet[]>([]),
    [transactions, setTransactions] = useState<Transaction[]>([]),
    [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [view, setView] = useState("events"),
    [query, setQuery] = useState(""),
    [sport, setSport] = useState("Todos"),
    [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
      null,
    );
  const [register, setRegister] = useState(false),
    [slip, setSlip] = useState<Selection[]>([]),
    [stake, setStake] = useState("");
  const [adminUsers, setAdminUsers] = useState<User[]>([]),
    [report, setReport] = useState<ReportMetrics | null>(null),
    [markets, setMarkets] = useState<DraftMarket[]>([blankMarket()]);
  const [winners, setWinners] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    const data = await api("events");
    setEvents(data.data);
  }, []);
  const refreshAccount = useCallback(async (id: string) => {
    const [b, w, n, me] = await Promise.all([
      api(`bets/${id}`),
      api(`balance/${id}`),
      api("notifications"),
      api("auth/me"),
    ]);
    setBets(b.data);
    setTransactions(w.transactions);
    setNotifications(n.data);
    setUser(me.user);
  }, []);
  const refreshAdmin = useCallback(async () => {
    const [users, metrics] = await Promise.all([
      api("admin/users"),
      api("reports"),
    ]);
    setAdminUsers(users.data);
    setReport(metrics.data);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
      api("events"),
      fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([e, me]) => {
        if (!active) return;
        setEvents(e.data);
        if (me.success) {
          setUser(me.user);
          refreshAccount(me.user.id).catch((e) =>
            setNotice({ text: e.message, error: true }),
          );
        }
      })
      .catch((e) => setNotice({ text: e.message, error: true }))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshAccount]);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      setConnected(false);
      return;
    }
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const update = () => {
      refresh().catch((error) =>
        setNotice({ text: error.message, error: true }),
      );
      if (user?.id)
        refreshAccount(user.id).catch(() => {
          setUser(null);
          setView("auth");
        });
    };
    const channel = client
      .channel("betsport-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "betsport_updates" },
        update,
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    const recovery = setInterval(update, 15000);
    return () => {
      clearInterval(recovery);
      void client.removeChannel(channel);
    };
  }, [user?.id, refresh, refreshAccount]);
  useEffect(() => {
    if (view === "admin" && user?.role !== "admin") setView("account");
  }, [view, user?.role]);
  useEffect(() => {
    if (view === "admin" && user?.role === "admin")
      refreshAdmin().catch((e) => setNotice({ text: e.message, error: true }));
  }, [view, user?.role, refreshAdmin]);
  useEffect(() => {
    setSlip((prev) =>
      prev
        .filter((s) => {
          const e = events.find((e) => e.id === s.eventId);
          return e && ["PRE_MATCH", "LIVE"].includes(e.status);
        })
        .map((s) => {
          const o = events
            .find((e) => e.id === s.eventId)
            ?.markets.find((m) => m.id === s.marketId)
            ?.outcomes.find((o) => o.id === s.outcomeId);
          return { ...s, odds: o?.odds ?? s.odds };
        }),
    );
  }, [events]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setNotice({
        text: e instanceof Error ? e.message : "Error de conexión",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  function success(text: string) {
    setNotice({ text, error: false });
  }
  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (sport === "Todos" || e.sport === sport) &&
          (status === "ALL" || e.status === status) &&
          `${e.homeTeam} ${e.awayTeam} ${e.league}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [events, sport, status, query],
  );
  const odds = slip.reduce((value, s) => value * s.odds, 1);
  function choose(e: SportEvent, m: Market, o: Outcome) {
    setSlip((prev) =>
      prev.some((s) => s.outcomeId === o.id)
        ? prev.filter((s) => s.outcomeId !== o.id)
        : [
            ...prev.filter((s) => s.eventId !== e.id),
            {
              eventId: e.id,
              marketId: m.id,
              outcomeId: o.id,
              odds: o.odds,
              label: `${e.homeTeam} vs ${e.awayTeam} · ${m.name} · ${o.name}`,
            },
          ],
    );
  }
  const auth = async (form: HTMLFormElement) => {
    const f = new FormData(form);
    const data = await api(
      `auth/${register ? "register" : "login"}`,
      "POST",
      Object.fromEntries(f),
    );
    setUser(data.user);
    await refreshAccount(data.user.id);
    setView("events");
    success(register ? "Cuenta creada con saldo cero." : "Sesión iniciada.");
  };
  const submitBet = () =>
    run(async () => {
      if (!user) {
        setView("auth");
        throw new Error("Inicia sesión para apostar");
      }
      await api("bets", "POST", {
        stake: Number(stake),
        items: slip,
        type: slip.length > 1 ? "PARLAY" : "SINGLE",
      });
      setSlip([]);
      setStake("");
      await refreshAccount(user.id);
      success("Apuesta registrada.");
    });
  function patchMarket(index: number, value: Partial<DraftMarket>) {
    setMarkets((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...value } : m)),
    );
  }

  return (
    <div className="application">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => setView("events")}
        >
          <span className="brand-icon">
            <Trophy size={23} />
          </span>
          <span>
            BetSport<span className="brand-pro">PRO</span>
            <small>EVENTOS DEPORTIVOS</small>
          </span>
        </button>
        <nav aria-label="Navegación principal">
          <button
            type="button"
            className={view === "events" ? "nav-active" : ""}
            onClick={() => setView("events")}
          >
            Eventos
          </button>
          {user && (
            <>
              <button
                type="button"
                className={view === "account" ? "nav-active" : ""}
                onClick={() => {
                  setView("account");
                  void run(() => refreshAccount(user.id));
                }}
              >
                Mi cuenta
              </button>
              <button
                type="button"
                className={view === "notifications" ? "nav-active" : ""}
                onClick={() => setView("notifications")}
              >
                <Bell size={16} /> Avisos{" "}
                {notifications.length > 0 && (
                  <span className="count">{notifications.length}</span>
                )}
              </button>
            </>
          )}
          {user?.role === "admin" && (
            <button
              type="button"
              className={view === "admin" ? "nav-active" : ""}
              onClick={() => setView("admin")}
            >
              <ShieldCheck size={16} /> Administrar
            </button>
          )}
        </nav>
        <div className="session">
          {user ? (
            <>
              <span className="balance">
                <Wallet size={16} />
                {currency(user.balance)}
              </span>
              <button
                type="button"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                onClick={() =>
                  run(async () => {
                    await api("auth/logout", "POST", {});
                    setUser(null);
                    setBets([]);
                    setTransactions([]);
                    setNotifications([]);
                    setAdminUsers([]);
                    setReport(null);
                    setSlip([]);
                    setView("events");
                    success("Sesión cerrada.");
                  })
                }
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={() => setView("auth")}
            >
              Iniciar sesión
            </button>
          )}
        </div>
      </header>
      <main>
        {notice && (
          <div
            className={`notice ${notice.error ? "error" : ""}`}
            role="status"
          >
            {notice.text}
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setNotice(null)}
            >
              ×
            </button>
          </div>
        )}
        {view === "events" && (
          <>
            <section className="hero">
              <div>
                <div className="eyebrow">TU PLATAFORMA DEPORTIVA</div>
                <h1>
                  Cada evento.
                  <br />
                  <span>En un solo lugar.</span>
                </h1>
                <p>
                  Explora los mercados, elige tus cuotas y consulta cada
                  movimiento de tu cuenta.
                </p>
              </div>
              <div className="hero-summary">
                <span className="live-status">
                  <Radio size={16} />{" "}
                  {connected ? "Conectado en tiempo real" : "Reconectando…"}
                </span>
                <div className="summary-numbers">
                  <div>
                    <strong>
                      {events.filter((e) => e.status === "LIVE").length}
                    </strong>
                    <span>En vivo</span>
                  </div>
                  <div>
                    <strong>
                      {events.filter((e) => e.status === "PRE_MATCH").length}
                    </strong>
                    <span>Próximos</span>
                  </div>
                  <div>
                    <strong>{events.length}</strong>
                    <span>Eventos</span>
                  </div>
                </div>
              </div>
            </section>
            <div className="catalog-layout">
              <section>
                <div className="section-title">
                  <h2>Catálogo de eventos</h2>
                  <span className="muted">{filtered.length} disponibles</span>
                </div>
                <div className="filters">
                  <label className="search">
                    <Search size={18} />
                    <input
                      aria-label="Buscar eventos"
                      placeholder="Equipo, competidor o liga"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filtrar deporte"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                  >
                    {[
                      "Todos",
                      "Fútbol",
                      "Baloncesto",
                      "Tenis",
                      "Béisbol",
                      "eSports",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar estado"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="ALL">Todos los estados</option>
                    {["LIVE", "PRE_MATCH", "FINISHED", "CANCELLED"].map((s) => (
                      <option key={s} value={s}>
                        {states[s]}
                      </option>
                    ))}
                  </select>
                </div>
                {loading ? (
                  <div className="empty">Cargando eventos…</div>
                ) : filtered.length === 0 ? (
                  <div className="empty">
                    <Trophy size={38} />
                    <h3>
                      {events.length
                        ? "Sin coincidencias"
                        : "Todavía no hay eventos"}
                    </h3>
                    <p>
                      {events.length
                        ? "Prueba otro filtro de búsqueda."
                        : "Los eventos que registres desde administración aparecerán aquí."}
                    </p>
                    {!user && (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => {
                          setRegister(true);
                          setView("auth");
                        }}
                      >
                        Crear mi cuenta
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="event-list">
                    {filtered.map((e) => (
                      <article className="event-card" key={e.id}>
                        <div className="event-meta">
                          <span>
                            {e.sport} · {e.league}
                          </span>
                          <span
                            className={`badge ${e.status === "LIVE" ? "live" : ""}`}
                          >
                            {states[e.status]}
                          </span>
                        </div>
                        <div className="match">
                          <div>
                            <h3>
                              {e.homeTeam} <span>vs</span> {e.awayTeam}
                            </h3>
                            <small>
                              {date(e.startTime)}
                              {e.stadium ? ` · ${e.stadium}` : ""}
                            </small>
                          </div>
                          <div className="score">
                            {e.homeScore}
                            <span>:</span>
                            {e.awayScore}
                            <small>{e.minute}</small>
                          </div>
                        </div>
                        {e.markets.map((m) => (
                          <div className="market" key={m.id}>
                            <h4>{m.name}</h4>
                            <div className="outcomes">
                              {m.outcomes.map((o) => (
                                <button
                                  type="button"
                                  key={o.id}
                                  disabled={
                                    busy ||
                                    !["LIVE", "PRE_MATCH"].includes(e.status) ||
                                    m.status !== "ACTIVE" ||
                                    o.status !== "OPEN" ||
                                    (e.status === "PRE_MATCH" &&
                                      Date.parse(e.startTime) <= Date.now())
                                  }
                                  className={`odd ${slip.some((s) => s.outcomeId === o.id) ? "selected" : ""}`}
                                  onClick={() => choose(e, m, o)}
                                >
                                  <span>{o.name}</span>
                                  <strong>
                                    {o.odds.toFixed(2)}
                                    {o.trend === "up"
                                      ? " ↑"
                                      : o.trend === "down"
                                        ? " ↓"
                                        : ""}
                                  </strong>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <aside className="slip">
                <div className="section-title">
                  <h2>Boleto de apuesta</h2>
                  <span className="count">{slip.length}</span>
                </div>
                {slip.length === 0 ? (
                  <div className="slip-empty">
                    <Plus size={28} />
                    <p>Selecciona una cuota para comenzar.</p>
                  </div>
                ) : (
                  <>
                    <div className="slip-items">
                      {slip.map((s) => (
                        <div key={s.outcomeId}>
                          <span>
                            {s.label}
                            <strong>Cuota {s.odds.toFixed(2)}</strong>
                          </span>
                          <button
                            type="button"
                            aria-label="Quitar selección"
                            onClick={() =>
                              setSlip((prev) =>
                                prev.filter((i) => i.outcomeId !== s.outcomeId),
                              )
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="muted">
                      {slip.length > 1 ? "Apuesta combinada" : "Apuesta simple"}{" "}
                      · Cuota {odds.toFixed(2)}
                    </p>
                    <label>
                      Importe (USD)
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        step="0.01"
                        value={stake}
                        onChange={(e) => setStake(e.target.value)}
                      />
                    </label>
                    <div className="return">
                      <span>Retorno potencial</span>
                      <strong>{currency(Number(stake) * odds)}</strong>
                    </div>
                    <button
                      type="button"
                      className="primary full"
                      disabled={
                        busy ||
                        !Number.isFinite(Number(stake)) ||
                        Number(stake) < 1
                      }
                      onClick={submitBet}
                    >
                      {busy ? "Procesando…" : "Registrar apuesta"}
                    </button>
                    <small className="muted">
                      Las cuotas vigentes se validan al confirmar.
                    </small>
                  </>
                )}
              </aside>
            </div>
          </>
        )}
        {view === "auth" && (
          <section className="auth-card panel">
            <div className="eyebrow">BIENVENIDO A BETSPORT</div>
            <h1>{register ? "Crea tu cuenta" : "Inicia sesión"}</h1>
            <p className="muted">
              Las cuentas empiezan con saldo cero. La primera cuenta registrada
              administra este proyecto.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => auth(e.currentTarget));
              }}
            >
              {register && (
                <label>
                  Nombre completo
                  <input
                    name="name"
                    required
                    minLength={3}
                    maxLength={120}
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={150}
                  autoComplete="email"
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  required
                  minLength={register ? 10 : 1}
                  maxLength={72}
                  autoComplete={register ? "new-password" : "current-password"}
                />
              </label>
              {register && (
                <small className="muted">Usa al menos 10 caracteres.</small>
              )}
              <button type="submit" className="primary full" disabled={busy}>
                {busy ? "Procesando…" : register ? "Crear cuenta" : "Ingresar"}
              </button>
            </form>
            <button
              type="button"
              className="text-button"
              onClick={() => setRegister(!register)}
            >
              {register ? "Ya tengo una cuenta" : "Crear una cuenta nueva"}
            </button>
          </section>
        )}
        {view === "account" && user && (
          <>
            <div className="page-heading">
              <div className="eyebrow">MI CUENTA</div>
              <h1>{user.name}</h1>
              <p className="muted">
                {user.email} ·{" "}
                {user.role === "admin" ? "Administrador" : "Apostador"}
              </p>
            </div>
            <div className="stats">
              <div className="panel">
                <span>Saldo disponible</span>
                <strong>{currency(user.balance)}</strong>
              </div>
              <div className="panel">
                <span>Apuestas pendientes</span>
                <strong>
                  {bets.filter((b) => b.status === "PENDING").length}
                </strong>
              </div>
              <div className="panel">
                <span>Apuestas ganadas</span>
                <strong>{bets.filter((b) => b.status === "WON").length}</strong>
              </div>
              <div className="panel">
                <span>Premios registrados</span>
                <strong>
                  {currency(
                    bets
                      .filter((b) => b.status === "WON")
                      .reduce((s, b) => s + b.potentialPayout, 0),
                  )}
                </strong>
              </div>
            </div>
            <p className="project-note">
              Los movimientos de este proyecto se registran con los importes y
              referencias que ingreses. No ejecutan cobros ni transferencias
              bancarias.
            </p>
            <div className="two-columns">
              {(["deposit", "withdraw"] as const).map((kind) => (
                <section className="panel" key={kind}>
                  <h2>
                    {kind === "deposit" ? (
                      <ArrowDownLeft size={20} />
                    ) : (
                      <ArrowUpRight size={20} />
                    )}{" "}
                    {kind === "deposit"
                      ? "Registrar depósito"
                      : "Registrar retiro"}
                  </h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const f = new FormData(form);
                      void run(async () => {
                        await api(`balance/${kind}`, "POST", {
                          amount: Number(f.get("amount")),
                          reference: f.get("reference"),
                          ...(kind === "deposit"
                            ? { paymentMethod: f.get("detail") }
                            : { destinationAccount: f.get("detail") }),
                        });
                        form.reset();
                        await refreshAccount(user.id);
                        success("Movimiento registrado.");
                      });
                    }}
                  >
                    <label>
                      Importe (USD)
                      <input
                        type="number"
                        name="amount"
                        min="1"
                        max="10000"
                        step="0.01"
                        required
                      />
                    </label>
                    <label>
                      {kind === "deposit"
                        ? "Método de depósito"
                        : "Cuenta de destino"}
                      <input name="detail" required maxLength={200} />
                    </label>
                    <label>
                      Referencia única de operación
                      <input name="reference" required maxLength={200} />
                    </label>
                    <button type="submit" className="primary" disabled={busy}>
                      Registrar {kind === "deposit" ? "depósito" : "retiro"}
                    </button>
                  </form>
                </section>
              ))}
            </div>
            <section className="panel">
              <h2>Historial de apuestas</h2>
              {bets.length === 0 ? (
                <p className="muted">Aún no has registrado apuestas.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha / boleto</th>
                        <th>Selecciones</th>
                        <th>Importe</th>
                        <th>Cuota</th>
                        <th>Retorno potencial</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bets.map((b) => (
                        <tr key={b.id}>
                          <td>
                            {date(b.createdAt)}
                            <small>{b.id}</small>
                          </td>
                          <td>
                            {b.items.map((i) => (
                              <small key={i.id}>
                                {i.eventName} · {i.marketName} · {i.outcomeName}{" "}
                                ({i.odds})
                              </small>
                            ))}
                          </td>
                          <td>{currency(b.stake)}</td>
                          <td>{b.totalOdds}</td>
                          <td>{currency(b.potentialPayout)}</td>
                          <td>
                            <span className="badge">{states[b.status]}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="panel">
              <h2>Movimientos de saldo</h2>
              {transactions.length === 0 ? (
                <p className="muted">No hay movimientos registrados.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Movimiento / referencia</th>
                        <th>Importe</th>
                        <th>Saldo posterior</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id}>
                          <td>{date(t.createdAt)}</td>
                          <td>
                            {t.type}
                            <small>
                              {t.paymentMethod} · {t.referenceId}
                            </small>
                          </td>
                          <td>{currency(t.amount)}</td>
                          <td>{currency(t.balanceAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
        {view === "notifications" && user && (
          <section className="panel">
            <h1>Notificaciones</h1>
            {notifications.length === 0 ? (
              <p className="muted">No hay avisos todavía.</p>
            ) : (
              notifications.map((n) => (
                <article className="notification" key={n.id}>
                  <Bell size={18} />
                  <div>
                    <h3>{n.title}</h3>
                    <p>{n.message}</p>
                    <small className="muted">{date(n.timestamp)}</small>
                  </div>
                </article>
              ))
            )}
          </section>
        )}
        {view === "admin" && user?.role === "admin" && (
          <>
            <div className="page-heading">
              <div className="eyebrow">ADMINISTRACIÓN</div>
              <h1>Control de la plataforma</h1>
              <p className="muted">
                Registra eventos, actualiza cuotas y consulta los resultados.
              </p>
            </div>
            <div className="stats">
              <div className="panel">
                <span>Usuarios</span>
                <strong>{adminUsers.length}</strong>
              </div>
              <div className="panel">
                <span>Eventos</span>
                <strong>{events.length}</strong>
              </div>
              <div className="panel">
                <span>Importe apostado</span>
                <strong>{currency(report?.totalStake || 0)}</strong>
              </div>
              <div className="panel">
                <span>Premios liquidados</span>
                <strong>{currency(report?.totalPayout || 0)}</strong>
              </div>
            </div>
            <section className="panel">
              <h2>Crear evento deportivo</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  void run(async () => {
                    await api("admin/events", "POST", {
                      ...Object.fromEntries(f),
                      startTime: new Date(
                        String(f.get("startTime")),
                      ).toISOString(),
                      markets: markets.map((m) => ({
                        ...m,
                        outcomes: m.outcomes.map((o) => ({
                          ...o,
                          odds: Number(o.odds),
                        })),
                      })),
                    });
                    form.reset();
                    setMarkets([blankMarket()]);
                    await refresh();
                    await refreshAdmin();
                    success("Evento creado.");
                  });
                }}
              >
                <div className="form-grid">
                  <label>
                    Deporte
                    <select name="sport">
                      {[
                        "Fútbol",
                        "Baloncesto",
                        "Tenis",
                        "Béisbol",
                        "eSports",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Liga / torneo
                    <input name="league" required maxLength={150} />
                  </label>
                  <label>
                    Local / competidor 1
                    <input name="homeTeam" required maxLength={150} />
                  </label>
                  <label>
                    Visitante / competidor 2
                    <input name="awayTeam" required maxLength={150} />
                  </label>
                  <label>
                    Fecha y hora local
                    <input type="datetime-local" name="startTime" required />
                  </label>
                  <label>
                    Estado
                    <select name="status">
                      <option value="PRE_MATCH">Pre-partido</option>
                      <option value="LIVE">En vivo</option>
                    </select>
                  </label>
                  <label>
                    Estadio / sede
                    <input name="stadium" maxLength={150} />
                  </label>
                </div>
                <h3>Mercados y cuotas</h3>
                {markets.map((m, mi) => (
                  <fieldset key={mi}>
                    <legend>Mercado {mi + 1}</legend>
                    <div className="form-grid">
                      <label>
                        Nombre del mercado
                        <input
                          value={m.name}
                          required
                          maxLength={150}
                          onChange={(e) =>
                            patchMarket(mi, { name: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Tipo
                        <select
                          value={m.type}
                          onChange={(e) =>
                            patchMarket(mi, {
                              type: e.target.value as Market["type"],
                            })
                          }
                        >
                          {[
                            "MONEYLINE",
                            "1X2",
                            "TOTALS",
                            "BTTS",
                            "HANDICAP",
                            "SCORE",
                          ].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {m.outcomes.map((o, oi) => (
                      <div className="outcome-form" key={oi}>
                        <label>
                          Selección {oi + 1}
                          <input
                            required
                            maxLength={150}
                            value={o.name}
                            onChange={(e) =>
                              patchMarket(mi, {
                                outcomes: m.outcomes.map((v, i) =>
                                  i === oi ? { ...v, name: e.target.value } : v,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          Cuota
                          <input
                            type="number"
                            min="1.01"
                            max="1000"
                            step="0.01"
                            required
                            value={o.odds}
                            onChange={(e) =>
                              patchMarket(mi, {
                                outcomes: m.outcomes.map((v, i) =>
                                  i === oi ? { ...v, odds: e.target.value } : v,
                                ),
                              })
                            }
                          />
                        </label>
                        {m.outcomes.length > 2 && (
                          <button
                            type="button"
                            aria-label="Eliminar selección"
                            onClick={() =>
                              patchMarket(mi, {
                                outcomes: m.outcomes.filter((_, i) => i !== oi),
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="actions">
                      <button
                        type="button"
                        disabled={m.outcomes.length >= 50}
                        onClick={() =>
                          patchMarket(mi, {
                            outcomes: [...m.outcomes, { name: "", odds: "" }],
                          })
                        }
                      >
                        Añadir selección
                      </button>
                      {markets.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setMarkets((prev) =>
                              prev.filter((_, i) => i !== mi),
                            )
                          }
                        >
                          Eliminar mercado
                        </button>
                      )}
                    </div>
                  </fieldset>
                ))}
                <div className="actions">
                  <button
                    type="button"
                    disabled={markets.length >= 20}
                    onClick={() =>
                      setMarkets((prev) => [...prev, blankMarket()])
                    }
                  >
                    Añadir mercado
                  </button>
                  <button type="submit" className="primary" disabled={busy}>
                    Crear evento
                  </button>
                </div>
              </form>
            </section>
            <section className="panel">
              <h2>Gestionar eventos y liquidar apuestas</h2>
              {events.length === 0 ? (
                <p className="muted">Crea el primer evento para comenzar.</p>
              ) : (
                events.map((e) => (
                  <article className="manage-event" key={e.id}>
                    <h3>
                      {e.homeTeam} vs {e.awayTeam}{" "}
                      <span className="badge">{states[e.status]}</span>
                    </h3>
                    {["PRE_MATCH", "LIVE"].includes(e.status) && (
                      <>
                        <form
                          className="inline-form"
                          onSubmit={(formEvent) => {
                            formEvent.preventDefault();
                            const f = new FormData(formEvent.currentTarget);
                            void run(async () => {
                              await api("admin/events", "PUT", {
                                eventId: e.id,
                                updates: {
                                  homeScore: Number(f.get("homeScore")),
                                  awayScore: Number(f.get("awayScore")),
                                  minute: f.get("minute"),
                                  status: f.get("status"),
                                },
                              });
                              await refresh();
                              success("Evento actualizado.");
                            });
                          }}
                        >
                          <label>
                            Local
                            <input
                              key={e.homeScore}
                              name="homeScore"
                              type="number"
                              min="0"
                              max="10000"
                              defaultValue={e.homeScore}
                              required
                            />
                          </label>
                          <label>
                            Visitante
                            <input
                              key={e.awayScore}
                              name="awayScore"
                              type="number"
                              min="0"
                              max="10000"
                              defaultValue={e.awayScore}
                              required
                            />
                          </label>
                          <label>
                            Tiempo / periodo
                            <input
                              key={e.minute}
                              name="minute"
                              defaultValue={e.minute}
                              maxLength={50}
                            />
                          </label>
                          <label>
                            Estado
                            <select
                              key={e.status}
                              name="status"
                              defaultValue={e.status}
                            >
                              <option value="PRE_MATCH">Pre-partido</option>
                              <option value="LIVE">En vivo</option>
                            </select>
                          </label>
                          <button type="submit" disabled={busy}>
                            Actualizar marcador
                          </button>
                        </form>
                        {e.markets.map((m) => (
                          <div key={m.id}>
                            <h4>{m.name}</h4>
                            <div className="odds-admin">
                              {m.outcomes.map((o) => (
                                <form
                                  key={o.id}
                                  onSubmit={(formEvent) => {
                                    formEvent.preventDefault();
                                    const f = new FormData(
                                      formEvent.currentTarget,
                                    );
                                    void run(async () => {
                                      // NOSONAR: nested handler keeps each odds form scoped to its outcome.
                                      await api("admin/events", "PUT", {
                                        eventId: e.id,
                                        outcomeUpdate: {
                                          outcomeId: o.id,
                                          newOdds: Number(f.get("odds")),
                                        },
                                      });
                                      await refresh();
                                      success("Cuota actualizada.");
                                    });
                                  }}
                                >
                                  <label>
                                    {o.name}
                                    <input
                                      key={o.odds}
                                      type="number"
                                      name="odds"
                                      min="1.01"
                                      max="1000"
                                      step="0.01"
                                      defaultValue={o.odds}
                                      required
                                    />
                                  </label>
                                  <button type="submit" disabled={busy}>
                                    Guardar cuota
                                  </button>
                                </form>
                              ))}
                            </div>
                            <label>
                              Resultado ganador
                              <select
                                value={winners[m.id] || ""}
                                onChange={(v) =>
                                  setWinners((prev) => ({
                                    ...prev,
                                    [m.id]: v.target.value,
                                  }))
                                }
                              >
                                <option value="">Seleccionar resultado</option>
                                {m.outcomes.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ))}
                        <div className="actions">
                          <button
                            type="button"
                            className="primary"
                            disabled={
                              busy || e.markets.some((m) => !winners[m.id])
                            }
                            onClick={() =>
                              run(async () => {
                                await api("admin/settle", "POST", {
                                  eventId: e.id,
                                  winningOutcomeIds: e.markets.map(
                                    (m) => winners[m.id],
                                  ),
                                });
                                await refresh();
                                await refreshAccount(user.id);
                                await refreshAdmin();
                                success(
                                  "Evento liquidado y apuestas resueltas.",
                                );
                              })
                            }
                          >
                            Liquidar todos los mercados
                          </button>
                          <button
                            type="button"
                            className="danger"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await api("admin/events", "DELETE", {
                                  eventId: e.id,
                                });
                                await refresh();
                                await refreshAccount(user.id);
                                await refreshAdmin();
                                success(
                                  "Evento cancelado; boletos pendientes reembolsados.",
                                );
                              })
                            }
                          >
                            Cancelar y devolver importes
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))
              )}
            </section>
            <section className="panel">
              <h2>Usuarios y roles</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Saldo</th>
                      <th>Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>{currency(u.balance)}</td>
                        <td>
                          <select
                            aria-label={`Rol de ${u.name}`}
                            value={u.role}
                            disabled={busy}
                            onChange={(e) => {
                              const role = e.target.value;
                              void run(async () => {
                                await api("admin/users", "PUT", {
                                  userId: u.id,
                                  role,
                                });
                                await refreshAccount(user.id);
                                await refreshAdmin();
                                success("Rol actualizado.");
                              });
                            }}
                          >
                            <option value="bettor">Apostador</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="panel">
              <h2>Reportes de apuestas y movimientos</h2>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(async () => {
                    const filter = Object.fromEntries(
                      [...f.entries()].filter(([, v]) => v),
                    );
                    if (filter.startDate)
                      filter.startDate = new Date(
                        String(filter.startDate) + "T00:00:00",
                      ).toISOString();
                    if (filter.endDate)
                      filter.endDate = new Date(
                        String(filter.endDate) + "T23:59:59.999",
                      ).toISOString();
                    setReport((await api("reports", "POST", filter)).data);
                    success("Reporte generado.");
                  });
                }}
              >
                <label>
                  Desde
                  <input name="startDate" type="date" />
                </label>
                <label>
                  Hasta
                  <input name="endDate" type="date" />
                </label>
                <label>
                  Usuario
                  <select name="userId">
                    <option value="">Todos</option>
                    {adminUsers.map((u) => (
                      <option value={u.id} key={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Deporte
                  <select name="sport">
                    <option value="">Todos</option>
                    {[
                      "Fútbol",
                      "Baloncesto",
                      "Tenis",
                      "Béisbol",
                      "eSports",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="primary" disabled={busy}>
                  Generar reporte
                </button>
              </form>
              {report && (
                <>
                  <div className="report-values">
                    <p>
                      Apuestas: <strong>{report.totalBets}</strong>
                    </p>
                    <p>
                      Ganadas / perdidas / pendientes:{" "}
                      <strong>
                        {report.wonBetsCount} / {report.lostBetsCount} /{" "}
                        {report.pendingBetsCount}
                      </strong>
                    </p>
                    <p>
                      Importe apostado:{" "}
                      <strong>{currency(report.totalStake)}</strong>
                    </p>
                    <p>
                      Premios: <strong>{currency(report.totalPayout)}</strong>
                    </p>
                    <p>
                      Margen de apuestas resueltas:{" "}
                      <strong>{currency(report.grossGamingRevenue)}</strong>
                    </p>
                    <p>
                      Depósitos / retiros:{" "}
                      <strong>
                        {currency(report.totalDeposits)} /{" "}
                        {currency(report.totalWithdrawals)}
                      </strong>
                    </p>
                  </div>
                  {report.sportBreakdown.map((s) => (
                    <p key={s.sport}>
                      {s.sport}: {s.betsCount} apuestas ·{" "}
                      {currency(s.totalStake)}
                    </p>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(report, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "reporte-betsport.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Descargar reporte JSON
                  </button>
                </>
              )}
            </section>
            <section className="panel">
              <h2>Publicar aviso o promoción</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  void run(async () => {
                    await api(
                      "admin/notifications",
                      "POST",
                      Object.fromEntries(f),
                    );
                    form.reset();
                    success("Aviso publicado para los usuarios.");
                  });
                }}
              >
                <label>
                  Título
                  <input name="title" maxLength={120} required />
                </label>
                <label>
                  Mensaje
                  <textarea name="message" maxLength={1000} required />
                </label>
                <button type="submit" className="primary" disabled={busy}>
                  Publicar aviso
                </button>
              </form>
            </section>
          </>
        )}
      </main>
      <footer>
        <span>
          <Trophy size={15} /> BetSport Pro · Milton H Flores Chino
        </span>
        <span>Proyecto personal · Datos registrados por sus usuarios</span>
      </footer>
    </div>
  );
}
