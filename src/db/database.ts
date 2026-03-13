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

// Mapping helpers: camelCase <-> snake_case
function playerToDb(p: DBPlayer, userId: string) {
  return {
    id: p.id, user_id: userId, name: p.name, nickname: p.nickname,
    phone: p.phone || null, pix: p.pix || null, notes: p.notes || null,
    tags: p.tags, total_winnings: p.totalWinnings, total_losses: p.totalLosses,
    total_sessions: p.totalSessions, created_at: p.createdAt, updated_at: p.updatedAt,
  };
}
function playerFromDb(row: any): DBPlayer {
  return {
    id: row.id, name: row.name, nickname: row.nickname || "",
    phone: row.phone || undefined, pix: row.pix || undefined, notes: row.notes || undefined,
    tags: row.tags || [], totalWinnings: Number(row.total_winnings) || 0,
    totalLosses: Number(row.total_losses) || 0, totalSessions: Number(row.total_sessions) || 0,
    createdAt: row.created_at, updatedAt: row.updated_at,
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
function sessionFromDb(row: any): DBCashSession {
  return {
    id: row.id, name: row.name, gameType: row.game_type as GameType,
    blinds: row.blinds, chipValue: Number(row.chip_value),
    notes: row.notes || undefined, dealersChoiceGames: row.dealers_choice_games || undefined,
    status: row.status as SessionStatus, startedAt: row.started_at,
    endedAt: row.ended_at || undefined, totalInvested: row.total_invested != null ? Number(row.total_invested) : undefined,
    totalReturned: row.total_returned != null ? Number(row.total_returned) : undefined,
    rakeFinal: row.rake_final != null ? Number(row.rake_final) : undefined,
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

function txToDb(tx: DBTransaction, userId: string) {
  return {
    id: tx.id, user_id: userId, session_id: tx.sessionId,
    cash_player_id: tx.cashPlayerId, type: tx.type,
    amount: tx.amount, timestamp: tx.timestamp, notes: tx.notes || null,
  };
}
function txFromDb(row: any): DBTransaction {
  return {
    id: row.id, sessionId: row.session_id, cashPlayerId: row.cash_player_id,
    type: row.type as TransactionType, amount: Number(row.amount),
    timestamp: row.timestamp, notes: row.notes || undefined,
  };
}

// Field name mapping for dynamic where/orderBy
const fieldMaps: Record<string, Record<string, string>> = {
  players: { id: "id", name: "name", nickname: "nickname", createdAt: "created_at", updatedAt: "updated_at", totalWinnings: "total_winnings", totalLosses: "total_losses", totalSessions: "total_sessions" },
  cash_sessions: { id: "id", name: "name", startedAt: "started_at", endedAt: "ended_at", status: "status", gameType: "game_type", blinds: "blinds" },
  cash_players: { id: "id", sessionId: "session_id", playerId: "player_id", isActive: "is_active", joinedAt: "joined_at" },
  transactions: { id: "id", sessionId: "session_id", cashPlayerId: "cash_player_id", type: "type", timestamp: "timestamp" },
};

type TableName = "players" | "cash_sessions" | "cash_players" | "transactions";

class SupabaseTable<T extends { id: string }> {
  constructor(
    private table: TableName,
    private fromDb: (row: any) => T,
    private toDb: (item: T, userId: string) => any,
  ) {}

  private mapField(field: string): string {
    return fieldMaps[this.table]?.[field] || field;
  }

  async toArray(): Promise<T[]> {
    const { data, error } = await supabase.from(this.table).select("*");
    if (error) throw error;
    return (data || []).map(this.fromDb);
  }

  async add(item: T): Promise<string> {
    const userId = await getUserId();
    const row = this.toDb(item, userId);
    const { error } = await supabase.from(this.table).insert(row);
    if (error) throw error;
    return item.id;
  }

  async get(id: string): Promise<T | undefined> {
    const { data, error } = await supabase.from(this.table).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? this.fromDb(data) : undefined;
  }

  async update(id: string, changes: Partial<T>): Promise<number> {
    const userId = await getUserId();
    // Convert camelCase changes to snake_case
    const dbChanges: any = {};
    for (const [key, value] of Object.entries(changes)) {
      const dbKey = this.mapField(key);
      dbChanges[dbKey] = value === undefined ? null : value;
    }
    // Also map specific known fields
    if ('totalInvested' in changes) dbChanges.total_invested = changes.totalInvested as any;
    if ('totalReturned' in changes) dbChanges.total_returned = changes.totalReturned as any;
    if ('rakeFinal' in changes) dbChanges.rake_final = changes.rakeFinal as any;
    if ('endedAt' in changes) dbChanges.ended_at = changes.endedAt as any;
    if ('currentChips' in changes) dbChanges.current_chips = changes.currentChips as any;
    if ('finalChips' in changes) dbChanges.final_chips = (changes as any).finalChips ?? null;
    if ('closedAt' in changes) dbChanges.closed_at = (changes as any).closedAt || null;
    if ('isActive' in changes) dbChanges.is_active = (changes as any).isActive;
    if ('paymentMethod' in changes) dbChanges.payment_method = (changes as any).paymentMethod;
    if ('paymentStatus' in changes) dbChanges.payment_status = (changes as any).paymentStatus;
    if ('initialBuyin' in changes) dbChanges.initial_buyin = (changes as any).initialBuyin;
    if ('totalWinnings' in changes) dbChanges.total_winnings = (changes as any).totalWinnings;
    if ('totalLosses' in changes) dbChanges.total_losses = (changes as any).totalLosses;
    if ('totalSessions' in changes) dbChanges.total_sessions = (changes as any).totalSessions;
    if ('updatedAt' in changes) dbChanges.updated_at = (changes as any).updatedAt;
    if ('gameType' in changes) dbChanges.game_type = (changes as any).gameType;
    if ('chipValue' in changes) dbChanges.chip_value = (changes as any).chipValue;
    if ('dealersChoiceGames' in changes) dbChanges.dealers_choice_games = (changes as any).dealersChoiceGames;
    if ('startedAt' in changes) dbChanges.started_at = (changes as any).startedAt;
    if ('sessionId' in changes) dbChanges.session_id = (changes as any).sessionId;
    if ('playerId' in changes) dbChanges.player_id = (changes as any).playerId;
    if ('cashPlayerId' in changes) dbChanges.cash_player_id = (changes as any).cashPlayerId;
    // Remove duplicates from mapField
    delete dbChanges.totalInvested; delete dbChanges.totalReturned; delete dbChanges.rakeFinal;
    delete dbChanges.endedAt; delete dbChanges.currentChips; delete dbChanges.finalChips;
    delete dbChanges.closedAt; delete dbChanges.isActive; delete dbChanges.paymentMethod;
    delete dbChanges.paymentStatus; delete dbChanges.initialBuyin; delete dbChanges.totalWinnings;
    delete dbChanges.totalLosses; delete dbChanges.totalSessions; delete dbChanges.updatedAt;
    delete dbChanges.gameType; delete dbChanges.chipValue; delete dbChanges.dealersChoiceGames;
    delete dbChanges.startedAt; delete dbChanges.sessionId; delete dbChanges.playerId;
    delete dbChanges.cashPlayerId;

    const { error, count } = await supabase.from(this.table).update(dbChanges).eq("id", id);
    if (error) throw error;
    return 1;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(this.table).delete().eq("id", id);
    if (error) throw error;
  }

  async clear(): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from(this.table).delete().eq("user_id", userId);
    if (error) throw error;
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase.from(this.table).delete().in("id", ids);
    if (error) throw error;
  }

  orderBy(field: string) {
    const dbField = this.mapField(field);
    const fromDb = this.fromDb;
    const table = this.table;

    const getSorted = async (ascending: boolean) => {
      const { data, error } = await supabase.from(table).select("*").order(dbField, { ascending });
      if (error) throw error;
      return (data || []).map(fromDb);
    };

    return {
      toArray: () => getSorted(true),
      reverse: () => ({
        toArray: () => getSorted(false),
      }),
    };
  }

  where(field: string) {
    const dbField = this.mapField(field);
    const fromDb = this.fromDb;
    const table = this.table;

    return {
      equals: (value: any) => ({
        toArray: async (): Promise<T[]> => {
          const { data, error } = await supabase.from(table).select("*").eq(dbField, value);
          if (error) throw error;
          return (data || []).map(fromDb);
        },
        modify: async (mutator: (item: T) => void): Promise<number> => {
          // Read matching items, apply mutator, save back
          const { data, error } = await supabase.from(table).select("*").eq(dbField, value);
          if (error) throw error;
          const items = (data || []).map(fromDb);
          let changed = 0;
          const userId = await getUserId();
          for (const item of items) {
            const original = { ...item };
            mutator(item);
            // Find what changed
            const changes: any = {};
            for (const key of Object.keys(item) as (keyof T)[]) {
              if (item[key] !== (original as any)[key]) {
                changes[key] = item[key];
              }
            }
            if (Object.keys(changes).length > 0) {
              // Use the update method's logic
              await db[tableKeyMap[table]].update(item.id, changes);
              changed++;
            }
          }
          return changed;
        },
      }),
      anyOf: (values: any[]) => ({
        toArray: async (): Promise<T[]> => {
          if (values.length === 0) return [];
          const { data, error } = await supabase.from(table).select("*").in(dbField, values);
          if (error) throw error;
          return (data || []).map(fromDb);
        },
      }),
    };
  }
}

// Map table names to db keys for modify() cross-reference
const tableKeyMap: Record<TableName, keyof typeof db> = {
  players: "players",
  cash_sessions: "cashSessions",
  cash_players: "cashPlayers",
  transactions: "transactions",
};

export const db = {
  players: new SupabaseTable<DBPlayer>("players", playerFromDb, playerToDb),
  cashSessions: new SupabaseTable<DBCashSession>("cash_sessions", sessionFromDb, sessionToDb),
  cashPlayers: new SupabaseTable<DBCashPlayer>("cash_players", cashPlayerFromDb, cashPlayerToDb),
  transactions: new SupabaseTable<DBTransaction>("transactions", txFromDb, txToDb),
};

export function generateId(): string {
  return crypto.randomUUID();
}
