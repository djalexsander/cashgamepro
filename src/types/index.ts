export interface Player {
  id: string;
  name: string;
  nickname: string;
  phone?: string;
  pix?: string;
  notes: string;
  tags: string[];
  totalWinnings: number;
  totalLosses: number;
  totalSessions: number;
  createdAt: string;
  updatedAt: string;
}

export type GameType = 'texas' | 'omaha' | 'omaha_hilo' | 'other';
export type SessionStatus = 'active' | 'closed';
export type PaymentMethod = 'cash' | 'pix' | 'credit' | 'debit' | 'fiado' | 'pending';
export type FinancialPaymentMethod = 'cash' | 'pix' | 'credit' | 'debit' | 'fiado';
export type PaymentStatus = 'paid' | 'pending' | 'received';
export type TransactionType = 'buyin' | 'rebuy' | 'addon' | 'withdrawal' | 'cashout';
export type FinancialTransactionType = 'buyin' | 'rebuy' | 'addon' | 'settlement' | 'fiado_payment' | 'manual_adjustment';

export interface CashSession {
  id: string;
  name: string;
  gameType: GameType;
  blinds: string;
  chipValue: number;
  rakePercent: number;
  rakeCap: number;
  dealerPercentage: number;
  notes: string;
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
  finalChips: number;
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
  notes: string;
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
