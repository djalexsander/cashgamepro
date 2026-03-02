import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { db, generateId, type DBCashSession, type DBCashPlayer, type DBPlayer, type DBTransaction, type PaymentMethod } from "@/db/database";
import { toast } from "@/hooks/use-toast";
import PlayerModal from "@/components/PlayerModal";
import {
  ArrowLeft, Plus, Users, DollarSign, Clock, Spade,
  PlusCircle, MinusCircle, RotateCcw, Lock, UserPlus, AlertTriangle
} from "lucide-react";

const ActiveCashGame = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<DBCashSession | null>(null);
  const [cashPlayers, setCashPlayers] = useState<(DBCashPlayer & { player?: DBPlayer })[]>([]);
  const [allPlayers, setAllPlayers] = useState<DBPlayer[]>([]);
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);

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
  const [chipsTargetId, setChipsTargetId] = useState("");

  // Close player dialog
  const [closePlayerOpen, setClosePlayerOpen] = useState(false);
  const [closeTargetId, setCloseTargetId] = useState("");
  const [finalChips, setFinalChips] = useState("");

  // End session summary dialog
  const [endSessionOpen, setEndSessionOpen] = useState(false);

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

      const ap = await db.players.orderBy("name").toArray();
      setAllPlayers(ap);
    } catch (error) {
      console.error("Erro ao carregar sessão:", error);
      toast({ title: "Erro", description: "Falha ao carregar sessão.", variant: "destructive" });
    }
  };

  useEffect(() => { load(); }, [id]);

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
        paymentStatus: paymentMethod === "pending" ? "pending" : "paid",
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

      toast({ title: "Movimentação registrada!", description: `${chipsAction === "remove" ? "Retirada" : chipsAction === "rebuy" ? "Rebuy" : "Add"}: R$ ${amount.toFixed(2)}` });
      setChipsDialogOpen(false);
      setChipsAmount("");
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
      load();
    } catch (error) {
      console.error("Erro:", error);
      toast({ title: "Erro", description: "Falha ao fechar jogador.", variant: "destructive" });
    }
  };

  // Calculated values for end-session summary
  const totalInvested = cashPlayers.reduce((sum, cp) => sum + cp.totalInvested, 0);
  const totalReturned = cashPlayers.filter(cp => !cp.isActive).reduce((sum, cp) => sum + (cp.finalChips ?? 0), 0);
  const rakeFinal = totalInvested - totalReturned;
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
      await db.cashSessions.update(id!, {
        status: "closed",
        endedAt: new Date().toISOString(),
        totalInvested,
        totalReturned,
        rakeFinal,
      });
      toast({ title: "Cash Game encerrado! 🏁", description: `Rake da casa: R$ ${rakeFinal.toFixed(2)}` });
      setEndSessionOpen(false);
      navigate("/cash-games");
    } catch (error) {
      console.error("Erro:", error);
      toast({ title: "Erro", description: "Falha ao encerrar.", variant: "destructive" });
    }
  };

  if (!session) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  const totalChips = cashPlayers.reduce((sum, cp) => sum + cp.currentChips, 0);
  const totalBuyins = cashPlayers.reduce((sum, cp) => sum + cp.totalInvested, 0);
  const availablePlayersToAdd = allPlayers.filter(p => !cashPlayers.find(cp => cp.playerId === p.id && cp.isActive));
  const elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60000);
  const hours = Math.floor(elapsed / 60);
  const mins = elapsed % 60;

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
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {hours}h{mins.toString().padStart(2, "0")}m
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
        {cashPlayers.map((cp) => (
          <Card key={cp.id} className={`border-border ${cp.isActive ? "bg-card" : "bg-muted/50 opacity-60"}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm">{cp.player?.name ?? "Jogador"}</p>
                  {cp.player?.nickname && <p className="text-xs text-muted-foreground">"{cp.player.nickname}"</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">R$ {cp.currentChips.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">Investido: R$ {cp.totalInvested.toFixed(2)}</p>
                </div>
              </div>
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
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-poker-gold flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Resumo do Cash Game
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Jogadores</p>
                <p className="text-xl font-bold font-display">{cashPlayers.length}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Investido</p>
                <p className="text-xl font-bold font-display text-secondary">R$ {totalInvested.toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Devolvido</p>
                <p className="text-xl font-bold font-display">R$ {totalReturned.toFixed(2)}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Rake da Casa</p>
                <p className={`text-xl font-bold font-display ${rakeFinal >= 0 ? "text-primary" : "text-destructive"}`}>
                  R$ {rakeFinal.toFixed(2)}
                </p>
              </div>
            </div>

            {totalReturned > totalInvested && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">Erro de conferência: valor devolvido maior que o investido.</p>
              </div>
            )}

            {/* Player results summary */}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              <p className="text-xs text-muted-foreground font-semibold">Resultados:</p>
              {cashPlayers.map(cp => (
                <div key={cp.id} className="flex justify-between text-sm">
                  <span>{cp.player?.name ?? "Jogador"}</span>
                  <span className={`font-bold ${(cp.result ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                    R$ {(cp.result ?? 0) >= 0 ? "+" : ""}{(cp.result ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndSessionOpen(false)}>Cancelar</Button>
            <Button onClick={confirmEndSession} variant="destructive" disabled={totalReturned > totalInvested}>
              Confirmar Encerramento
            </Button>
          </DialogFooter>
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
          <div className="space-y-4">
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
              <Input type="number" value={initialBuyin} onChange={(e) => setInitialBuyin(e.target.value)} placeholder="100" className="bg-muted border-border" />
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
                  <SelectItem value="pending">Pendente</SelectItem>
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
              <Input type="number" value={chipsAmount} onChange={(e) => setChipsAmount(e.target.value)} placeholder="50" className="bg-muted border-border" />
            </div>
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
              <Input type="number" value={finalChips} onChange={(e) => setFinalChips(e.target.value)} placeholder="0" className="bg-muted border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosePlayerOpen(false)}>Cancelar</Button>
            <Button onClick={handleClosePlayer} variant="destructive">Fechar Conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Player Modal */}
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
