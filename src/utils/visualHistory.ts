const HIDDEN_SESSION_IDS_KEY = "cashgamepro:hidden-session-ids";
const HIDDEN_RECENT_TX_IDS_KEY = "cashgamepro:hidden-recent-transaction-ids";

const readIds = (key: string) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]") as string[]);
  } catch {
    return new Set<string>();
  }
};

const writeIds = (key: string, ids: Set<string>) => {
  localStorage.setItem(key, JSON.stringify([...ids]));
};

export const getHiddenSessionIds = () => readIds(HIDDEN_SESSION_IDS_KEY);
export const getHiddenRecentTransactionIds = () => readIds(HIDDEN_RECENT_TX_IDS_KEY);

export const hideSessionIds = (ids: string[]) => {
  const hidden = getHiddenSessionIds();
  ids.forEach(id => hidden.add(id));
  writeIds(HIDDEN_SESSION_IDS_KEY, hidden);
};

export const hideRecentTransactionIds = (ids: string[]) => {
  const hidden = getHiddenRecentTransactionIds();
  ids.forEach(id => hidden.add(id));
  writeIds(HIDDEN_RECENT_TX_IDS_KEY, hidden);
};
