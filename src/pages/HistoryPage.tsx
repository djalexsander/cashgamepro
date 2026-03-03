import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  History, DollarSign, Users, Clock, ChevronRight,
  TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, RotateCcw, LogIn, LogOut, Trash2
} from "lucide-react";
import { db, type DBCashSession, type DBCashPlayer, type DBPlayer, type DBTransaction } from "@/db/database";
import { useToast } from "@/hooks/use-toast";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const formatDateTime = (iso: string) => `${formatDate(iso)} ${formatTime(iso)}`;

const txLabel: Record<string, string> = {
  buyin: "Buy-in",
  rebuy: "Rebuy",
  addon: "Add Fichas",
  withdrawal: "Retirada",
  cashout: "Cash Out",
};

const txIcon: Record<string, typeof LogIn> = {
  buyin: LogIn,
  rebuy: RotateCcw,
  addon: ArrowUpCircle,
  withdrawal: ArrowDownCircle,
  cashout: LogOut,
};

interface SessionDetail {
  session: DBCashSession;
  players: (DBCashPlayer & { player?: DBPlayer })[];
  transactions: DBTransaction[];
}

const HistoryPage = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<DBCashSession[]>([]);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const all = await db.cashSessions.toArray();
        console.log("[History] All sessions:", all.length, all.map(s => ({ id: s.id, name: s.name, status: s.status })));
        const closed = all.filter(s => s.status === "closed");
        closed.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        console.log("[History] Closed sessions:", closed.length);
        setSessions(closed);
      } catch (e) {
        console.error("[History] Erro ao carregar histórico:", e);
      }
    };
    loadHistory();
  }, []);

  const openDetail = async (session: DBCashSession) => {
    const cps = await db.cashPlayers.where("sessionId").equals(session.id).toArray();
    const playerIds = cps.map(cp => cp.playerId);
    const players = await db.players.where("id").anyOf(playerIds).toArray();
    const playerMap = new Map(players.map(p => [p.id, p]));
    const enriched = cps.map(cp => ({ ...cp, player: playerMap.get(cp.playerId) }));
    const txs = await db.transactions.where("sessionId").equals(session.id).toArray();
    txs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setDetail({ session, players: enriched, transactions: txs });
    setDetailOpen(true);
  };

  const duration = (s: DBCashSession) => {
    if (!s.endedAt) return "";
    const mins = Math.floor((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000);
    return `${Math.floor(mins / 60)}h${(mins % 60).toString().padStart(2, "0")}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-poker-gold">Histórico</h2>
        {sessions.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="text-xs"
            onClick={async () => {
              // Get IDs of closed sessions
              const closedIds = sessions.map(s => s.id);
              // Delete related cashPlayers and transactions
              for (const sid of closedIds) {
                const cps = await db.cashPlayers.where("sessionId").equals(sid).toArray();
                await db.cashPlayers.bulkDelete(cps.map(c => c.id));
                const txs = await db.transactions.where("sessionId").equals(sid).toArray();
                await db.transactions.bulkDelete(txs.map(t => t.id));
              }
              await db.cashSessions.bulkDelete(closedIds);
              setSessions([]);
              toast({ title: "Histórico limpo! 🗑️", description: "Todas as sessões finalizadas foram removidas." });
            }}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Limpar Tudo
          </Button>
        )}
      </div>

      {sessions.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum histórico disponível.</p>
            <p className="text-sm text-muted-foreground mt-1">Os cash games finalizados aparecerão aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <Card key={s.id} className="bg-card border-border cursor-pointer hover:border-primary/40 transition-colors" onClick={() => openDetail(s)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.blinds} • {s.gameType.replace("_", " ")} • {formatDate(s.startedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">R$ {(s.rakeFinal ?? 0).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{duration(s)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Session Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-poker-gold flex items-center gap-2">
              <History className="w-5 h-5" />
              {detail?.session.name}
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <ScrollArea className="max-h-[75vh] p-4 pt-2">
              <div className="space-y-4">
                {/* Session info */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Tipo: {detail.session.gameType.replace("_", " ")} • Blinds: {detail.session.blinds}</p>
                  <p>Início: {formatDateTime(detail.session.startedAt)}</p>
                  {detail.session.endedAt && <p>Fim: {formatDateTime(detail.session.endedAt)}</p>}
                  <p>Duração: {duration(detail.session)}</p>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Jogadores", value: detail.players.length, icon: Users, color: "text-foreground" },
                    { label: "Rake da Casa", value: `R$ ${(detail.session.rakeFinal ?? 0).toFixed(2)}`, icon: DollarSign, color: "text-primary" },
                    { label: "Total Investido", value: `R$ ${(detail.session.totalInvested ?? 0).toFixed(2)}`, icon: TrendingUp, color: "text-secondary" },
                    { label: "Total Devolvido", value: `R$ ${(detail.session.totalReturned ?? 0).toFixed(2)}`, icon: TrendingDown, color: "text-muted-foreground" },
                  ].map((s, i) => (
                    <div key={i} className="bg-muted rounded-lg p-3 text-center">
                      <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-sm font-bold font-display">{s.value}</p>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Player results */}
                <div>
                  <h4 className="text-sm font-semibold text-poker-gold mb-2">Resultados por Jogador</h4>
                  <div className="space-y-2">
                    {detail.players.map(cp => {
                      const playerTxs = detail.transactions.filter(t => t.cashPlayerId === cp.id);
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

                            {/* Timestamps */}
                            <div className="text-[10px] text-muted-foreground flex gap-3">
                              <span>Entrada: {formatTime(cp.joinedAt)}</span>
                              {cp.closedAt && <span>Saída: {formatTime(cp.closedAt)}</span>}
                            </div>

                            {/* Transaction log with timestamps */}
                            {playerTxs.length > 0 && (
                              <div className="bg-background/50 rounded p-2 space-y-1">
                                <p className="text-[10px] text-muted-foreground font-semibold mb-1">Movimentações:</p>
                                {playerTxs.map(tx => {
                                  const Icon = txIcon[tx.type] ?? Clock;
                                  return (
                                    <div key={tx.id} className="flex items-center gap-2 text-xs">
                                      <span className="text-[10px] text-muted-foreground w-12 shrink-0">{formatTime(tx.timestamp)}</span>
                                      <Icon className="w-3 h-3 shrink-0 text-muted-foreground" />
                                      <span className="flex-1">{txLabel[tx.type] ?? tx.type}</span>
                                      <span className="font-bold">R$ {tx.amount.toFixed(2)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistoryPage;
