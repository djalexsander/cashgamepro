/**
 * Serviço centralizado para cálculos financeiros do Cash Game Pro
 * Evita duplicação de lógica e garante coerência em todas as telas
 */

// To avoid circular imports with src/db/database.ts, define minimal local
// types used by this calculator. These match the shapes required here only.
export type DBTransaction = {
  id?: string;
  sessionId?: string;
  cashPlayerId?: string;
  type: "buyin" | "rebuy" | "addon" | "withdrawal" | "cashout";
  amount: number;
  timestamp: string;
  // other fields intentionally omitted
};

export type DBFinancialTransaction = {
  id?: string;
  sessionId?: string;
  playerId?: string;
  amount: number;
  paymentMethod?: "cash" | "pix" | "credit" | "debit" | "fiado";
  type?: string;
  occurredAt: string;
};

export interface PlayerCycle {
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

export interface PlayerFinancialSummary {
  totalInvested: number;
  totalFiado: number;
  totalCashout: number;
  result: number;
  clientPays: number;
  clientReceives: number;
  cycles: PlayerCycle[];
}

/**
 * Localiza a transação financeira que corresponde a uma transação de chips
 * Usa matching por tipo, valor e timestamp (margem de 2 segundos)
 */
export function findMatchingFinancialTx(
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

/**
 * Constrói ciclos financeiros para um jogador
 * Um ciclo começa com um buy-in e termina com um cash-out
 * Agrupa rebuy, add-on e cash-out no mesmo ciclo
 *
 * Regras de cálculo:
 * - result = totalCashout - totalInvested
 * - clientPays (fiado não recebido) = max(totalFiado - totalCashout, 0)
 * - clientReceives (lucro para levar) = totalFiado > 0 ? max(totalCashout - totalFiado, 0) : 0
 */
export function buildPlayerFinancialCycles(input: {
  sessionId: string;
  playerId: string;
  transactions: DBTransaction[];
  financialTransactions: DBFinancialTransaction[];
}): PlayerCycle[] {
  const cycles: PlayerCycle[] = [];
  let current: PlayerCycle | null = null;

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
    
    // Cálculo de débito/crédito: coerência entre resultado e movimento de caixa
    if (current.totalFiado > 0) {
      // Se houve fiado, calcula o que falta pagar e o que recebe
      current.debtAmount = Math.max(current.totalFiado - current.totalCashout, 0);
      current.creditAmount = Math.max(current.totalCashout - current.totalFiado, 0);
    } else {
      // Se não houve fiado, toda operação foi em cash
      current.debtAmount = 0;
      current.creditAmount = 0;
    }
    
    cycles.push(current);
    current = null;
  };

  // Ordena transações por timestamp
  const sortedTxs = [...input.transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const tx of sortedTxs) {
    // Inicia um novo ciclo se não houver um ativo
    if (!current) startCycle(tx.timestamp);

    current!.transactions.push(tx);

    // Acumula investimentos (buy-in, rebuy). Add-on é ignorado para Cash Game.
    if (tx.type === "buyin" || tx.type === "rebuy") {
      current!.totalInvested += tx.amount;
      
      // Verifica se este investimento foi em fiado
      const financialTx = findMatchingFinancialTx(tx, input.financialTransactions);
      if (financialTx?.paymentMethod === "fiado") {
        current!.totalFiado += tx.amount;
      }
    }

    // Encerra o ciclo ao fazer cash-out
    if (tx.type === "cashout") {
      current!.totalCashout += tx.amount;
      finishCycle(tx.timestamp);
    }
  }

  // Finaliza último ciclo se estiver aberto (jogador ainda está na mesa)
  finishCycle();

  // Filtra apenas ciclos com movimentação
  return cycles.filter(
    cycle => cycle.totalInvested > 0 || cycle.totalFiado > 0 || cycle.totalCashout > 0
  );
}

/**
 * Calcula o resumo financeiro do jogador
 * Soma todos os ciclos para obter totais
 */
export function calculatePlayerFinancialSummary(
  cycles: PlayerCycle[]
): PlayerFinancialSummary {
  const summary: PlayerFinancialSummary = {
    totalInvested: 0,
    totalFiado: 0,
    totalCashout: 0,
    result: 0,
    clientPays: 0,
    clientReceives: 0,
    cycles,
  };

  for (const cycle of cycles) {
    summary.totalInvested += cycle.totalInvested;
    summary.totalFiado += cycle.totalFiado;
    summary.totalCashout += cycle.totalCashout;
    summary.result += cycle.result;
    summary.clientPays += cycle.debtAmount;
    summary.clientReceives += cycle.creditAmount;
  }

  return summary;
}

/**
 * Valida consistência entre resultado e movimentos de caixa
 * Garante que as regras sejam mantidas:
 * - Se resultado > 0: clientReceives deve ter valor, clientPays = 0
 * - Se resultado < 0: clientPays deve ter valor, clientReceives = 0
 * - Se resultado = 0: ambos devem ser 0
 */
export function validateFinancialConsistency(summary: PlayerFinancialSummary): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const epsilon = 0.01; // Margem para comparações de ponto flutuante

  // Validação 1: Resultado deve ser investido - cashout
  const expectedResult = summary.totalCashout - summary.totalInvested;
  if (Math.abs(summary.result - expectedResult) > epsilon) {
    errors.push(
      `Resultado inconsistente: esperado ${expectedResult.toFixed(2)}, obtido ${summary.result.toFixed(2)}`
    );
  }

  // Validação 2: Se resultado positivo, só pode receber (clientPays = 0)
  if (summary.result > epsilon && summary.clientPays > epsilon) {
    errors.push(
      `Resultado positivo (R$ ${summary.result.toFixed(2)}) não pode ter cliente pagando (R$ ${summary.clientPays.toFixed(2)})`
    );
  }

  // Validação 3: Se resultado negativo, só pode pagar (clientReceives = 0)
  if (summary.result < -epsilon && summary.clientReceives > epsilon) {
    errors.push(
      `Resultado negativo (R$ ${summary.result.toFixed(2)}) não pode ter cliente recebendo (R$ ${summary.clientReceives.toFixed(2)})`
    );
  }

  // Validação 4: clientPays e clientReceives não podem ser simultaneamente > 0
  if (summary.clientPays > epsilon && summary.clientReceives > epsilon) {
    errors.push(
      `Cliente não pode simultaneamente pagar (R$ ${summary.clientPays.toFixed(2)}) e receber (R$ ${summary.clientReceives.toFixed(2)})`
    );
  }

  // Validação 5: Ciclos com cash-out devem ter buy-in
  for (const cycle of summary.cycles) {
    if (cycle.totalCashout > 0 && cycle.totalInvested === 0) {
      errors.push(
        `Ciclo ${cycle.index} possui cash-out (R$ ${cycle.totalCashout.toFixed(2)}) sem buy-in - ciclo inválido`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Formata valores monetários para exibição
 */
export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

/**
 * Formata resultado com sinal (+ ou -)
 */
export function formatResult(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
