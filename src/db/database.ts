import Dexie, { type EntityTable } from 'dexie';

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

export type GameType = 'texas' | 'omaha' | 'omaha_hilo' | '5card' | 'dealers_choice' | 'other';
export type SessionStatus = 'active' | 'closed';
export type PaymentMethod = 'cash' | 'pix' | 'pending';
export type PaymentStatus = 'paid' | 'pending' | 'received';
export type TransactionType = 'buyin' | 'rebuy' | 'addon' | 'withdrawal' | 'cashout';

export interface DBCashSession {
  id: string;
  name: string;
  gameType: GameType;
  blinds: string;
  chipValue: number;
  rakePercent: number;
  rakeCap: number;
  notes?: string;
  dealersChoiceGames?: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
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
  rake: number;
  timestamp: string;
  notes?: string;
}

class PokerDatabase extends Dexie {
  players!: EntityTable<DBPlayer, 'id'>;
  cashSessions!: EntityTable<DBCashSession, 'id'>;
  cashPlayers!: EntityTable<DBCashPlayer, 'id'>;
  transactions!: EntityTable<DBTransaction, 'id'>;

  constructor() {
    super('PokerCashManager');
    this.version(1).stores({
      players: 'id, name, nickname, createdAt',
      cashSessions: 'id, status, startedAt',
      cashPlayers: 'id, sessionId, playerId, isActive',
      transactions: 'id, sessionId, cashPlayerId, type, timestamp',
    });
  }
}

export const db = new PokerDatabase();

export function generateId(): string {
  return crypto.randomUUID();
}
