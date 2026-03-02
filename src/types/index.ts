export interface Player {
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

export type GameType = 'texas' | 'omaha' | 'omaha_hilo' | 'other';
export type SessionStatus = 'active' | 'closed';
export type PaymentMethod = 'cash' | 'pix' | 'pending';
export type PaymentStatus = 'paid' | 'pending' | 'received';
export type TransactionType = 'buyin' | 'rebuy' | 'addon' | 'withdrawal' | 'cashout';

export interface CashSession {
  id: string;
  name: string;
  gameType: GameType;
  blinds: string;
  chipValue: number;
  rakePercent: number;
  rakeCap: number;
  notes?: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
}

export interface CashPlayer {
  id: string;
  sessionId: string;
  playerId: string;
  player?: Player;
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

export interface Transaction {
  id: string;
  sessionId: string;
  cashPlayerId: string;
  type: TransactionType;
  amount: number;
  rake: number;
  timestamp: string;
  notes?: string;
}

export interface SessionStats {
  totalPlayers: number;
  activePlayers: number;
  totalBuyins: number;
  totalChipsOnTable: number;
  totalRake: number;
  biggestStack: number;
  totalPaid: number;
  totalPending: number;
  duration: string;
}
