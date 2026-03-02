type CollectionName = "players" | "cashSessions" | "cashPlayers" | "transactions";

const STORAGE_KEY = "PokerCashManagerDB";

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

export type GameType = "texas" | "omaha" | "omaha_hilo" | "5card" | "dealers_choice" | "other";
export type SessionStatus = "active" | "closed";
export type PaymentMethod = "cash" | "pix" | "pending";
export type PaymentStatus = "paid" | "pending" | "received";
export type TransactionType = "buyin" | "rebuy" | "addon" | "withdrawal" | "cashout";

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

interface DBSchema {
  players: DBPlayer[];
  cashSessions: DBCashSession[];
  cashPlayers: DBCashPlayer[];
  transactions: DBTransaction[];
}

const emptyDB: DBSchema = {
  players: [],
  cashSessions: [],
  cashPlayers: [],
  transactions: [],
};

const readDB = (): DBSchema => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDB;
    return { ...emptyDB, ...JSON.parse(raw) } as DBSchema;
  } catch {
    return emptyDB;
  }
};

const writeDB = (db: DBSchema) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

class LocalTable<T extends { id: string }> {
  constructor(private name: CollectionName) {}

  private read(): T[] {
    const db = readDB();
    return [...(db[this.name] as unknown as T[])];
  }

  private save(data: T[]) {
    const db = readDB();
    (db[this.name] as unknown as T[]) = data;
    writeDB(db);
  }

  async add(item: T): Promise<string> {
    const data = this.read();
    data.push(item);
    this.save(data);
    return item.id;
  }

  async get(id: string): Promise<T | undefined> {
    return this.read().find((item) => item.id === id);
  }

  async update(id: string, changes: Partial<T>): Promise<number> {
    const data = this.read();
    const index = data.findIndex((item) => item.id === id);
    if (index === -1) return 0;
    data[index] = { ...data[index], ...changes };
    this.save(data);
    return 1;
  }

  async delete(id: string): Promise<void> {
    const data = this.read().filter((item) => item.id !== id);
    this.save(data);
  }

  orderBy<K extends keyof T>(field: K) {
    const getSorted = async () => {
      const data = this.read();
      return data.sort((a, b) => String(a[field] ?? "").localeCompare(String(b[field] ?? "")));
    };

    return {
      toArray: async (): Promise<T[]> => getSorted(),
      reverse: () => ({
        toArray: async (): Promise<T[]> => (await getSorted()).reverse(),
      }),
    };
  }

  where<K extends keyof T>(field: K) {
    const filterBy = (matcher: (value: T[K]) => boolean) => {
      const matched = async () => this.read().filter((item) => matcher(item[field]));

      return {
        toArray: async (): Promise<T[]> => matched(),
        modify: async (mutator: (item: T) => void): Promise<number> => {
          const data = this.read();
          let changed = 0;
          for (const item of data) {
            if (matcher(item[field])) {
              mutator(item);
              changed += 1;
            }
          }
          if (changed > 0) this.save(data);
          return changed;
        },
      };
    };

    return {
      equals: (value: T[K]) => filterBy((v) => v === value),
      anyOf: (values: T[K][]) => filterBy((v) => values.includes(v)),
    };
  }
}

export const db = {
  players: new LocalTable<DBPlayer>("players"),
  cashSessions: new LocalTable<DBCashSession>("cashSessions"),
  cashPlayers: new LocalTable<DBCashPlayer>("cashPlayers"),
  transactions: new LocalTable<DBTransaction>("transactions"),
};

export function generateId(): string {
  return crypto.randomUUID();
}
