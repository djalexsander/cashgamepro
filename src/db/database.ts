import { supabase } from "@/integrations/supabase/client";

// Types matching the old interface (camelCase)
export type GameType = "texas" | "omaha" | "omaha_hilo" | "5card" | "dealers_choice" | "other";
export type SessionStatus = "active" | "closed";
export type PaymentMethod = "cash" | "pix" | "pending";
export type PaymentStatus = "paid" | "pending" | "received";
export type TransactionType = "buyin" | "rebuy" | "addon" | "withdrawal" | "cashout";

export interface DBPlayer {
  id: string;
  name: string;
  nickname: string;
  phone?: string;
  pix?: string;
  notes?: string;
  tags: string[];
  totalWinnings: number;
  totalLosses: number;
  totalSessions: number;
  createdAt: string;
  updatedAt: string;
}

export interface DBCashSession {
  id: string;
  name: string;
  gameType: GameType;
  blinds: string;
  chipValue: number;
  notes?: string;
  dealersChoiceGames?: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  totalInvested?: number;
  totalReturned?: number;
  rakeFinal?: number;
}

export interface DBCashPlayer {
  id: string;
  sessionId: string;
  playerId: string;
  initialBuyin: number;
  totalInvested: number;
  currentChips: number;
  finalChips?: number;
  result?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  joinedAt: string;
  closedAt?: string;
  isActive: boolean;
}

export interface DBTransaction {
  id: string;
  sessionId: string;
  cashPlayerId: string;
  type: TransactionType;
  amount: number;
  timestamp: string;
  notes?: string;
}

// Helper: get current user id
async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Usuário não autenticado");
  return data.user.id;
}

// Use the untyped postgrest client to avoid type issues with new tables
function from(table: string) {
  return (supabase as any).from(table);
}

// Mapping helpers
function playerFromDb(row: any): DBPlayer {
  return {
    id: row.id, name: row.name, nickname: row.nickname || "",
    phone: row.phone || undefined, pix: row.pix || undefined, notes: row.notes || undefined,
    tags: row.tags || [], totalWinnings: Number(row.total_winnings) || 0,
    totalLosses: Number(row.total_losses) || 0, totalSessions: Number(row.total_sessions) || 0,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function playerToDb(p: DBPlayer, userId: string) {
  return {
    id: p.id, user_id: userId, name: p.name, nickname: p.nickname,
    phone: p.phone || null, pix: p.pix || null, notes: p.notes || null,
    tags: p.tags, total_winnings: p.totalWinnings, total_losses: p.totalLosses,
    total_sessions: p.totalSessions, created_at: p.createdAt, updated_at: p.updatedAt,
  };
}

function sessionFromDb(row: any): DBCashSession {
  return {
    id: row.id, name: row.name, gameType: row.game_type as GameType,
    blinds: row.blinds, chipValue: Number(row.chip_value),
    notes: row.notes || undefined, dealersChoiceGames: row.dealers_choice_games || undefined,
    status: row.status as SessionStatus, startedAt: row.started_at,
    endedAt: row.ended_at || undefined,
    totalInvested: row.total_invested != null ? Number(row.total_invested) : undefined,
    totalReturned: row.total_returned != null ? Number(row.total_returned) : undefined,
    rakeFinal: row.rake_final != null ? Number(row.rake_final) : undefined,
  };
}
function sessionToDb(s: DBCashSession, userId: string) {
  return {
    id: s.id, user_id: userId, name: s.name, game_type: s.gameType,
    blinds: s.blinds, chip_value: s.chipValue, notes: s.notes || null,
    dealers_choice_games: s.dealersChoiceGames || null, status: s.status,
    started_at: s.startedAt, ended_at: s.endedAt || null,
    total_invested: s.totalInvested ?? null, total_returned: s.totalReturned ?? null,
    rake_final: s.rakeFinal ?? null,
  };
}

function cashPlayerFromDb(row: any): DBCashPlayer {
  return {
    id: row.id, sessionId: row.session_id, playerId: row.player_id,
    initialBuyin: Number(row.initial_buyin), totalInvested: Number(row.total_invested),
    currentChips: Number(row.current_chips),
    finalChips: row.final_chips != null ? Number(row.final_chips) : undefined,
    result: row.result != null ? Number(row.result) : undefined,
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    joinedAt: row.joined_at, closedAt: row.closed_at || undefined,
    isActive: row.is_active,
  };
}
function cashPlayerToDb(cp: DBCashPlayer, userId: string) {
  return {
    id: cp.id, user_id: userId, session_id: cp.sessionId, player_id: cp.playerId,
    initial_buyin: cp.initialBuyin, total_invested: cp.totalInvested,
    current_chips: cp.currentChips, final_chips: cp.finalChips ?? null,
    result: cp.result ?? null, payment_method: cp.paymentMethod,
    payment_status: cp.paymentStatus, joined_at: cp.joinedAt,
    closed_at: cp.closedAt || null, is_active: cp.isActive,
  };
}

function txFromDb(row: any): DBTransaction {
  return {
    id: row.id, sessionId: row.session_id, cashPlayerId: row.cash_player_id,
    type: row.type as TransactionType, amount: Number(row.amount),
    timestamp: row.timestamp, notes: row.notes || undefined,
  };
}
function txToDb(tx: DBTransaction, userId: string) {
  return {
    id: tx.id, user_id: userId, session_id: tx.sessionId,
    cash_player_id: tx.cashPlayerId, type: tx.type,
    amount: tx.amount, timestamp: tx.timestamp, notes: tx.notes || null,
  };
}

// camelCase to snake_case field mapping
const camelToSnake: Record<string, string> = {
  totalInvested: "total_invested", totalReturned: "total_returned", rakeFinal: "rake_final",
  endedAt: "ended_at", currentChips: "current_chips", finalChips: "final_chips",
  closedAt: "closed_at", isActive: "is_active", paymentMethod: "payment_method",
  paymentStatus: "payment_status", initialBuyin: "initial_buyin", totalWinnings: "total_winnings",
  totalLosses: "total_losses", totalSessions: "total_sessions", updatedAt: "updated_at",
  gameType: "game_type", chipValue: "chip_value", dealersChoiceGames: "dealers_choice_games",
  startedAt: "started_at", sessionId: "session_id", playerId: "player_id",
  cashPlayerId: "cash_player_id", createdAt: "created_at",
  id: "id", name: "name", nickname: "nickname", phone: "phone", pix: "pix",
  notes: "notes", tags: "tags", blinds: "blinds", status: "status", type: "type",
  amount: "amount", timestamp: "timestamp", result: "result",
};

function mapChangesToSnake(changes: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(changes)) {
    const snakeKey = camelToSnake[key] || key;
    result[snakeKey] = value === undefined ? null : value;
  }
  return result;
}

class SupabaseTable<T extends { id: string }> {
  constructor(
    private table: string,
    private fromDbFn: (row: any) => T,
    private toDbFn: (item: T, userId: string) => any,
  ) {}

  async toArray(): Promise<T[]> {
    const { data, error } = await from(this.table).select("*");
    if (error) throw error;
    return (data || []).map(this.fromDbFn);
  }

  async add(item: T): Promise<string> {
    const userId = await getUserId();
    const row = this.toDbFn(item, userId);
    const { error } = await from(this.table).insert(row);
    if (error) throw error;
    return item.id;
  }

  async get(id: string): Promise<T | undefined> {
    const { data, error } = await from(this.table).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? this.fromDbFn(data) : undefined;
  }

  async update(id: string, changes: Partial<T>): Promise<number> {
    const dbChanges = mapChangesToSnake(changes as Record<string, any>);
    const { error } = await from(this.table).update(dbChanges).eq("id", id);
    if (error) throw error;
    return 1;
  }

  async delete(id: string): Promise<void> {
    const { error } = await from(this.table).delete().eq("id", id);
    if (error) throw error;
  }

  async clear(): Promise<void> {
    const userId = await getUserId();
    const { error } = await from(this.table).delete().eq("user_id", userId);
    if (error) throw error;
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await from(this.table).delete().in("id", ids);
    if (error) throw error;
  }

  orderBy(field: string) {
    const dbField = camelToSnake[field] || field;
    const fromDbFn = this.fromDbFn;
    const tableName = this.table;

    const getSorted = async (ascending: boolean) => {
      const { data, error } = await from(tableName).select("*").order(dbField, { ascending });
      if (error) throw error;
      return (data || []).map(fromDbFn);
    };

    return {
      toArray: () => getSorted(true),
      reverse: () => ({
        toArray: () => getSorted(false),
      }),
    };
  }

  where(field: string) {
    const dbField = camelToSnake[field] || field;
    const fromDbFn = this.fromDbFn;
    const tableName = this.table;
    const self = this;

    return {
      equals: (value: any) => ({
        toArray: async (): Promise<T[]> => {
          const { data, error } = await from(tableName).select("*").eq(dbField, value);
          if (error) throw error;
          return (data || []).map(fromDbFn);
        },
        modify: async (mutator: (item: T) => void): Promise<number> => {
          const { data, error } = await from(tableName).select("*").eq(dbField, value);
          if (error) throw error;
          const items = (data || []).map(fromDbFn);
          let changed = 0;
          for (const item of items) {
            const original = JSON.parse(JSON.stringify(item));
            mutator(item);
            const changes: Record<string, any> = {};
            for (const key of Object.keys(item) as (keyof T)[]) {
              if (JSON.stringify(item[key]) !== JSON.stringify(original[key])) {
                changes[key as string] = item[key];
              }
            }
            if (Object.keys(changes).length > 0) {
              await self.update(item.id, changes as Partial<T>);
              changed++;
            }
          }
          return changed;
        },
      }),
      anyOf: (values: any[]) => ({
        toArray: async (): Promise<T[]> => {
          if (values.length === 0) return [];
          const { data, error } = await from(tableName).select("*").in(dbField, values);
          if (error) throw error;
          return (data || []).map(fromDbFn);
        },
      }),
    };
  }
}

export const db = {
  players: new SupabaseTable<DBPlayer>("players", playerFromDb, playerToDb),
  cashSessions: new SupabaseTable<DBCashSession>("cash_sessions", sessionFromDb, sessionToDb),
  cashPlayers: new SupabaseTable<DBCashPlayer>("cash_players", cashPlayerFromDb, cashPlayerToDb),
  transactions: new SupabaseTable<DBTransaction>("transactions", txFromDb, txToDb),
};

export function generateId(): string {
  return crypto.randomUUID();
}
