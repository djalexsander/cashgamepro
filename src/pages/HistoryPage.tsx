import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  History, DollarSign, Users, Clock, ChevronRight, Filter, CalendarIcon, X,
  TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, RotateCcw, LogIn, LogOut, Trash2
} from "lucide-react";
import { db, deleteSessionFinancialData, type DBCashSession, type DBCashPlayer, type DBPlayer, type DBTransaction } from "@/db/database";
import Seo from "@/components/Seo";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [filteredSessions, setFilteredSessions] = useState<DBCashSession[]>([]);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterGameType, setFilterGameType] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const all = await db.cashSessions.toArray();
        const closed = all.filter(s => s.status === "closed");
        closed.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        setSessions(closed);
        setFilteredSessions(closed);
      } catch (e) {
        console.error("[History] Erro ao carregar histórico:", e);
      }
    };
    loadHistory();
  }, []);

  // Apply filters
  useEffect(() => {
    let result = [...sessions];

    if (filterGameType !== "all") {
      result = result.filter(s => s.gameType === filterGameType);
    }

    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter(s => new Date(s.startedAt) >= from);
    }

    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(s => new Date(s.startedAt) <= to);
    }

    if (filterSearch.trim()) {
      const search = filterSearch.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(search) || s.blinds.toLowerCase().includes(search));
    }

    setFilteredSessions(result);
  }, [sessions, filterGameType, filterDateFrom, filterDateTo, filterSearch]);

  const hasActiveFilters = filterGameType !== "all" || filterDateFrom || filterDateTo || filterSearch.trim();

  const clearFilters = () => {
    setFilterGameType("all");
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setFilterSearch("");
  };

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

  const deleteSession = async (sid: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const cps = await db.cashPlayers.where("sessionId").equals(sid).toArray();
    await db.cashPlayers.bulkDelete(cps.map(c => c.id));
    const txs = await db.transactions.where("sessionId").equals(sid).toArray();
    await db.transactions.bulkDelete(txs.map(t => t.id));
    await deleteSessionFinancialData(sid);
    await db.cashSessions.delete(sid);
    setSessions(prev => prev.filter(s => s.id !== sid));
    toast({ title: "Sessão excluída! 🗑️" });
  };

  const uniqueGameTypes = [...new Set(sessions.map(s => s.gameType))];

  return (
    <div className="space-y-4">
      <Seo
        title="Histórico de Partidas — Cash Game Pro"
        description="Consulte o histórico completo de partidas de poker, com rake, duração e detalhes de cada sessão."
        path="/history"
      />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-poker-gold">Histórico</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3 h-3 mr-1" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-1 w-4 h-4 rounded-full bg-primary-foreground text-primary text-[10px] flex items-center justify-center">
                !
              </span>
            )}
          </Button>
          {sessions.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="text-xs"
              onClick={async () => {
                const closedIds = sessions.map(s => s.id);
                for (const sid of closedIds) {
                  const cps = await db.cashPlayers.where("sessionId").equals(sid).toArray();
                  await db.cashPlayers.bulkDelete(cps.map(c => c.id));
                  const txs = await db.transactions.where("sessionId").equals(sid).toArray();
                  await db.transactions.bulkDelete(txs.map(t => t.id));
                  await deleteSessionFinancialData(sid);
                }
                await db.cashSessions.bulkDelete(closedIds);
                setSessions([]);
                toast({ title: "Histórico limpo! 🗑️" });
              }}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium font-sans normal-case tracking-normal">Filtrar sessões</p>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearFilters}>
                  <X className="w-3 h-3 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>

            {/* Search */}
            <Input
              placeholder="Buscar por nome ou blinds..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="h-9 text-sm"
            />

            <div className="grid grid-cols-2 gap-2">
              {/* Game type */}
              <Select value={filterGameType} onValueChange={setFilterGameType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Tipo de jogo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os jogos</SelectItem>
                  {uniqueGameTypes.map(gt => (
                    <SelectItem key={gt} value={gt}>{gt.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Placeholder for alignment */}
              <div />

              {/* Date from */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 text-xs justify-start font-normal font-sans normal-case tracking-normal">
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {filterDateFrom ? format(filterDateFrom, "dd/MM/yy", { locale: ptBR }) : "Data início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={filterDateFrom} onSelect={setFilterDateFrom} locale={ptBR} />
                </PopoverContent>
              </Popover>

              {/* Date to */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 text-xs justify-start font-normal font-sans normal-case tracking-normal">
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {filterDateTo ? format(filterDateTo, "dd/MM/yy", { locale: ptBR }) : "Data fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={filterDateTo} onSelect={setFilterDateTo} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>

            <p className="text-xs text-muted-foreground font-sans normal-case tracking-normal">
              {filteredSessions.length} de {sessions.length} sessões
            </p>
          </CardContent>
        </Card>
      )}

      {filteredSessions.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {hasActiveFilters ? "Nenhuma sessão encontrada com os filtros aplicados." : "Nenhum histórico disponível."}
            </p>
            {!hasActiveFilters && (
              <p className="text-sm text-muted-foreground mt-1">Os cash games finalizados aparecerão aqui.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map(s => (
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
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir partida do histórico"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(s.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Tipo: {detail.session.gameType.replace("_", " ")} • Blinds: {detail.session.blinds}</p>
                  <p>Início: {formatDateTime(detail.session.startedAt)}</p>
                  {detail.session.endedAt && <p>Fim: {formatDateTime(detail.session.endedAt)}</p>}
                  <p>Duração: {duration(detail.session)}</p>
                </div>

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

                            <div className="text-[10px] text-muted-foreground flex gap-3">
                              <span>Entrada: {formatTime(cp.joinedAt)}</span>
                              {cp.closedAt && <span>Saída: {formatTime(cp.closedAt)}</span>}
                            </div>

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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados desta sessão serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) deleteSession(deleteTarget); setDeleteTarget(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HistoryPage;
