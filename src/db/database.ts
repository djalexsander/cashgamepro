import { supabase } from "@/integrations/supabase/client";

// Types matching the old interface (camelCase)
export type GameType = "texas" | "omaha" | "omaha_hilo" | "5card" | "dealers_choice" | "other";
export type SessionStatus = "active" | "closed";
export type PaymentMethod = "cash" | "pix" | "credit" | "debit" | "fiado" | "pending";
export type FinancialPaymentMethod = "cash" | "pix" | "credit" | "debit" | "fiado";
export type ReceivablePaymentMethod = Exclude<FinancialPaymentMethod, "fiado">;
export type PaymentStatus = "paid" | "pending" | "received";
export type TransactionType = "buyin" | "rebuy" | "addon" | "withdrawal" | "cashout";
export type FinancialTransactionType = "buyin" | "rebuy" | "addon" | "settlement" | "fiado_payment" | "manual_adjustment";
export type ReceivableStatus = "open" | "paid";
export type ExpenseCategory = "dealer" | "food" | "drinks" | "staff" | "cleaning" | "rent" | "other";

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
  dealerPercentage: number;
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

export interface DBFinancialTransaction {
  id: string;
  sessionId: string;
  playerId?: string;
  receivableId?: string;
  amount: number;
  paymentMethod: FinancialPaymentMethod;
  type: FinancialTransactionType;
  notes?: string;
  occurredAt: string;
  createdAt?: string;
}

export interface DBReceivable {
  id: string;
  sessionId: string;
  playerId: string;
  sourceTransactionId?: string;
  originalAmount: number;
  paidAmount: number;
  status: ReceivableStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBSessionExpense {
  id: string;
  sessionId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  occurredAt: string;
  createdAt?: string;
}

export interface SessionFinanceSummary {
  receivedTotal: number;
  cash: number;
  pix: number;
  credit: number;
  debit: number;
  fiado: number;
  totalReceivable: number;
  expenses: number;
  rakeGross: number;
  dealerPercentage: number;
  dealerPayment: number;
  houseRakeNet: number;
  netResult: number;
  fiadoReceived: number;
}

export interface PlayerFiadoBalance {
  sessionId: string;
  playerId: string;
  totalFiado: number;
  totalCashout: number;
  paidAmount: number;
  debtAmount: number;
  openDebt: number;
  creditAmount: number;
  cycles: PlayerFiadoCycle[];
}

export interface PlayerFiadoCycle {
  id: string;
  sessionId: string;
  playerId: string;
  index: number;
  startedAt: string;
  endedAt?: string;
  totalInvested: number;
  totalFiado: number;
  totalCashout: number;
  result: number;
  debtAmount: number;
  creditAmount: number;
  transactions: DBTransaction[];
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
    dealerPercentage: row.dealer_percentage != null ? Number(row.dealer_percentage) : 0,
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
    dealer_percentage: s.dealerPercentage ?? 0,
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

function financialTxFromDb(row: any): DBFinancialTransaction {
  return {
    id: row.id, sessionId: row.session_id, playerId: row.player_id || undefined,
    receivableId: row.receivable_id || undefined, amount: Number(row.amount),
    paymentMethod: row.payment_method as FinancialPaymentMethod,
    type: row.type as FinancialTransactionType, notes: row.notes || undefined,
    occurredAt: row.occurred_at, createdAt: row.created_at || undefined,
  };
}
function financialTxToDb(tx: DBFinancialTransaction, userId: string) {
  return {
    id: tx.id, user_id: userId, session_id: tx.sessionId, player_id: tx.playerId || null,
    receivable_id: tx.receivableId || null, amount: tx.amount, payment_method: tx.paymentMethod,
    type: tx.type, notes: tx.notes || null, occurred_at: tx.occurredAt, created_at: tx.createdAt || new Date().toISOString(),
  };
}

function receivableFromDb(row: any): DBReceivable {
  return {
    id: row.id, sessionId: row.session_id, playerId: row.player_id,
    sourceTransactionId: row.source_transaction_id || undefined,
    originalAmount: Number(row.original_amount), paidAmount: Number(row.paid_amount),
    status: row.status as ReceivableStatus, notes: row.notes || undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function receivableToDb(item: DBReceivable, userId: string) {
  return {
    id: item.id, user_id: userId, session_id: item.sessionId, player_id: item.playerId,
    source_transaction_id: item.sourceTransactionId || null, original_amount: item.originalAmount,
    paid_amount: item.paidAmount, status: item.status, notes: item.notes || null,
    created_at: item.createdAt, updated_at: item.updatedAt,
  };
}

function expenseFromDb(row: any): DBSessionExpense {
  return {
    id: row.id, sessionId: row.session_id, category: row.category as ExpenseCategory,
    description: row.description || "", amount: Number(row.amount),
    occurredAt: row.occurred_at, createdAt: row.created_at || undefined,
  };
}
function expenseToDb(item: DBSessionExpense, userId: string) {
  return {
    id: item.id, user_id: userId, session_id: item.sessionId, category: item.category,
    description: item.description, amount: item.amount, occurred_at: item.occurredAt,
    created_at: item.createdAt || new Date().toISOString(),
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
  receivableId: "receivable_id",
  occurredAt: "occurred_at", sourceTransactionId: "source_transaction_id",
  originalAmount: "original_amount", paidAmount: "paid_amount",
  dealerPercentage: "dealer_percentage",
  id: "id", name: "name", nickname: "nickname", phone: "phone", pix: "pix",
  notes: "notes", tags: "tags", blinds: "blinds", status: "status", type: "type",
  amount: "amount", timestamp: "timestamp", result: "result", category: "category",
  description: "description",
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
  financialTransactions: new SupabaseTable<DBFinancialTransaction>("financial_transactions", financialTxFromDb, financialTxToDb),
  receivables: new SupabaseTable<DBReceivable>("receivables", receivableFromDb, receivableToDb),
  sessionExpenses: new SupabaseTable<DBSessionExpense>("session_expenses", expenseFromDb, expenseToDb),
};

export function generateId(): string {
  return crypto.randomUUID();
}

export function isReceivablePaymentMethod(method: PaymentMethod): method is ReceivablePaymentMethod {
  return method === "cash" || method === "pix" || method === "credit" || method === "debit";
}

export async function recordFinancialEntry(input: {
  sessionId: string;
  playerId?: string;
  amount: number;
  paymentMethod: FinancialPaymentMethod;
  type: FinancialTransactionType;
  notes?: string;
  occurredAt?: string;
}): Promise<DBFinancialTransaction> {
  const now = input.occurredAt || new Date().toISOString();
  const tx: DBFinancialTransaction = {
    id: generateId(),
    sessionId: input.sessionId,
    playerId: input.playerId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    type: input.type,
    notes: input.notes,
    occurredAt: now,
  };
  await db.financialTransactions.add(tx);

  if (input.paymentMethod === "fiado" && input.playerId) {
    const receivable: DBReceivable = {
      id: generateId(),
      sessionId: input.sessionId,
      playerId: input.playerId,
      sourceTransactionId: tx.id,
      originalAmount: input.amount,
      paidAmount: 0,
      status: "open",
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
    await db.receivables.add(receivable);
    await db.financialTransactions.update(tx.id, { receivableId: receivable.id });
    await reconcilePlayerFiadoBalance(input.sessionId, input.playerId);
    return { ...tx, receivableId: receivable.id };
  }

  return tx;
}

function findMatchingFinancialTx(
  tx: DBTransaction,
  financialTransactions: DBFinancialTransaction[],
): DBFinancialTransaction | undefined {
  if (tx.type === "cashout" || tx.type === "withdrawal") return undefined;
  return financialTransactions.find(item =>
    item.type === tx.type &&
    item.amount === tx.amount &&
    Math.abs(new Date(item.occurredAt).getTime() - new Date(tx.timestamp).getTime()) < 2000
  );
}

export function buildPlayerFiadoCycles(input: {
  sessionId: string;
  playerId: string;
  transactions: DBTransaction[];
  financialTransactions: DBFinancialTransaction[];
}): PlayerFiadoCycle[] {
  const cycles: PlayerFiadoCycle[] = [];
  let current: PlayerFiadoCycle | null = null;

  const startCycle = (startedAt: string) => {
    current = {
      id: `${input.playerId}:${cycles.length + 1}`,
      sessionId: input.sessionId,
      playerId: input.playerId,
      index: cycles.length + 1,
      startedAt,
      totalInvested: 0,
      totalFiado: 0,
      totalCashout: 0,
      result: 0,
      debtAmount: 0,
      creditAmount: 0,
      transactions: [],
    };
  };

  const finishCycle = (endedAt?: string) => {
    if (!current) return;
    current.endedAt = endedAt;
    current.result = current.totalCashout - current.totalInvested;
    current.debtAmount = Math.max(current.totalFiado - current.totalCashout, 0);
    current.creditAmount = current.totalFiado > 0 ? Math.max(current.totalCashout - current.totalFiado, 0) : 0;
    cycles.push(current);
    current = null;
  };

  for (const tx of input.transactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())) {
    if (!current) startCycle(tx.timestamp);
    current!.transactions.push(tx);

    if (tx.type === "buyin" || tx.type === "rebuy" || tx.type === "addon") {
      current!.totalInvested += tx.amount;
      const financialTx = findMatchingFinancialTx(tx, input.financialTransactions);
      if (financialTx?.paymentMethod === "fiado") current!.totalFiado += tx.amount;
    }

    if (tx.type === "cashout") {
      current!.totalCashout += tx.amount;
      finishCycle(tx.timestamp);
    }
  }

  finishCycle();
  return cycles.filter(cycle => cycle.totalInvested > 0 || cycle.totalFiado > 0 || cycle.totalCashout > 0);
}

export async function calculatePlayerFiadoBalance(sessionId: string, playerId: string): Promise<PlayerFiadoBalance> {
  const [financialTransactions, cashPlayers, transactions, receivables] = await Promise.all([
    db.financialTransactions.where("sessionId").equals(sessionId).toArray(),
    db.cashPlayers.where("sessionId").equals(sessionId).toArray(),
    db.transactions.where("sessionId").equals(sessionId).toArray(),
    db.receivables.where("sessionId").equals(sessionId).toArray(),
  ]);

  const playerCashPlayerIds = new Set(
    cashPlayers
      .filter(cp => cp.playerId === playerId)
      .map(cp => cp.id),
  );
  const playerTransactions = transactions.filter(tx => playerCashPlayerIds.has(tx.cashPlayerId));
  const playerFinancialTransactions = financialTransactions.filter(tx => tx.playerId === playerId);
  const cycles = buildPlayerFiadoCycles({
    sessionId,
    playerId,
    transactions: playerTransactions,
    financialTransactions: playerFinancialTransactions,
  });
  const totalFiado = cycles.reduce((sum, cycle) => sum + cycle.totalFiado, 0);
  const totalCashout = cycles.reduce((sum, cycle) => sum + cycle.totalCashout, 0);
  const playerReceivables = receivables.filter(item => item.playerId === playerId);
  const debtAmount = cycles.reduce((sum, cycle) => sum + cycle.debtAmount, 0);
  const creditAmount = cycles.reduce((sum, cycle) => sum + cycle.creditAmount, 0);
  const paidAmount = Math.min(
    debtAmount,
    playerReceivables.reduce((sum, item) => sum + item.paidAmount, 0),
  );

  return {
    sessionId,
    playerId,
    totalFiado,
    totalCashout,
    paidAmount,
    debtAmount,
    openDebt: Math.max(debtAmount - paidAmount, 0),
    creditAmount,
    cycles,
  };
}

export async function calculateSessionFiadoBalances(sessionId: string): Promise<PlayerFiadoBalance[]> {
  const [financialTransactions, cashPlayers] = await Promise.all([
    db.financialTransactions.where("sessionId").equals(sessionId).toArray(),
    db.cashPlayers.where("sessionId").equals(sessionId).toArray(),
  ]);
  const playerIds = new Set<string>();

  financialTransactions
    .filter(tx => tx.paymentMethod === "fiado" && tx.playerId)
    .forEach(tx => playerIds.add(tx.playerId!));
  cashPlayers.forEach(cp => playerIds.add(cp.playerId));

  const balances = await Promise.all([...playerIds].map(playerId => calculatePlayerFiadoBalance(sessionId, playerId)));
  return balances.filter(balance => balance.totalFiado > 0);
}

export async function reconcilePlayerFiadoBalance(sessionId: string, playerId: string): Promise<PlayerFiadoBalance> {
  const now = new Date().toISOString();
  const balance = await calculatePlayerFiadoBalance(sessionId, playerId);
  const sessionReceivables = await db.receivables.where("sessionId").equals(sessionId).toArray();
  const playerReceivables = sessionReceivables
    .filter(item => item.playerId === playerId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const primary = playerReceivables[0];
  const clampedPaid = Math.min(balance.debtAmount, playerReceivables.reduce((sum, item) => sum + item.paidAmount, 0));

  if (!primary && balance.debtAmount > 0) {
    await db.receivables.add({
      id: generateId(),
      sessionId,
      playerId,
      originalAmount: balance.debtAmount,
      paidAmount: 0,
      status: "open",
      notes: "Saldo fiado liquido",
      createdAt: now,
      updatedAt: now,
    });
    return { ...balance, paidAmount: 0, openDebt: balance.debtAmount };
  }

  if (primary) {
    await db.receivables.update(primary.id, {
      originalAmount: balance.debtAmount,
      paidAmount: clampedPaid,
      status: clampedPaid >= balance.debtAmount ? "paid" : "open",
      notes: "Saldo fiado liquido",
      updatedAt: now,
    });
  }

  for (const item of playerReceivables.slice(1)) {
    await db.receivables.update(item.id, {
      originalAmount: 0,
      paidAmount: 0,
      status: "paid",
      updatedAt: now,
    });
  }

  return {
    ...balance,
    paidAmount: clampedPaid,
    openDebt: Math.max(balance.debtAmount - clampedPaid, 0),
  };
}

export async function reconcileSessionFiadoBalances(sessionId: string): Promise<PlayerFiadoBalance[]> {
  const [financialTransactions, cashPlayers] = await Promise.all([
    db.financialTransactions.where("sessionId").equals(sessionId).toArray(),
    db.cashPlayers.where("sessionId").equals(sessionId).toArray(),
  ]);
  const playerIds = new Set<string>();

  financialTransactions
    .filter(tx => tx.paymentMethod === "fiado" && tx.playerId)
    .forEach(tx => playerIds.add(tx.playerId!));
  cashPlayers.forEach(cp => playerIds.add(cp.playerId));

  return Promise.all([...playerIds].map(playerId => reconcilePlayerFiadoBalance(sessionId, playerId)));
}

export async function payReceivable(input: {
  receivable: DBReceivable;
  amount: number;
  paymentMethod: ReceivablePaymentMethod;
  notes?: string;
  occurredAt?: string;
}): Promise<void> {
  const now = input.occurredAt || new Date().toISOString();
  const nextPaid = Math.min(input.receivable.originalAmount, input.receivable.paidAmount + input.amount);
  const status: ReceivableStatus = nextPaid >= input.receivable.originalAmount ? "paid" : "open";

  await db.receivables.update(input.receivable.id, {
    paidAmount: nextPaid,
    status,
    updatedAt: now,
  });

  await db.financialTransactions.add({
    id: generateId(),
    sessionId: input.receivable.sessionId,
    playerId: input.receivable.playerId,
    receivableId: input.receivable.id,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    type: "fiado_payment",
    notes: input.notes,
    occurredAt: now,
  });
}

export async function getSessionFinanceSummary(session: DBCashSession): Promise<SessionFinanceSummary> {
  const [financialTransactions, expenses, fiadoBalances] = await Promise.all([
    db.financialTransactions.where("sessionId").equals(session.id).toArray(),
    db.sessionExpenses.where("sessionId").equals(session.id).toArray(),
    calculateSessionFiadoBalances(session.id),
  ]);

  const byMethod = (method: FinancialPaymentMethod) =>
    financialTransactions
      .filter(tx => tx.paymentMethod === method && tx.type !== "fiado_payment")
      .reduce((sum, tx) => sum + tx.amount, 0);
  const fiadoReceived = financialTransactions
    .filter(tx => tx.type === "fiado_payment")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const cashPayments = financialTransactions
    .filter(tx => tx.paymentMethod === "cash")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const pixPayments = financialTransactions
    .filter(tx => tx.paymentMethod === "pix")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const creditPayments = financialTransactions
    .filter(tx => tx.paymentMethod === "credit")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const debitPayments = financialTransactions
    .filter(tx => tx.paymentMethod === "debit")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalReceivable = fiadoBalances.reduce((sum, item) => sum + item.openDebt, 0);
  const expensesTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const rakeGross = Number(session.rakeFinal ?? 0);
  const dealerPercentage = Number(session.dealerPercentage ?? 0);
  const dealerPayment = rakeGross * dealerPercentage / 100;
  const houseRakeNet = rakeGross - dealerPayment;

  return {
    receivedTotal: cashPayments + pixPayments + creditPayments + debitPayments,
    cash: cashPayments,
    pix: pixPayments,
    credit: creditPayments,
    debit: debitPayments,
    fiado: totalReceivable,
    totalReceivable,
    expenses: expensesTotal,
    rakeGross,
    dealerPercentage,
    dealerPayment,
    houseRakeNet,
    netResult: houseRakeNet - expensesTotal,
    fiadoReceived,
  };
}

export async function deleteSessionFinancialData(sessionId: string): Promise<void> {
  const [financialTransactions, receivables, expenses] = await Promise.all([
    db.financialTransactions.where("sessionId").equals(sessionId).toArray(),
    db.receivables.where("sessionId").equals(sessionId).toArray(),
    db.sessionExpenses.where("sessionId").equals(sessionId).toArray(),
  ]);
  await db.financialTransactions.bulkDelete(financialTransactions.map(item => item.id));
  await db.receivables.bulkDelete(receivables.map(item => item.id));
  await db.sessionExpenses.bulkDelete(expenses.map(item => item.id));
}
