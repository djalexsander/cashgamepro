import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Spade, DollarSign, Clock, Trophy, Play, Trash2, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { db, type DBCashSession, type DBCashPlayer, type DBTransaction } from "@/db/database";
import Seo from "@/components/Seo";
import { getHiddenRecentTransactionIds, getHiddenSessionIds, hideRecentTransactionIds } from "@/utils/visualHistory";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<DBCashSession[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [activeSessions, setActiveSessions] = useState<DBCashSession[]>([]);
  const [recentActivity, setRecentActivity] = useState<(DBTransaction & { playerName?: string; sessionName?: string })[]>([]);
  const [totalRake, setTotalRake] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const hiddenSessionIds = getHiddenSessionIds();
        const allSessions = (await db.cashSessions.toArray()).filter(session => !hiddenSessionIds.has(session.id));
        setSessions(allSessions);

        const active = allSessions.filter(s => s.status === "active");
        setActiveSessions(active);

        const closed = allSessions.filter(s => s.status === "closed");
        const rake = closed.reduce((sum, s) => sum + (s.rakeFinal ?? 0), 0);
        setTotalRake(rake);

        const players = await db.players.toArray();
        setPlayerCount(players.length);

        // Recent transactions (last 10)
        const allTxs = await db.transactions.toArray();
        const allCashPlayers = await db.cashPlayers.toArray();
        
        const hiddenRecentTransactionIds = getHiddenRecentTransactionIds();
        const sorted = allTxs
          .filter(tx => !hiddenRecentTransactionIds.has(tx.id))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10);
        
        const enriched = sorted.map(tx => {
          const cp = allCashPlayers.find(c => c.id === tx.cashPlayerId);
          const player = cp ? players.find(p => p.id === cp.playerId) : undefined;
          const session = allSessions.find(s => s.id === tx.sessionId);
          return { ...tx, playerName: player?.name ?? player?.nickname ?? "Jogador", sessionName: session?.name ?? "" };
        });
        setRecentActivity(enriched);
      } catch (e) {
        console.error("Erro ao carregar dashboard:", e);
      }
    };
    loadData();
  }, []);

  const txLabel = (type: string) => {
    switch (type) {
      case "buyin": return "Buy-in";
      case "rebuy": return "Rebuy";
      case "addon": return "Add-on";
      case "withdrawal": return "Retirada";
      case "cashout": return "Cash-out";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <Seo
        title="Painel — Cash Game Pro"
        description="Painel principal do Cash Game Pro: acompanhe sessões ativas, rake total e atividades recentes em tempo real."
        path="/"
      />
      <Button
        onClick={() => navigate("/cash-games/new")}
        className="w-full h-16 text-lg font-display glow-green"
        size="lg"
      >
        <Plus className="w-6 h-6 mr-2" />
        Iniciar Cash Game
      </Button>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Spade className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{sessions.length}</p>
              <p className="text-xs text-muted-foreground">Sessões</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{playerCount}</p>
              <p className="text-xs text-muted-foreground">Jogadores</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">R$ {totalRake.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Rake Total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">R$ {totalRake.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Lucro Casa</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      <Card className="bg-poker-felt border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-poker-gold flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Sessões Ativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <>
              <p className="text-muted-foreground text-sm">Nenhuma sessão ativa no momento.</p>
              <Button
                variant="outline"
                className="mt-3 w-full border-primary/50 text-primary hover:bg-primary/10"
                onClick={() => navigate("/cash-games/new")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Nova Sessão
              </Button>
            </>
          ) : (
            <div className="space-y-2">
              {activeSessions.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 cursor-pointer hover:bg-background/80 transition-colors"
                  onClick={() => navigate(`/cash-games/${s.id}`)}
                >
                  <div>
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.blinds} • {s.gameType.replace("_", " ")}</p>
                  </div>
                  <div className="flex items-center gap-2 text-primary">
                    <Play className="w-4 h-4" />
                    <span className="text-xs font-bold">ATIVA</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-secondary" />
              Atividade Recente
            </CardTitle>
            {recentActivity.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => setClearAllOpen(true)}
              >
                <Trash2 className="w-3 h-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma atividade registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tx.playerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {txLabel(tx.type)} • {tx.sessionName}
                    </p>
                  </div>
                  <div className="text-right mr-2">
                    <p className={`text-sm font-bold ${tx.type === "withdrawal" || tx.type === "cashout" ? "text-secondary" : "text-primary"}`}>
                      R$ {tx.amount.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tx.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir atividade"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setDeleteTarget(tx.id!.toString())}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Confirm delete single activity */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação só remove o item da atividade recente. O Financeiro permanece intacto.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              try {
                hideRecentTransactionIds([deleteTarget!]);
                setRecentActivity(prev => prev.filter(t => t.id!.toString() !== deleteTarget));
                toast({ title: "Atividade ocultada" });
              } catch (e) { console.error(e); toast({ title: "Erro", variant: "destructive" }); }
              setDeleteTarget(null);
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm clear all */}
      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar toda atividade?</AlertDialogTitle>
            <AlertDialogDescription>As atividades recentes serão limpas apenas do Dashboard. O Financeiro permanece intacto.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              try {
                hideRecentTransactionIds(recentActivity.map(tx => tx.id));
                setRecentActivity([]);
                toast({ title: "Atividades recentes limpas" });
              } catch (e) { console.error(e); toast({ title: "Erro", variant: "destructive" }); }
              setClearAllOpen(false);
            }}>Limpar Tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
