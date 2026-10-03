/**
 * Sistema de Apuestas a Eventos Deportivos en Línea
 * Autor: Milton H Flores Chino
 * Definiciones de Tipos de Datos y Entidades Relacionales
 */

export type UserRole = "admin" | "bettor";

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export type SportType =
  | "Fútbol"
  | "Baloncesto"
  | "Tenis"
  | "eSports"
  | "Béisbol";
export type EventStatus = "PRE_MATCH" | "LIVE" | "FINISHED" | "CANCELLED";

export interface Outcome {
  id: string;
  marketId: string;
  name: string; // ej: "Real Madrid", "Empate", "Manchester City", "Más de 2.5", "Menos de 2.5"
  odds: number; // Decimal: ej 1.85
  previousOdds?: number;
  trend?: "up" | "down" | "same";
  isWinner?: boolean | null;
  status: "OPEN" | "SUSPENDED" | "SETTLED";
}

export interface Market {
  id: string;
  eventId: string;
  name: string; // ej: "Ganador del Partido (1X2)", "Total de Goles (Over/Under 2.5)", "Ambos Equipos Anotan"
  type: "1X2" | "TOTALS" | "BTTS" | "HANDICAP" | "MONEYLINE" | "SCORE";
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  outcomes: Outcome[];
}

export interface SportEvent {
  id: string;
  sport: SportType;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: EventStatus;
  startTime: string;
  minute: string; // ej: "45'", "82'", "Q3 08:20", "Set 2"
  stadium?: string;
  markets: Market[];
  isFeatured?: boolean;
}

export type BetType = "SINGLE" | "PARLAY";
export type BetStatus = "PENDING" | "WON" | "LOST" | "CANCELLED";

export interface BetItem {
  id: string;
  betId: string;
  eventId: string;
  eventName: string;
  marketId: string;
  marketName: string;
  outcomeId: string;
  outcomeName: string;
  odds: number;
  status: "PENDING" | "WON" | "LOST";
}

export interface Bet {
  id: string;
  userId: string;
  userName: string;
  type: BetType;
  stake: number;
  totalOdds: number;
  potentialPayout: number;
  status: BetStatus;
  createdAt: string;
  settledAt?: string | null;
  items: BetItem[];
}

export type TransactionType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "BET_PLACED"
  | "BET_WON"
  | "BET_REFUND";
export type TransactionStatus = "COMPLETED" | "PENDING" | "REJECTED";

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string;
  paymentMethod: string;
  status: TransactionStatus;
  description: string;
  createdAt: string;
}

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  userId?: string;
  sport?: string;
  status?: string;
}

export interface ReportMetrics {
  generatedAt: string;
  generatedBy: string;
  filter: ReportFilter;
  totalBets: number;
  totalStake: number;
  totalPayout: number;
  grossGamingRevenue: number; // House margin (TotalStake - TotalPayout)
  winRatePercentage: number;
  pendingBetsCount: number;
  wonBetsCount: number;
  lostBetsCount: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netCashflow: number;
  sportBreakdown: {
    sport: string;
    betsCount: number;
    totalStake: number;
    payout: number;
  }[];
  recentBets: Bet[];
  recentTransactions: Transaction[];
}

export interface NotificationItem {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "odds_change";
  timestamp: string;
  read: boolean;
}
