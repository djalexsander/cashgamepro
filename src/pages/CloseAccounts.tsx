import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  db,
  generateId,
  buildPlayerFiadoCycles,
  reconcilePlayerFiadoBalance,
  reconcileSessionFiadoBalances,
  type DBCashSession,
  type DBCashPlayer,
  type DBFinancialTransaction,
  type DBPlayer,
  type DBTransaction,
  type PaymentMethod,
  type PaymentStatus,
} from "@/db/database";
import { toast } from "@/hooks/use-toast";
import { printThermalReceipt } from "@/utils/thermalReceiptPrint";
import {
  DollarSign, Users, TrendingUp, TrendingDown, Lock,
  AlertTriangle, Printer, Clock, Wallet, CheckCircle2, MinusCircle,
} from "lucide-react";

type EnrichedCashPlayer = DBCashPlayer & { player?: DBPlayer; session?: DBCashSession };
type ReceiptData = {
  name: string;
  invested: number;
  finalChips: number;
  result: number;
  date: string;
  session: string;
  totalFiado: number;
  totalCashout: number;
  customerPays: number;
  customerReceives: number;
  transactions: Array<{ type: string; amount: number; paymentMethod?: string; timestamp: string }>;
  cycles: Array<{
    index: number;
    startedAt: string;
    totalInvested: number;
    totalFiado: number;
    totalCashout: number;
    result: number;
    debtAmount: number;
    creditAmount: number;
    transactions: Array<{ type: string; amount: number; paymentMethod?: string; timestamp: string }>;
  }>;
};

const CloseAccounts = () => {
  const [activeSessions, setActiveSessions] = useState<DBCashSession[]>([]);
  const [cashPlayers, setCashPlayers] = useState<EnrichedCashPlayer[]>([]);
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);
  const [financialTransactions, setFinancialTransactions] = useState<DBFinancialTransaction[]>([]);

  // Close modal
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<EnrichedCashPlayer | null>(null);
  const [finalChips, setFinalChips] = useState("");
  const [closePaymentMethod, setClosePaymentMethod] = useState<PaymentMethod>("cash");
  const [closePaymentStatus, setClosePaymentStatus] = useState<PaymentStatus>("paid");

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Receipt
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const load = useCallback(async () => {
    try {
      const allSessions = await db.cashSessions.toArray();
      const active = allSessions.filter(s => s.status === "active");
      await Promise.all(active.map(session => reconcileSessionFiadoBalances(session.id)));
      setActiveSessions(active);

      if (active.length === 0) {
        setCashPlayers([]);
        setTransactions([]);
        return;
      }

      const sessionIds = active.map(s => s.id);
      const allCPs = await db.cashPlayers.toArray();
      const sessionCPs = allCPs.filter(cp => sessionIds.includes(cp.sessionId));

      const playerIds = [...new Set(sessionCPs.map(cp => cp.playerId))];
      const allPlayers = await db.players.toArray();
      const playerMap = new Map(allPlayers.filter(p => playerIds.includes(p.id)).map(p => [p.id, p]));
      const sessionMap = new Map(active.map(s => [s.id, s]));

      const enriched: EnrichedCashPlayer[] = sessionCPs.map(cp => ({
        ...cp,
        player: playerMap.get(cp.playerId),
        session: sessionMap.get(cp.sessionId),
      }));

      // Sort: active first, then by name
      enriched.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return (a.player?.name ?? "").localeCompare(b.player?.name ?? "");
      });

      setCashPlayers(enriched);

      const allTxs = await db.transactions.toArray();
      setTransactions(allTxs.filter(t => sessionIds.includes(t.sessionId)));
      const allFinancialTxs = await db.financialTransactions.toArray();
      setFinancialTransactions(allFinancialTxs.filter(t => sessionIds.includes(t.sessionId)));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({ title: "Erro", description: "Falha ao carregar dados.", variant: "destructive" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Summary calculations
  const totalInvested = cashPlayers.reduce((sum, cp) => sum + cp.totalInvested, 0);
  const totalReturned = cashPlayers.filter(cp => !cp.isActive).reduce((sum, cp) => sum + (cp.finalChips ?? 0), 0);
  const activeCount = cashPlayers.filter(cp => cp.isActive).length;
  const rakePartial = totalInvested - totalReturned - cashPlayers.filter(cp => cp.isActive).reduce((sum, cp) => sum + cp.currentChips, 0);

  const escapeHtml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const txLabelMap: Record<string, string> = {
    buyin: "Buy-in",
    rebuy: "Rebuy",
    addon: "Add-on",
    withdrawal: "Retirada",
    cashout: "Cash-out",
  };
  const paymentLabelMap: Record<string, string> = {
    cash: "Dinheiro",
    pix: "PIX",
    credit: "Cr?dito",
    debit: "D?bito",
    fiado: "Fiado",
    pending: "Pendente",
  };

  const openCloseModal = (cp: EnrichedCashPlayer) => {
    if (!cp.isActive) {
      toast({ title: "Atenção", description: "Este jogador já foi fechado.", variant: "destructive" });
      return;
    }
    setCloseTarget(cp);
    setFinalChips("");
    setClosePaymentMethod(cp.paymentMethod);
    setClosePaymentStatus("paid");
    setCloseOpen(true);
  };

  const handlePrepareClose = () => {
    if (!finalChips || parseFloat(finalChips) < 0) {
      toast({ title: "Erro", description: "Informe as fichas finais.", variant: "destructive" });
      return;
    }
    const chips = parseFloat(finalChips);
    if (chips > 50000) {
      toast({ title: "Atenção: valor alto", description: `Fichas finais de R$ ${chips.toFixed(2)} parecem incomuns. Confirme o valor.`, variant: "destructive" });
    }
    setConfirmOpen(true);
  };

  const handleConfirmClose = async () => {
    console.log("[close-account] confirm start");
    if (!closeTarget) {
      toast({
        title: "Conta não selecionada",
        description: "Selecione um jogador antes de confirmar o fechamento.",
        variant: "destructive",
      });
      return;
    }
    const chips = parseFloat(finalChips);

    try {
      const result = chips - closeTarget.totalInvested;
      const now = new Date().toISOString();

      await db.cashPlayers.update(closeTarget.id, {
        finalChips: chips,
        result,
        isActive: false,
        closedAt: now,
        currentChips: chips,
        paymentMethod: closePaymentMethod,
        paymentStatus: closePaymentStatus,
      });
      console.log("[close-account] updated player");

      // Update player permanent stats
      if (result >= 0) {
        await db.players.where("id").equals(closeTarget.playerId).modify(p => {
          p.totalWinnings += result;
          p.totalSessions += 1;
        });
      } else {
        await db.players.where("id").equals(closeTarget.playerId).modify(p => {
          p.totalLosses += Math.abs(result);
          p.totalSessions += 1;
        });
      }

      // Record cashout transaction
      const cashoutTx: DBTransaction = {
        id: generateId(),
        sessionId: closeTarget.sessionId,
        cashPlayerId: closeTarget.id,
        type: "cashout",
        amount: chips,
        timestamp: now,
      };
      await db.transactions.add(cashoutTx);
      await reconcilePlayerFiadoBalance(closeTarget.sessionId, closeTarget.playerId);

      const receiptTransactions = [...transactions, cashoutTx]
        .filter(tx => tx.sessionId === closeTarget.sessionId)
        .filter(tx => {
          const owner = cashPlayers.find(cp => cp.id === tx.cashPlayerId);
          return owner?.playerId === closeTarget.playerId || tx.cashPlayerId === closeTarget.id;
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const paymentForTx = (tx: DBTransaction) => {
        if (tx.type === "cashout" || tx.type === "withdrawal") return undefined;
        const financialTx = financialTransactions.find(item =>
          item.sessionId === tx.sessionId &&
          item.playerId === closeTarget.playerId &&
          item.type === tx.type &&
          item.amount === tx.amount &&
          Math.abs(new Date(item.occurredAt).getTime() - new Date(tx.timestamp).getTime()) < 2000
        );
        return financialTx ? paymentLabelMap[financialTx.paymentMethod] ?? financialTx.paymentMethod : undefined;
      };
      const playerFinancialTxs = financialTransactions.filter(tx => tx.sessionId === closeTarget.sessionId && tx.playerId === closeTarget.playerId);
      const cycles = buildPlayerFiadoCycles({
        sessionId: closeTarget.sessionId,
        playerId: closeTarget.playerId,
        transactions: receiptTransactions,
        financialTransactions: playerFinancialTxs,
      });
      const totalFiado = cycles.reduce((sum, cycle) => sum + cycle.totalFiado, 0);
      const totalCashout = cycles.reduce((sum, cycle) => sum + cycle.totalCashout, 0);
      const totalInvestedReceipt = cycles.reduce((sum, cycle) => sum + cycle.totalInvested, 0);
      const totalResult = cycles.reduce((sum, cycle) => sum + cycle.result, 0);
      const customerPays = cycles.reduce((sum, cycle) => sum + cycle.debtAmount, 0);
      const customerReceives = cycles.reduce((sum, cycle) => sum + cycle.creditAmount, 0);

      toast({
        title: "Conta fechada! ",
        description: `${closeTarget.player?.name ?? "Jogador"}: R$ ${result >= 0 ? "+" : ""}${result.toFixed(2)}`,
      });

      const nextReceiptData: ReceiptData = {
        name: closeTarget.player?.name ?? "Jogador",
        invested: totalInvestedReceipt,
        finalChips: chips,
        result: totalResult,
        date: new Date().toLocaleString("pt-BR"),
        session: closeTarget.session?.name ?? "",
        totalFiado,
        totalCashout,
        customerPays,
        customerReceives,
        transactions: receiptTransactions.map(tx => ({
          type: tx.type,
          amount: tx.amount,
          paymentMethod: paymentForTx(tx),
          timestamp: tx.timestamp,
        })),
        cycles: cycles.map(cycle => ({
          index: cycle.index,
          startedAt: cycle.startedAt,
          totalInvested: cycle.totalInvested,
          totalFiado: cycle.totalFiado,
          totalCashout: cycle.totalCashout,
          result: cycle.result,
          debtAmount: cycle.debtAmount,
          creditAmount: cycle.creditAmount,
          transactions: cycle.transactions.map(tx => ({
            type: tx.type,
            amount: tx.amount,
            paymentMethod: paymentForTx(tx),
            timestamp: tx.timestamp,
          })),
        })),
      };

      setReceiptData(nextReceiptData);

      setConfirmOpen(false);
      setCloseOpen(false);
      setReceiptOpen(true);
      console.log("[close-account] summary opened");
      load();
    } catch (error) {
      console.error("[close-account] error", error);
      toast({
        title: "Falha ao fechar conta",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir o fechamento da conta.",
        variant: "destructive",
      });
    }
  };

  const buildReceiptHtml = (data: ReceiptData | null = receiptData) => {
    if (!data) return "";
    const cycleSections = data.cycles.map(cycle => {
      const txRows = cycle.transactions.map(tx => (
        `<div class="row"><span>${new Date(tx.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ${escapeHtml(txLabelMap[tx.type] ?? tx.type)}</span><strong>R$ ${tx.amount.toFixed(2)}${tx.paymentMethod ? ` - ${escapeHtml(tx.paymentMethod)}` : ""}</strong></div>`
      )).join("");
      return `<div class="sub"><b>Ciclo ${cycle.index}</b>
        <div class="row"><span>Entrada</span><strong>${new Date(cycle.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong></div>
        ${txRows}
        <div class="row"><span>Total investido</span><strong>R$ ${cycle.totalInvested.toFixed(2)}</strong></div>
        <div class="row"><span>Total fiado</span><strong>R$ ${cycle.totalFiado.toFixed(2)}</strong></div>
        <div class="row"><span>Cash-out</span><strong>R$ ${cycle.totalCashout.toFixed(2)}</strong></div>
        <div class="row"><span>Resultado</span><strong>R$ ${cycle.result >= 0 ? "+" : ""}${cycle.result.toFixed(2)}</strong></div>
        <div class="row"><span>Cliente paga</span><strong>R$ ${cycle.debtAmount.toFixed(2)}</strong></div>
        <div class="row"><span>Cliente recebe</span><strong>R$ ${cycle.creditAmount.toFixed(2)}</strong></div>
      </div>`;
    }).join("");

    return `
      <!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=80mm, initial-scale=1" /><title>Recibo</title></head><body>
        <main class="receipt">
        <h2>Cash Game Pro</h2>
        <p class="center" style="font-size:0.9em;">${escapeHtml(data.session)}</p>
        <div class="row"><span>Jogador:</span><strong>${escapeHtml(data.name)}</strong></div>
        <div class="row"><span>Investido:</span><span>R$ ${data.invested.toFixed(2)}</span></div>
        <div class="row"><span>Fichas finais:</span><span>R$ ${data.finalChips.toFixed(2)}</span></div>
        ${cycleSections}
        <div class="sub"><b>Resumo final</b>
          <div class="row"><span>Total investido</span><strong>R$ ${data.invested.toFixed(2)}</strong></div>
          <div class="row"><span>Total fiado</span><strong>R$ ${data.totalFiado.toFixed(2)}</strong></div>
          <div class="row"><span>Total cash-out</span><strong>R$ ${data.totalCashout.toFixed(2)}</strong></div>
          <div class="row"><span>Resultado final</span><strong>R$ ${data.result >= 0 ? "+" : ""}${data.result.toFixed(2)}</strong></div>
          <div class="row"><span>Cliente paga</span><strong>R$ ${data.customerPays.toFixed(2)}</strong></div>
          <div class="row"><span>Cliente recebe</span><strong>R$ ${data.customerReceives.toFixed(2)}</strong></div>
        </div>
        <div class="result ${data.result >= 0 ? "positive" : "negative"}">
          Resultado: R$ ${data.result >= 0 ? "+" : ""}${data.result.toFixed(2)}
        </div>
        <div class="row"><span>Data:</span><span>${escapeHtml(data.date)}</span></div>
        <div class="footer"><p>Cash Game Pro</p><p>Documento gerado automaticamente</p></div>
        </main>
      </body></html>
    `;
  };

  const handlePrintReceipt = async () => {
    console.log("[receipt-print] button clicked");
    console.log("[receipt-print] printSummary start");

    const html = buildReceiptHtml();
    if (!html) {
      toast({
        title: "Não há dados para imprimir.",
        description: "Feche uma conta antes de imprimir o recibo.",
        variant: "destructive",
      });
      return;
    }

    try {
      await printThermalReceipt({ html, logPrefix: "[receipt-print]" });
    } catch (error) {
      console.error("[receipt-print] error", error);
      toast({
        title: "Falha ao imprimir recibo",
        description:
          error instanceof Error
            ? error.message
            : "O Desktop/Tauri ou o navegador recusou a chamada de impressão.",
        variant: "destructive",
      });
    }
  };

  // Time played helper
  const getTimePlayed = (joinedAt: string) => {
    const mins = Math.floor((Date.now() - new Date(joinedAt).getTime()) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m.toString().padStart(2, "0")}m`;
  };

  // Player transactions for modal
  const getPlayerTxs = (cashPlayerId: string) =>
    transactions
      .filter(t => t.cashPlayerId === cashPlayerId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const closeTargetTxs = closeTarget ? getPlayerTxs(closeTarget.id) : [];
  const closeCashout = Number(finalChips) || 0;
  const closeBuyins = closeTargetTxs.filter(tx => tx.type === "buyin").reduce((sum, tx) => sum + tx.amount, 0);
  const closeRebuys = closeTargetTxs.filter(tx => tx.type === "rebuy").reduce((sum, tx) => sum + tx.amount, 0);
  const closeAddons = closeTargetTxs.filter(tx => tx.type === "addon").reduce((sum, tx) => sum + tx.amount, 0);
  const closeResult = closeTarget ? closeCashout - closeTarget.totalInvested : 0;
  const closePaymentLabel = paymentLabelMap[closePaymentMethod] ?? closePaymentMethod;

  if (activeSessions.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl text-poker-gold">Fechar contas</h2>
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma sessão ativa no momento.</p>
            <p className="text-sm text-muted-foreground mt-1">Inicie um Cash Game para utilizar esta tela.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl text-poker-gold">Fechar contas</h2>

      {/* Financial Summary Panel */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <DollarSign className="w-4 h-4 mx-auto text-secondary" />
            <p className="text-lg font-bold font-display text-secondary">R$ {totalInvested.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">Total investido</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-primary" />
            <p className="text-lg font-bold font-display">R$ {totalReturned.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">Já devolvido</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <Users className="w-4 h-4 mx-auto text-foreground" />
            <p className="text-lg font-bold font-display">{activeCount}</p>
            <p className="text-[10px] text-muted-foreground">Em aberto</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <TrendingDown className="w-4 h-4 mx-auto text-primary" />
            <p className={`text-lg font-bold font-display ${rakePartial >= 0 ? "text-primary" : "text-destructive"}`}>
              R$ {rakePartial.toFixed(0)}
            </p>
            <p className="text-[10px] text-muted-foreground">Rake parcial</p>
          </CardContent>
        </Card>
      </div>

      {/* Session labels */}
      {activeSessions.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {activeSessions.map(s => (
            <span key={s.id} className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
              {s.name} - {s.blinds}
            </span>
          ))}
        </div>
      )}

      {/* Players List */}
      <div className="space-y-2">
        {cashPlayers.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              Nenhum jogador nas sessões ativas.
            </CardContent>
          </Card>
        ) : cashPlayers.map((cp) => (
          <Card
            key={cp.id}
            className={`border-border ${cp.isActive ? "bg-card" : "bg-muted/50 opacity-70"}`}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{cp.player?.name ?? "Jogador"}</p>
                    {activeSessions.length > 1 && (
                      <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                        {cp.session?.name}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>Fichas: R$ {cp.currentChips.toFixed(2)}</span>
                    <span>Investido: R$ {cp.totalInvested.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                    <Clock className="w-3 h-3" />
                    {getTimePlayed(cp.joinedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cp.isActive ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-9 px-4 text-xs font-semibold"
                      onClick={() => openCloseModal(cp)}
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      Fechar
                    </Button>
                  ) : (
                    <div className="text-right">
                      <p className={`text-sm font-bold ${(cp.result ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                        {(cp.result ?? 0) >= 0 ? "+" : ""}R$ {(cp.result ?? 0).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3" />
                        Fechado - {cp.paymentStatus === "paid" ? "Pago" : cp.paymentStatus === "received" ? "Recebido" : "Pendente"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Close Player Modal */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-poker-gold flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Fechar conta
            </DialogTitle>
          </DialogHeader>
          {closeTarget && (
            <div className="space-y-4">
              {/* Player info */}
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jogador</span>
                  <span className="font-semibold">{closeTarget.player?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total investido</span>
                  <span className="font-bold text-secondary">R$ {closeTarget.totalInvested.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fichas atuais</span>
                  <span className="font-bold">R$ {closeTarget.currentChips.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Movimentações</span>
                  <span>{getPlayerTxs(closeTarget.id).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrada</span>
                  <span>{new Date(closeTarget.joinedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tempo jogado</span>
                  <span>{getTimePlayed(closeTarget.joinedAt)}</span>
                </div>
              </div>

              {/* Transaction history */}
              {getPlayerTxs(closeTarget.id).length > 0 && (
                <div className="bg-muted/50 rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                  <p className="text-[10px] text-muted-foreground font-semibold mb-1">Histórico</p>
                  {getPlayerTxs(closeTarget.id).map(tx => (
                    <div key={tx.id} className="flex items-center gap-2 text-xs">
                      <span className="text-[10px] text-muted-foreground w-12 shrink-0">
                        {new Date(tx.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="flex-1">
                        {tx.type === "buyin" ? "Buy-in" : tx.type === "rebuy" ? "Rebuy" : tx.type === "addon" ? "Add-on" : tx.type === "withdrawal" ? "Retirada" : "Cash-out"}
                      </span>
                      <span className="font-bold">R$ {tx.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Final chips */}
              <div className="space-y-2">
                <Label className="font-semibold">Fichas finais devolvidas (R$) *</Label>
                <Input
                  type="number"
                  value={finalChips}
                  onChange={(e) => setFinalChips(e.target.value)}
                  placeholder="0"
                  className="bg-muted border-border text-lg h-12"
                  autoFocus
                />
                {finalChips && parseFloat(finalChips) >= 0 && (
                  <div className={`text-center p-2 rounded-lg ${parseFloat(finalChips) - closeTarget.totalInvested >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                    <p className="text-xs text-muted-foreground">Resultado</p>
                    <p className="text-xl font-bold font-display">
                      R$ {(parseFloat(finalChips) - closeTarget.totalInvested) >= 0 ? "+" : ""}
                      {(parseFloat(finalChips) - closeTarget.totalInvested).toFixed(2)}
                    </p>
                    <p className="text-xs">
                      {parseFloat(finalChips) - closeTarget.totalInvested > 0 ? "Jogador ganhou" :
                       parseFloat(finalChips) - closeTarget.totalInvested < 0 ? "Jogador perdeu" : "Empate"}
                    </p>
                  </div>
                )}
              </div>

              {/* Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Pagamento</Label>
                  <Select value={closePaymentMethod} onValueChange={(v) => setClosePaymentMethod(v as PaymentMethod)}>
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={closePaymentStatus} onValueChange={(v) => setClosePaymentStatus(v as PaymentStatus)}>
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="pending">A pagar</SelectItem>
                      <SelectItem value="received">Recebido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancelar</Button>
            <Button onClick={handlePrepareClose} variant="destructive" className="gap-1">
              <Lock className="w-4 h-4" /> Fechar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-poker-gold">Confirmar fechamento</AlertDialogTitle>
            <AlertDialogDescription>
              Revise os valores antes de fechar a conta. Nada será gravado até a confirmação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {closeTarget && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Jogador</span><strong>{closeTarget.player?.name ?? "Jogador"}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Buy-ins</span><span>R$ {closeBuyins.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rebuys</span><span>R$ {closeRebuys.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Add-ons</span><span>R$ {closeAddons.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cash-out</span><strong>R$ {closeCashout.toFixed(2)}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Resultado</span><strong>R$ {closeResult >= 0 ? "+" : ""}{closeResult.toFixed(2)}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span>{closePaymentLabel}</span></div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar fechamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-poker-gold flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Recibo
            </DialogTitle>
            <DialogDescription>
              Recibo térmico 80mm da conta fechada.
            </DialogDescription>
          </DialogHeader>
          {receiptData && (
            <div className="space-y-3 text-sm">
              <div className="bg-muted rounded-lg p-4 space-y-2 font-mono">
                <p className="text-center font-bold text-base"> Cash Game Pro</p>
                <p className="text-center text-xs text-muted-foreground">{receiptData.session}</p>
                <div className="border-t border-dashed border-border my-2" />
                <div className="flex justify-between"><span>Jogador:</span><span className="font-bold">{receiptData.name}</span></div>
                <div className="flex justify-between"><span>Investido:</span><span>R$ {receiptData.invested.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Fichas finais:</span><span>R$ {receiptData.finalChips.toFixed(2)}</span></div>
                <div className="border-t border-dashed border-border my-2" />
                <div className={`text-center text-xl font-bold ${receiptData.result >= 0 ? "text-primary" : "text-destructive"}`}>
                  R$ {receiptData.result >= 0 ? "+" : ""}{receiptData.result.toFixed(2)}
                </div>
                <div className="border-t border-dashed border-border my-2" />
                <p className="text-center text-[10px] text-muted-foreground">{receiptData.date}</p>
              </div>
              <Button type="button" onClick={() => void handlePrintReceipt()} className="w-full gap-2">
                <Printer className="w-4 h-4" />
                Imprimir Recibo
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CloseAccounts;
