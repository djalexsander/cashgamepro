import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  db,
  generateId,
  getSessionFinanceSummary,
  recordFinancialEntry,
  type DBCashSession,
  type DBCashPlayer,
  type DBPlayer,
  type DBTransaction,
  type FinancialPaymentMethod,
  type PaymentMethod,
  type SessionFinanceSummary,
} from "@/db/database";
import { toast } from "@/hooks/use-toast";
import { printThermalReceipt } from "@/utils/thermalReceiptPrint";
import PlayerModal from "@/components/PlayerModal";
import {
  ArrowLeft, Plus, Users, DollarSign, Clock, Spade,
  PlusCircle, MinusCircle, RotateCcw, Lock, UserPlus, AlertTriangle,
  ClipboardList, LogIn, LogOut, ArrowUpCircle, ArrowDownCircle,
  TrendingUp, TrendingDown, Wallet, Printer, CheckCircle2
} from "lucide-react";

const ActiveCashGame = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<DBCashSession | null>(null);
  const [cashPlayers, setCashPlayers] = useState<(DBCashPlayer & { player?: DBPlayer })[]>([]);
  const [allPlayers, setAllPlayers] = useState<DBPlayer[]>([]);
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);
  const [financeSummary, setFinanceSummary] = useState<SessionFinanceSummary | null>(null);

  // Add player dialog
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [initialBuyin, setInitialBuyin] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [newPlayerModalOpen, setNewPlayerModalOpen] = useState(false);

  // Chips dialog
  const [chipsDialogOpen, setChipsDialogOpen] = useState(false);
  const [chipsAction, setChipsAction] = useState<"add" | "remove" | "rebuy">("add");
  const [chipsAmount, setChipsAmount] = useState("");
  const [chipsPaymentMethod, setChipsPaymentMethod] = useState<FinancialPaymentMethod>("cash");
  const [chipsTargetId, setChipsTargetId] = useState("");

  // Close player dialog
  const [closePlayerOpen, setClosePlayerOpen] = useState(false);
  const [closeTargetId, setCloseTargetId] = useState("");
  const [finalChips, setFinalChips] = useState("");

  // Player financial summary dialog (after closing)
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryPlayer, setSummaryPlayer] = useState<(DBCashPlayer & { player?: DBPlayer }) | null>(null);
  const printInProgressRef = useRef(false);

  // End session summary dialog
  const [endSessionOpen, setEndSessionOpen] = useState(false);

  // Player transaction history toggle
  const [expandedPlayerTx, setExpandedPlayerTx] = useState<string | null>(null);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const escapeHtml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const txLabelMap: Record<string, string> = {
    buyin: "Buy-in", rebuy: "Rebuy", addon: "Add Fichas", withdrawal: "Retirada", cashout: "Cash Out",
  };
  const txIconMap: Record<string, typeof LogIn> = {
    buyin: LogIn, rebuy: RotateCcw, addon: ArrowUpCircle, withdrawal: ArrowDownCircle, cashout: LogOut,
  };

  const load = async () => {
    if (!id) return;
    try {
      const s = await db.cashSessions.get(id);
      if (!s) { navigate("/cash-games"); return; }
      setSession(s);

      const cps = await db.cashPlayers.where("sessionId").equals(id).toArray();
      const playerIds = cps.map(cp => cp.playerId);
      const players = await db.players.where("id").anyOf(playerIds).toArray();
      const playerMap = new Map(players.map(p => [p.id, p]));
      setCashPlayers(cps.map(cp => ({ ...cp, player: playerMap.get(cp.playerId) })));

      const txs = await db.transactions.where("sessionId").equals(id).toArray();
      setTransactions(txs);
      setFinanceSummary(await getSessionFinanceSummary(s));

      const ap = await db.players.orderBy("name").toArray();
      setAllPlayers(ap);
    } catch (error) {
      console.error("Erro ao carregar sessão:", error);
      toast({ title: "Erro", description: "Falha ao carregar sessão.", variant: "destructive" });
    }
  };

  useEffect(() => { load(); }, [id]);

  // Build the printable HTML for a player's financial summary
  const buildSummaryHtml = (sp: (DBCashPlayer & { player?: DBPlayer })) => {
    if (!session) return "";
    const result = sp.result ?? 0;
    const positive = result >= 0;
    const minutes = sp.closedAt
      ? Math.floor((new Date(sp.closedAt).getTime() - new Date(sp.joinedAt).getTime()) / 60000)
      : 0;
    const timePlayed = `${Math.floor(minutes / 60)}h${(minutes % 60).toString().padStart(2, "0")}m`;
    const paymentLabel = sp.paymentStatus === "paid" ? "Pago" : sp.paymentStatus === "received" ? "Recebido" : "Pendente";
    const playerTxs = transactions
      .filter(t => t.cashPlayerId === sp.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const txRows = playerTxs.map(tx =>
      `<div class="row"><span>${formatTime(tx.timestamp)} ${escapeHtml(txLabelMap[tx.type] ?? tx.type)}</span><strong>R$ ${tx.amount.toFixed(2)}</strong></div>`
    ).join("");
    return `
      <!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=80mm, initial-scale=1" /><title>Recibo - ${escapeHtml(sp.player?.name ?? "Jogador")}</title></head><body>
        <main class="receipt">
        <h2>Cash Game Pro</h2>
        <p class="center" style="font-size:0.9em;">${escapeHtml(session.name)} • ${escapeHtml(session.blinds)}</p>
        <div class="row"><span>Jogador:</span><strong>${escapeHtml(sp.player?.name ?? "Jogador")}</strong></div>
        <div class="row"><span>Buy-in inicial:</span><span>R$ ${sp.initialBuyin.toFixed(2)}</span></div>
        <div class="row"><span>Total investido:</span><span>R$ ${sp.totalInvested.toFixed(2)}</span></div>
        <div class="row"><span>Fichas finais:</span><span>R$ ${(sp.finalChips ?? 0).toFixed(2)}</span></div>
        <div class="row"><span>Tempo jogado:</span><span>${timePlayed}</span></div>
        <div class="row"><span>Pagamento:</span><span>${paymentLabel}</span></div>
        ${txRows ? `<div class="sub"><b>Movimentações</b>${txRows}</div>` : ""}
        <div class="result ${positive ? "positive" : "negative"}">
          Resultado: R$ ${positive ? "+" : ""}${result.toFixed(2)}
        </div>
        <div class="footer"><p>Cash Game Pro</p><p>Documento gerado automaticamente</p></div>
        </main>
      </body></html>
    `;
  };

  // Print through an isolated thermal root in the main window.
  const printSummary = async (sp: (DBCashPlayer & { player?: DBPlayer }) | null) => {
    console.log("[receipt-print] printSummary start");

    if (!sp || !session) {
      toast({
        title: "Recibo indisponível",
        description: "Não há dados suficientes para imprimir este recibo.",
        variant: "destructive",
      });
      return;
    }

    if (printInProgressRef.current) {
      toast({
        title: "Impressão em andamento",
        description: "Aguarde a impressão atual terminar antes de tentar novamente.",
      });
      return;
    }

    printInProgressRef.current = true;

    try {
      await printThermalReceipt({
        html: buildSummaryHtml(sp),
        logPrefix: "[receipt-print]",
      });
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
    } finally {
      printInProgressRef.current = false;
    }
  };

  // F10 keyboard shortcut to print the open financial summary
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F10" && !e.repeat && summaryOpen && summaryPlayer) {
        e.preventDefault();
        void printSummary(summaryPlayer);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryOpen, summaryPlayer]);

  const handleAddPlayer = async () => {
    if (!selectedPlayerId) {
      toast({ title: "Erro", description: "Selecione um jogador.", variant: "destructive" });
      return;
    }
    if (!initialBuyin || parseFloat(initialBuyin) <= 0) {
      toast({ title: "Erro", description: "Informe o buy-in inicial.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(initialBuyin);
    try {
      const cpId = generateId();
      const now = new Date().toISOString();

      await db.cashPlayers.add({
        id: cpId,
        sessionId: id!,
        playerId: selectedPlayerId,
        initialBuyin: amount,
        totalInvested: amount,
        currentChips: amount,
        paymentMethod,
        paymentStatus: paymentMethod === "pending" || paymentMethod === "fiado" ? "pending" : "paid",
        joinedAt: now,
        isActive: true,
      });

      await db.transactions.add({
        id: generateId(),
        sessionId: id!,
        cashPlayerId: cpId,
        type: "buyin",
        amount,
        timestamp: now,
      });

      await recordFinancialEntry({
        sessionId: id!,
        playerId: selectedPlayerId,
        amount,
        paymentMethod: paymentMethod === "pending" ? "fiado" : paymentMethod as FinancialPaymentMethod,
        type: "buyin",
        occurredAt: now,
      });

      toast({ title: "Jogador adicionado! ♠", description: `Buy-in de R$ ${amount.toFixed(2)}` });
      setAddPlayerOpen(false);
      setSelectedPlayerId("");
      setInitialBuyin("");
      load();
    } catch (error) {
      console.error("Erro ao adicionar jogador:", error);
      toast({ title: "Erro", description: "Falha ao adicionar jogador.", variant: "destructive" });
    }
  };

  const handleChipsAction = async () => {
    if (!chipsAmount || parseFloat(chipsAmount) <= 0) {
      toast({ title: "Erro", description: "Informe o valor.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(chipsAmount);
    const cp = cashPlayers.find(c => c.id === chipsTargetId);
    if (!cp || !session) return;

    try {
      const now = new Date().toISOString();
      let newChips = cp.currentChips;
      let newInvested = cp.totalInvested;
      let txType: DBTransaction["type"] = "addon";

      if (chipsAction === "add" || chipsAction === "rebuy") {
        newChips += amount;
        newInvested += amount;
        txType = chipsAction === "rebuy" ? "rebuy" : "addon";
      } else {
        newChips -= amount;
        txType = "withdrawal";
      }

      await db.cashPlayers.update(chipsTargetId, { currentChips: newChips, totalInvested: newInvested });
      await db.transactions.add({
        id: generateId(), sessionId: id!, cashPlayerId: chipsTargetId,
        type: txType, amount, timestamp: now,
      });

      if (txType === "rebuy" || txType === "addon") {
        await recordFinancialEntry({
          sessionId: id!,
          playerId: cp.playerId,
          amount,
          paymentMethod: chipsPaymentMethod,
          type: txType,
          occurredAt: now,
        });
      }

      toast({ title: "Movimentação registrada!", description: `${chipsAction === "remove" ? "Retirada" : chipsAction === "rebuy" ? "Rebuy" : "Add"}: R$ ${amount.toFixed(2)}` });
      setChipsDialogOpen(false);
      setChipsAmount("");
      setChipsPaymentMethod("cash");
      load();
    } catch (error) {
      console.error("Erro:", error);
      toast({ title: "Erro", description: "Falha na movimentação.", variant: "destructive" });
    }
  };

  const handleClosePlayer = async () => {
    if (!finalChips || parseFloat(finalChips) < 0) {
      toast({ title: "Erro", description: "Informe as fichas finais.", variant: "destructive" });
      return;
    }
    const chips = parseFloat(finalChips);
    const cp = cashPlayers.find(c => c.id === closeTargetId);
    if (!cp) return;

    try {
      const result = chips - cp.totalInvested;
      await db.cashPlayers.update(closeTargetId, {
        finalChips: chips, result, isActive: false, closedAt: new Date().toISOString(), currentChips: chips,
      });

      if (result >= 0) {
        await db.players.where("id").equals(cp.playerId).modify(p => { p.totalWinnings += result; p.totalSessions += 1; });
      } else {
        await db.players.where("id").equals(cp.playerId).modify(p => { p.totalLosses += Math.abs(result); p.totalSessions += 1; });
      }

      await db.transactions.add({
        id: generateId(), sessionId: id!, cashPlayerId: closeTargetId,
        type: "cashout", amount: chips, timestamp: new Date().toISOString(),
      });

      toast({ title: "Jogador fechado!", description: `Resultado: R$ ${result >= 0 ? "+" : ""}${result.toFixed(2)}` });
      setClosePlayerOpen(false);
      setFinalChips("");
      setSummaryPlayer({
        ...cp,
        finalChips: chips,
        result,
        isActive: false,
        closedAt: new Date().toISOString(),
        currentChips: chips,
      });
      setSummaryOpen(true);
      load();
    } catch (error) {
      console.error("[close-account] error", error);
      toast({ title: "Erro", description: "Falha ao fechar jogador.", variant: "destructive" });
    }
  };

  const handleReopenPlayer = async (cashPlayerId: string) => {
    const cp = cashPlayers.find(c => c.id === cashPlayerId);
    if (!cp) return;
    try {
      // Revert player stats
      const result = cp.result ?? 0;
      if (result >= 0) {
        await db.players.where("id").equals(cp.playerId).modify(p => { p.totalWinnings -= result; p.totalSessions -= 1; });
      } else {
        await db.players.where("id").equals(cp.playerId).modify(p => { p.totalLosses -= Math.abs(result); p.totalSessions -= 1; });
      }

      // Remove cashout transaction
      const txs = await db.transactions.where("sessionId").equals(id!).toArray();
      const cashoutTx = txs.filter(t => t.cashPlayerId === cashPlayerId && t.type === "cashout").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      if (cashoutTx) await db.transactions.delete(cashoutTx.id);

      // Reopen the player
      await db.cashPlayers.update(cashPlayerId, {
        isActive: true, finalChips: undefined, result: undefined, closedAt: undefined,
        currentChips: cp.totalInvested,
      });

      toast({ title: "Jogador reaberto! 🔄", description: `${cp.player?.name ?? "Jogador"} voltou à mesa.` });
      load();
    } catch (error) {
      console.error("Erro ao reabrir jogador:", error);
      toast({ title: "Erro", description: "Falha ao reabrir jogador.", variant: "destructive" });
    }
  };

  // Calculated values for end-session summary
  const totalInvested = cashPlayers.reduce((sum, cp) => sum + cp.totalInvested, 0);
  const totalReturned = cashPlayers.filter(cp => !cp.isActive).reduce((sum, cp) => sum + (cp.finalChips ?? 0), 0);
  const rakeFinal = totalInvested - totalReturned;
  const dealerPayment = rakeFinal * (session?.dealerPercentage ?? 0) / 100;
  const houseRakeNet = rakeFinal - dealerPayment;
  const financeExpenses = financeSummary?.expenses ?? 0;
  const finalNetResult = houseRakeNet - financeExpenses;
  const activePlayers = cashPlayers.filter(cp => cp.isActive);
  const allClosed = activePlayers.length === 0 && cashPlayers.length > 0;

  const handleEndSession = async () => {
    if (activePlayers.length > 0) {
      toast({ title: "Atenção", description: `Feche todos os jogadores antes de encerrar. (${activePlayers.length} ativos)`, variant: "destructive" });
      return;
    }
    if (cashPlayers.length === 0) {
      toast({ title: "Atenção", description: "Nenhum jogador participou desta sessão.", variant: "destructive" });
      return;
    }
    // Show summary dialog
    setEndSessionOpen(true);
  };

  const confirmEndSession = async () => {
    if (totalReturned > totalInvested) {
      toast({ title: "Erro de conferência", description: "Valor devolvido maior que o investido. Verifique as fichas finais.", variant: "destructive" });
      return;
    }
    try {
      console.log("[EndSession] Saving session:", id, { totalInvested, totalReturned, rakeFinal });
      const updated = await db.cashSessions.update(id!, {
        status: "closed" as const,
        endedAt: new Date().toISOString(),
        totalInvested,
        totalReturned,
        rakeFinal,
      });
      console.log("[EndSession] Update result:", updated);
      
      if (updated === 0) {
        toast({ title: "Erro", description: "Sessão não encontrada para atualizar.", variant: "destructive" });
        return;
      }
      
      // Verify the save worked
      const saved = await db.cashSessions.get(id!);
      console.log("[EndSession] Verified saved session:", saved?.status, saved?.rakeFinal);
      
      toast({ title: "Cash Game encerrado! 🏁", description: `Rake da casa: R$ ${rakeFinal.toFixed(2)}` });
      setEndSessionOpen(false);
      navigate("/history");
    } catch (error) {
      console.error("Erro ao encerrar:", error);
      toast({ title: "Erro", description: "Falha ao encerrar. Verifique o console.", variant: "destructive" });
    }
  };

  // Live timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const update = () => setElapsed(Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  const totalChips = cashPlayers.reduce((sum, cp) => sum + cp.currentChips, 0);
  const totalBuyins = cashPlayers.reduce((sum, cp) => sum + cp.totalInvested, 0);
  const availablePlayersToAdd = allPlayers.filter(p => !cashPlayers.find(cp => cp.playerId === p.id && cp.isActive));
  const hours = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cash-games")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl text-poker-gold">{session.name}</h2>
          <p className="text-xs text-muted-foreground">{session.blinds} • {session.gameType.replace("_", " ")}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-mono font-bold text-primary tabular-nums">
            {hours.toString().padStart(2, "0")}:{mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Users, label: "Ativos", value: activePlayers.length, color: "text-primary" },
          { icon: Spade, label: "Fichas", value: `R$${totalChips.toFixed(0)}`, color: "text-foreground" },
          { icon: DollarSign, label: "Buy-ins", value: `R$${totalBuyins.toFixed(0)}`, color: "text-secondary" },
        ].map((stat, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-2 text-center">
              <stat.icon className={`w-4 h-4 mx-auto ${stat.color}`} />
              <p className="text-lg font-bold font-display">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Player Button */}
      <Button onClick={() => setAddPlayerOpen(true)} className="w-full h-12 font-display glow-green">
        <Plus className="w-5 h-5 mr-2" />
        Adicionar Jogador
      </Button>

      {/* Players List */}
      <div className="space-y-2">
        {cashPlayers.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              Nenhum jogador na mesa. Adicione jogadores para começar.
            </CardContent>
          </Card>
        ) : cashPlayers.map((cp) => (
          <Card key={cp.id} className={`border-border ${cp.isActive ? "bg-card" : "bg-muted/50 opacity-60"}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="font-semibold text-sm">{cp.player?.name ?? "Jogador"}</p>
                  {cp.player?.nickname && <p className="text-xs text-muted-foreground">"{cp.player.nickname}"</p>}
                </div>
                <div className="flex items-center gap-2">
                  {/* Transaction history toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Ver histórico de ações"
                    onClick={() => setExpandedPlayerTx(expandedPlayerTx === cp.id ? null : cp.id)}
                  >
                    <ClipboardList className={`w-4 h-4 ${expandedPlayerTx === cp.id ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
                  <div className="text-right">
                    <p className="text-sm font-bold">R$ {cp.currentChips.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">Investido: R$ {cp.totalInvested.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Entry time */}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
                <Clock className="w-3 h-3" />
                <span>Entrada: {formatTime(cp.joinedAt)}</span>
                {cp.closedAt && <span className="ml-2">• Saída: {formatTime(cp.closedAt)}</span>}
              </div>

              {/* Expanded transaction history */}
              {expandedPlayerTx === cp.id && (
                <div className="bg-muted/50 rounded-lg p-2 mb-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">Histórico de ações:</p>
                  {(() => {
                    const playerTxs = transactions
                      .filter(t => t.cashPlayerId === cp.id)
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    if (playerTxs.length === 0) return <p className="text-[10px] text-muted-foreground">Nenhuma movimentação.</p>;
                    return playerTxs.map(tx => {
                      const Icon = txIconMap[tx.type] ?? Clock;
                      return (
                        <div key={tx.id} className="flex items-center gap-2 text-xs">
                          <span className="text-[10px] text-muted-foreground w-12 shrink-0 font-mono">{formatTime(tx.timestamp)}</span>
                          <Icon className="w-3 h-3 shrink-0 text-muted-foreground" />
                          <span className="flex-1">{txLabelMap[tx.type] ?? tx.type}</span>
                          <span className="font-bold">R$ {tx.amount.toFixed(2)}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {cp.isActive ? (
                <div className="grid grid-cols-4 gap-1">
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { setChipsTargetId(cp.id); setChipsAction("add"); setChipsDialogOpen(true); }}>
                    <PlusCircle className="w-3 h-3 mr-1" /> Add
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { setChipsTargetId(cp.id); setChipsAction("remove"); setChipsDialogOpen(true); }}>
                    <MinusCircle className="w-3 h-3 mr-1" /> Ret
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { setChipsTargetId(cp.id); setChipsAction("rebuy"); setChipsDialogOpen(true); }}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Rebuy
                  </Button>
                  <Button size="sm" variant="destructive" className="text-xs h-8" onClick={() => { setCloseTargetId(cp.id); setClosePlayerOpen(true); }}>
                    <Lock className="w-3 h-3 mr-1" /> Fechar
                  </Button>
                </div>
              ) : session.status === "active" ? (
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className={`font-bold ${(cp.result ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                      Resultado: R$ {(cp.result ?? 0) >= 0 ? "+" : ""}{(cp.result ?? 0).toFixed(2)}
                    </span>
                    <span className="ml-2 text-muted-foreground">({cp.paymentStatus})</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => { setCloseTargetId(cp.id); setFinalChips(String(cp.finalChips ?? 0)); setClosePlayerOpen(true); }}>
                      ✏️ Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => handleReopenPlayer(cp.id)}>
                      <RotateCcw className="w-3 h-3 mr-1" /> Reabrir
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-xs">
                  <span className={`font-bold ${(cp.result ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                    Resultado: R$ {(cp.result ?? 0) >= 0 ? "+" : ""}{(cp.result ?? 0).toFixed(2)}
                  </span>
                  <span className="ml-2 text-muted-foreground">({cp.paymentStatus})</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* End Session */}
      {session.status === "active" && (
        <Button onClick={handleEndSession} variant="destructive" className="w-full h-12 font-display mt-4">
          <Lock className="w-5 h-5 mr-2" />
          Encerrar Cash Game
        </Button>
      )}

      {/* End Session Summary Dialog */}
      <Dialog open={endSessionOpen} onOpenChange={setEndSessionOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-poker-gold flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Relatório de Movimento
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[70vh] p-4 pt-2 space-y-4">
            {/* Session info */}
            <div className="text-xs text-muted-foreground">
              <p>{session.name} • {session.blinds} • {session.gameType.replace("_", " ")}</p>
              <p>Início: {new Date(session.startedAt).toLocaleString("pt-BR")}</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Jogadores</p>
                <p className="text-xl font-bold font-display">{cashPlayers.length}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Rake Bruto</p>
                <p className={`text-xl font-bold font-display ${rakeFinal >= 0 ? "text-primary" : "text-destructive"}`}>
                  R$ {rakeFinal.toFixed(2)}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Investido</p>
                <p className="text-lg font-bold font-display text-secondary">R$ {totalInvested.toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Devolvido</p>
                <p className="text-lg font-bold font-display">R$ {totalReturned.toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Dealer ({(session.dealerPercentage ?? 0).toFixed(2)}%)</p>
                <p className="text-lg font-bold font-display text-secondary">R$ {dealerPayment.toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Rake Liquido Casa</p>
                <p className={`text-lg font-bold font-display ${houseRakeNet >= 0 ? "text-primary" : "text-destructive"}`}>
                  R$ {houseRakeNet.toFixed(2)}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Dinheiro</p>
                <p className="text-lg font-bold font-display">R$ {(financeSummary?.cash ?? 0).toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Pix</p>
                <p className="text-lg font-bold font-display">R$ {(financeSummary?.pix ?? 0).toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Credito</p>
                <p className="text-lg font-bold font-display">R$ {(financeSummary?.credit ?? 0).toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Debito</p>
                <p className="text-lg font-bold font-display">R$ {(financeSummary?.debit ?? 0).toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Fiados Gerados</p>
                <p className="text-lg font-bold font-display text-secondary">R$ {(financeSummary?.fiado ?? 0).toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="text-lg font-bold font-display text-destructive">R$ {financeExpenses.toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center col-span-2">
                <p className="text-xs text-muted-foreground">Resultado Liquido Final</p>
                <p className={`text-xl font-bold font-display ${finalNetResult >= 0 ? "text-primary" : "text-destructive"}`}>
                  R$ {finalNetResult.toFixed(2)}
                </p>
              </div>
            </div>

            {totalReturned > totalInvested && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">Erro de conferência: valor devolvido maior que o investido.</p>
              </div>
            )}

            {/* Full player report with transaction history */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-poker-gold">Detalhes por Jogador</p>
              {cashPlayers.map(cp => {
                const playerTxs = transactions.filter(t => t.cashPlayerId === cp.id).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                const txLabels: Record<string, string> = { buyin: "Buy-in", rebuy: "Rebuy", addon: "Add Fichas", withdrawal: "Retirada", cashout: "Cash Out" };
                return (
                  <Card key={cp.id} className="bg-muted/50 border-border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{cp.player?.name ?? "Jogador"}</p>
                          {cp.player?.nickname && <p className="text-[10px] text-muted-foreground">"{cp.player.nickname}"</p>}
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${(cp.result ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                            {(cp.result ?? 0) >= 0 ? "+" : ""}R$ {(cp.result ?? 0).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Investido: R$ {cp.totalInvested.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex gap-3">
                        <span>Entrada: {new Date(cp.joinedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        {cp.closedAt && <span>Saída: {new Date(cp.closedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
                      </div>
                      {playerTxs.length > 0 && (
                        <div className="bg-background/50 rounded p-2 space-y-1">
                          {playerTxs.map(tx => (
                            <div key={tx.id} className="flex items-center gap-2 text-xs">
                              <span className="text-[10px] text-muted-foreground w-12 shrink-0">
                                {new Date(tx.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="flex-1">{txLabels[tx.type] ?? tx.type}</span>
                              <span className="font-bold">R$ {tx.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          <div className="p-4 pt-0 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setEndSessionOpen(false)}>Cancelar</Button>
            <Button onClick={confirmEndSession} variant="destructive" disabled={totalReturned > totalInvested}>
              Confirmar Encerramento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Player Dialog */}
      <Dialog open={addPlayerOpen} onOpenChange={setAddPlayerOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-poker-gold flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Adicionar Jogador
            </DialogTitle>
          </DialogHeader>
          <div
            className="space-y-4"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleAddPlayer(); }
            }}
          >
            <div className="space-y-2">
              <Label>Jogador</Label>
              <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Selecione um jogador..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayersToAdd.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}{p.nickname ? ` (${p.nickname})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setNewPlayerModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Criar Novo Jogador
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Buy-in Inicial (R$) *</Label>
              <Input
                type="number"
                value={initialBuyin}
                onChange={(e) => setInitialBuyin(e.target.value)}
                placeholder="100"
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="credit">Credito</SelectItem>
                  <SelectItem value="debit">Debito</SelectItem>
                  <SelectItem value="fiado">Fiado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPlayerOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddPlayer} className="glow-green">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chips Dialog */}
      <Dialog open={chipsDialogOpen} onOpenChange={setChipsDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-poker-gold">
              {chipsAction === "add" ? "Adicionar Fichas" : chipsAction === "remove" ? "Retirar Fichas" : "Rebuy"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" value={chipsAmount} onChange={(e) => setChipsAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleChipsAction(); } }} placeholder="50" className="bg-muted border-border" />
            </div>
            {chipsAction !== "remove" && (
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={chipsPaymentMethod} onValueChange={(v) => setChipsPaymentMethod(v as FinancialPaymentMethod)}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="credit">Credito</SelectItem>
                    <SelectItem value="debit">Debito</SelectItem>
                    <SelectItem value="fiado">Fiado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChipsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleChipsAction} className="glow-green">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Player Dialog */}
      <Dialog open={closePlayerOpen} onOpenChange={setClosePlayerOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-poker-gold">Fechar Conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {closeTargetId && (() => {
              const cp = cashPlayers.find(c => c.id === closeTargetId);
              return cp ? (
                <div className="text-sm text-muted-foreground">
                  <p>Total investido: <span className="text-foreground font-bold">R$ {cp.totalInvested.toFixed(2)}</span></p>
                  <p>Fichas atuais: <span className="text-foreground font-bold">R$ {cp.currentChips.toFixed(2)}</span></p>
                </div>
              ) : null;
            })()}
            <div className="space-y-2">
              <Label>Fichas Finais (R$)</Label>
              <Input type="number" value={finalChips} onChange={(e) => setFinalChips(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleClosePlayer(); } }} placeholder="0" className="bg-muted border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosePlayerOpen(false)}>Cancelar</Button>
            <Button onClick={handleClosePlayer} variant="destructive">Fechar Conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Player Financial Summary Dialog */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-poker-gold flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Resumo Financeiro
            </DialogTitle>
            <DialogDescription>
              Recibo financeiro do jogador fechado nesta sessão.
            </DialogDescription>
          </DialogHeader>
          {summaryPlayer && (() => {
            const result = summaryPlayer.result ?? 0;
            const positive = result >= 0;
            const playerTxs = transactions
              .filter(t => t.cashPlayerId === summaryPlayer.id)
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const minutes = summaryPlayer.closedAt
              ? Math.floor((new Date(summaryPlayer.closedAt).getTime() - new Date(summaryPlayer.joinedAt).getTime()) / 60000)
              : 0;
            const timePlayed = `${Math.floor(minutes / 60)}h${(minutes % 60).toString().padStart(2, "0")}m`;
            const paymentLabel = summaryPlayer.paymentStatus === "paid" ? "Pago" : summaryPlayer.paymentStatus === "received" ? "Recebido" : "Pendente";

            return (
              <div className="space-y-4">
                {/* Player header */}
                <div className="text-center">
                  <p className="text-lg font-bold">{summaryPlayer.player?.name ?? "Jogador"}</p>
                  {summaryPlayer.player?.nickname && (
                    <p className="text-xs text-muted-foreground">"{summaryPlayer.player.nickname}"</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">{session.name} • {session.blinds}</p>
                </div>

                {/* Result highlight */}
                <div className={`rounded-lg p-4 text-center ${positive ? "bg-primary/10 border border-primary/30" : "bg-destructive/10 border border-destructive/30"}`}>
                  <div className="flex items-center justify-center gap-2">
                    {positive ? <TrendingUp className="w-5 h-5 text-primary" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
                    <span className="text-xs text-muted-foreground">{positive ? "Lucro" : "Prejuízo"}</span>
                  </div>
                  <p className={`text-2xl font-bold font-display ${positive ? "text-primary" : "text-destructive"}`}>
                    {positive ? "+" : ""}R$ {result.toFixed(2)}
                  </p>
                </div>

                {/* Financial breakdown */}
                <div className="bg-muted rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buy-in inicial</span>
                    <span className="font-semibold">R$ {summaryPlayer.initialBuyin.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total investido</span>
                    <span className="font-bold text-secondary">R$ {summaryPlayer.totalInvested.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fichas finais</span>
                    <span className="font-bold">R$ {(summaryPlayer.finalChips ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">Tempo jogado</span>
                    <span>{timePlayed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entrada</span>
                    <span>{formatTime(summaryPlayer.joinedAt)}{summaryPlayer.closedAt ? ` • Saída ${formatTime(summaryPlayer.closedAt)}` : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pagamento</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {paymentLabel}</span>
                  </div>
                </div>

                {/* Transaction history */}
                {playerTxs.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">Movimentações</p>
                    {playerTxs.map(tx => {
                      const Icon = txIconMap[tx.type] ?? Clock;
                      return (
                        <div key={tx.id} className="flex items-center gap-2 text-xs">
                          <span className="text-[10px] text-muted-foreground w-12 shrink-0 font-mono">{formatTime(tx.timestamp)}</span>
                          <Icon className="w-3 h-3 shrink-0 text-muted-foreground" />
                          <span className="flex-1">{txLabelMap[tx.type] ?? tx.type}</span>
                          <span className="font-bold">R$ {tx.amount.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSummaryOpen(false)}>Fechar</Button>
                  <Button
                    type="button"
                    className="glow-green"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      console.log("[receipt-print] button clicked");
                      void printSummary(summaryPlayer);
                    }}
                  >
                    <Printer className="w-4 h-4 mr-1" /> Imprimir Recibo <span className="ml-1 text-[10px] opacity-70">(F10)</span>
                  </Button>
                </DialogFooter>

              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <PlayerModal
        open={newPlayerModalOpen}
        onOpenChange={setNewPlayerModalOpen}
        onPlayerCreated={(player) => {
          setSelectedPlayerId(player.id);
          load();
        }}
      />
    </div>
  );
};

export default ActiveCashGame;
