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
    if (!raw) return JSON.parse(JSON.stringify(emptyDB));
    const parsed = JSON.parse(raw);
    return {
      players: Array.isArray(parsed.players) ? parsed.players : [],
      cashSessions: Array.isArray(parsed.cashSessions) ? parsed.cashSessions : [],
      cashPlayers: Array.isArray(parsed.cashPlayers) ? parsed.cashPlayers : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch (e) {
    console.error("Erro ao ler banco de dados:", e);
    return JSON.parse(JSON.stringify(emptyDB));
  }
};

const writeDB = (data: DBSchema) => {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
    // Verify write
    const verify = localStorage.getItem(STORAGE_KEY);
    if (!verify) {
      console.error("Falha ao persistir dados no localStorage");
    }
  } catch (e) {
    console.error("Erro ao salvar banco de dados:", e);
    throw e;
  }
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

  async toArray(): Promise<T[]> {
    return this.read();
  }

  async add(item: T): Promise<string> {
    const data = this.read();
    data.push(item);
    this.save(data);
    console.log(`[DB] add to ${this.name}:`, item.id);
    return item.id;
  }

  async get(id: string): Promise<T | undefined> {
    return this.read().find((item) => item.id === id);
  }

  async update(id: string, changes: Partial<T>): Promise<number> {
    const data = this.read();
    const index = data.findIndex((item) => item.id === id);
    if (index === -1) {
      console.warn(`[DB] update: item ${id} not found in ${this.name}`);
      return 0;
    }
    data[index] = { ...data[index], ...changes };
    this.save(data);
    console.log(`[DB] updated ${this.name}:`, id, Object.keys(changes));
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
