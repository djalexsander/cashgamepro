import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Search, Trash2, Edit, ChevronRight, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  db,
  type DBCashPlayer,
  type DBCashSession,
  type DBFinancialTransaction,
  type DBPlayer,
  type DBReceivable,
  type DBTransaction,
} from "@/db/database";
import PlayerModal from "@/components/PlayerModal";
import { toast } from "@/hooks/use-toast";
import Seo from "@/components/Seo";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  buildPlayerFinancialCycles,
  calculatePlayerFinancialSummary,
  type PlayerCycle,
  type PlayerFinancialSummary,
} from "@/lib/finance-calculator";

type PlayerSessionDetail = {
  session: DBCashSession;
  cashPlayers: DBCashPlayer[];
  transactions: DBTransaction[];
  financialTransactions: DBFinancialTransaction[];
  receivables: DBReceivable[];
  cycles: PlayerCycle[];
  summary: PlayerFinancialSummary;
  totalPaid: number;
  openDebt: number;
  openCredit: number;
  paymentForms: string[];
  status: "Em aberto" | "Crédito em aberto" | "Recebido" | "Pago" | "Quitado";
};

type PlayerDetail = {
  player: DBPlayer;
  sessions: PlayerSessionDetail[];
  summary: {
    totalSessions: number;
    totalInvested: number;
    totalCashout: number;
    result: number;
    totalPaid: number;
    totalFiado: number;
    openDebt: number;
    openCredit: number;
    credits: number;
    status: string;
  };
};

const paymentLabels: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit: "Crédito",
  debit: "Débito",
  fiado: "Fiado",
  pending: "Pendente",
};

const transactionLabels: Record<string, string> = {
  buyin: "Buy-in",
  rebuy: "Rebuy",
  addon: "Add-on",
  withdrawal: "Retirada",
  cashout: "Cash-out",
};

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const shortDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";

const sum = <T,>(items: T[], pick: (item: T) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char] ?? char));

const getStatusVariant = (status: PlayerSessionDetail["status"]) => {
  if (status === "Em aberto") return "destructive";
  if (status === "Crédito em aberto") return "outline";
  return "secondary";
};

const Players = () => {
  const [players, setPlayers] = useState<DBPlayer[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editPlayer, setEditPlayer] = useState<DBPlayer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);

  const loadPlayers = async () => {
    try {
      const all = await db.players.orderBy("name").toArray();
      setPlayers(all);
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
    }
  };

  useEffect(() => { loadPlayers(); }, []);

  const handleDelete = async (player: DBPlayer) => {
    if (!confirm(`Excluir ${player.name}?`)) return;
    try {
      await db.players.delete(player.id);
      toast({ title: "Jogador excluído", description: `${player.name} foi removido.` });
      loadPlayers();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast({ title: "Erro", description: "Falha ao excluir jogador.", variant: "destructive" });
    }
  };

  const openPlayerDetail = async (player: DBPlayer) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);

    try {
      const [sessions, cashPlayers, transactions, financialTransactions, receivables] = await Promise.all([
        db.cashSessions.toArray(),
        db.cashPlayers.toArray(),
        db.transactions.toArray(),
        db.financialTransactions.toArray(),
        db.receivables.toArray(),
      ]);

      const playerCashPlayers = cashPlayers.filter(item => item.playerId === player.id);
      const sessionIds = [...new Set(playerCashPlayers.map(item => item.sessionId))];

      const sessionDetails = sessionIds
        .map(sessionId => {
          const session = sessions.find(item => item.id === sessionId);
          if (!session) return null;

          const cashPlayersInSession = playerCashPlayers.filter(item => item.sessionId === sessionId);
          const cashPlayerIds = new Set(cashPlayersInSession.map(item => item.id));
          const playerTransactions = transactions
            .filter(item => item.sessionId === sessionId && cashPlayerIds.has(item.cashPlayerId))
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const playerFinancialTransactions = financialTransactions
            .filter(item => item.sessionId === sessionId && item.playerId === player.id)
            .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
          const playerReceivables = receivables.filter(item => item.sessionId === sessionId && item.playerId === player.id);
          const cycles = buildPlayerFinancialCycles({
            sessionId,
            playerId: player.id,
            transactions: playerTransactions,
            financialTransactions: playerFinancialTransactions,
          });
          const summary = calculatePlayerFinancialSummary(cycles);
          const totalPaid = playerFinancialTransactions
            .filter(item => item.paymentMethod !== "fiado" && item.type !== "settlement")
            .reduce((total, item) => total + item.amount, 0);
          const settlementPaid = playerFinancialTransactions
            .filter(item => item.type === "settlement")
            .reduce((total, item) => total + item.amount, 0);
          const receivablePaid = playerReceivables.reduce((total, item) => total + item.paidAmount, 0);
          const openDebt = Math.max(summary.clientPays - receivablePaid, 0);
          const openCredit = Math.max(summary.clientReceives - settlementPaid, 0);
          const paymentForms = [...new Set(
            playerFinancialTransactions
              .filter(item => item.type !== "settlement")
              .map(item => paymentLabels[item.paymentMethod] ?? item.paymentMethod)
          )];
          const status: PlayerSessionDetail["status"] =
            openDebt > 0 ? "Em aberto" :
            openCredit > 0 ? "Crédito em aberto" :
            settlementPaid > 0 ? "Pago" :
            receivablePaid > 0 ? "Recebido" :
            "Quitado";

          return {
            session,
            cashPlayers: cashPlayersInSession,
            transactions: playerTransactions,
            financialTransactions: playerFinancialTransactions,
            receivables: playerReceivables,
            cycles,
            summary,
            totalPaid,
            openDebt,
            openCredit,
            paymentForms,
            status,
          };
        })
        .filter((item): item is PlayerSessionDetail => Boolean(item))
        .sort((a, b) => new Date(b.session.startedAt).getTime() - new Date(a.session.startedAt).getTime());

      const totalInvested = sum(sessionDetails, item => item.summary.totalInvested);
      const totalCashout = sum(sessionDetails, item => item.summary.totalCashout);
      const totalPaid = sum(sessionDetails, item => item.totalPaid);
      const totalFiado = sum(sessionDetails, item => item.summary.totalFiado);
      const openDebt = sum(sessionDetails, item => item.openDebt);
      const openCredit = sum(sessionDetails, item => item.openCredit);
      const result = totalCashout - totalInvested;
      const status =
        openDebt > 0 ? "Deve para a casa" :
        openCredit > 0 ? "Crédito a pagar" :
        "Sem pendências";

      setDetail({
        player,
        sessions: sessionDetails,
        summary: {
          totalSessions: sessionDetails.length,
          totalInvested,
          totalCashout,
          result,
          totalPaid,
          totalFiado,
          openDebt,
          openCredit,
          credits: openCredit,
          status,
        },
      });
    } catch (error) {
      console.error("Erro ao carregar detalhe do jogador:", error);
      toast({ title: "Erro", description: "Falha ao carregar histórico do jogador.", variant: "destructive" });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePrintReport = () => {
    if (!detail) return;

    const rows = detail.sessions.map(item => `
      <section>
        <h2>${escapeHtml(item.session.name)}</h2>
        <p><strong>Data:</strong> ${shortDate(item.session.startedAt)} | <strong>Status:</strong> ${escapeHtml(item.status)}</p>
        <table>
          <tbody>
            <tr><td>Total investido</td><td>${currency(item.summary.totalInvested)}</td></tr>
            <tr><td>Total fiado</td><td>${currency(item.summary.totalFiado)}</td></tr>
            <tr><td>Total cash-out</td><td>${currency(item.summary.totalCashout)}</td></tr>
            <tr><td>Resultado da sessão</td><td>${currency(item.summary.result)}</td></tr>
            <tr><td>Formas de pagamento</td><td>${escapeHtml(item.paymentForms.join(", ") || "-")}</td></tr>
            <tr><td>Cliente paga</td><td>${currency(item.openDebt)}</td></tr>
            <tr><td>Cliente recebe</td><td>${currency(item.openCredit)}</td></tr>
          </tbody>
        </table>
        <h3>Movimentações</h3>
        <ul>
          ${item.transactions.map(tx => {
            const financialTx = item.financialTransactions.find(financial =>
              financial.type === tx.type &&
              financial.amount === tx.amount &&
              Math.abs(new Date(financial.occurredAt).getTime() - new Date(tx.timestamp).getTime()) < 2000
            );
            const payment = financialTx ? paymentLabels[financialTx.paymentMethod] ?? financialTx.paymentMethod : "";
            const label = `${transactionLabels[tx.type] ?? tx.type}${payment ? ` - ${payment}` : ""}`;
            return `<li>${dateTime(tx.timestamp)} - ${escapeHtml(label)}: ${currency(tx.amount)}</li>`;
          }).join("")}
        </ul>
      </section>
    `).join("");

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório de ${escapeHtml(detail.player.name)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
            h1 { margin: 0 0 8px; }
            h2 { border-top: 1px solid #ddd; padding-top: 18px; margin-top: 24px; }
            table { border-collapse: collapse; width: 100%; margin: 12px 0; }
            td { border: 1px solid #ddd; padding: 8px; }
            td:last-child { text-align: right; font-weight: 700; }
            li { margin: 4px 0; }
          </style>
        </head>
        <body>
          <h1>Relatório financeiro - ${escapeHtml(detail.player.name)}</h1>
          ${detail.player.nickname ? `<p>Apelido: ${escapeHtml(detail.player.nickname)}</p>` : ""}
          <table>
            <tbody>
              <tr><td>Total de sessões</td><td>${detail.summary.totalSessions}</td></tr>
              <tr><td>Total investido</td><td>${currency(detail.summary.totalInvested)}</td></tr>
              <tr><td>Total devolvido/cash-out</td><td>${currency(detail.summary.totalCashout)}</td></tr>
              <tr><td>Resultado total no jogo</td><td>${currency(detail.summary.result)}</td></tr>
              <tr><td>Total pago</td><td>${currency(detail.summary.totalPaid)}</td></tr>
              <tr><td>Total fiado</td><td>${currency(detail.summary.totalFiado)}</td></tr>
              <tr><td>Saldo que deve para a casa</td><td>${currency(detail.summary.openDebt)}</td></tr>
              <tr><td>Saldo a receber da casa</td><td>${currency(detail.summary.openCredit)}</td></tr>
              <tr><td>Status geral</td><td>${escapeHtml(detail.summary.status)}</td></tr>
            </tbody>
          </table>
          ${rows}
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filtered = useMemo(() => players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.nickname.toLowerCase().includes(search.toLowerCase())
  ), [players, search]);

  return (
    <div className="space-y-6">
      <Seo
        title="Jogadores - Cash Game Pro"
        description="Cadastre e gerencie os jogadores das suas partidas de poker no Cash Game Pro."
        path="/players"
      />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-poker-gold">Jogadores</h2>
        <Button size="sm" className="font-display" onClick={() => { setEditPlayer(null); setModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          Novo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar jogador..."
          className="pl-10 bg-card border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum jogador cadastrado.</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Novo" para adicionar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((player) => (
            <Card
              key={player.id}
              className="bg-card border-border cursor-pointer transition-colors hover:border-primary/60"
              role="button"
              tabIndex={0}
              onClick={() => openPlayerDetail(player)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPlayerDetail(player);
                }
              }}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{player.name}</p>
                  {player.nickname && <p className="text-sm text-muted-foreground truncate">"{player.nickname}"</p>}
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{player.totalSessions} sessões</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar jogador ${player.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditPlayer(player);
                      setModalOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir jogador ${player.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(player);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-card border-border max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes financeiros do jogador</DialogTitle>
            <DialogDescription>
              Histórico individual separado entre resultado de jogo e saldo financeiro.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-12 text-center text-muted-foreground">Carregando histórico...</div>
          ) : detail ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{detail.player.name}</h3>
                  {detail.player.nickname && <p className="text-sm text-muted-foreground">"{detail.player.nickname}"</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={detail.summary.openDebt > 0 ? "destructive" : "secondary"}>
                    {detail.summary.status}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={handlePrintReport}>
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir relatório
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Sessões jogadas" value={String(detail.summary.totalSessions)} />
                <SummaryCard label="Total investido" value={currency(detail.summary.totalInvested)} />
                <SummaryCard label="Total devolvido/cash-out" value={currency(detail.summary.totalCashout)} />
                <SummaryCard label="Resultado total no jogo" value={currency(detail.summary.result)} valueClassName={detail.summary.result >= 0 ? "text-primary" : "text-destructive"} />
                <SummaryCard label="Total pago" value={currency(detail.summary.totalPaid)} />
                <SummaryCard label="Total fiado" value={currency(detail.summary.totalFiado)} />
                <SummaryCard label="A receber da casa" value={currency(detail.summary.openCredit)} />
                <SummaryCard label="Deve para a casa" value={currency(detail.summary.openDebt)} valueClassName={detail.summary.openDebt > 0 ? "text-destructive" : undefined} />
                <SummaryCard label="Créditos do jogador" value={currency(detail.summary.credits)} />
                <SummaryCard label="Status geral" value={detail.summary.status} />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg text-poker-gold">Histórico por sessão</h3>
                {detail.sessions.length === 0 ? (
                  <Card className="bg-muted/20 border-border">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      Nenhuma sessão encontrada para este jogador.
                    </CardContent>
                  </Card>
                ) : detail.sessions.map((item) => (
                  <Card key={item.session.id} className="bg-muted/20 border-border">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="font-semibold">{item.session.name}</h4>
                          <p className="text-sm text-muted-foreground">{shortDate(item.session.startedAt)}</p>
                        </div>
                        <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                        <DetailItem label="Buy-ins" value={currency(sum(item.transactions.filter(tx => tx.type === "buyin"), tx => tx.amount))} />
                        <DetailItem label="Rebuys" value={currency(sum(item.transactions.filter(tx => tx.type === "rebuy"), tx => tx.amount))} />
                        <DetailItem label="Retiradas/cash-outs" value={currency(sum(item.transactions.filter(tx => tx.type === "withdrawal" || tx.type === "cashout"), tx => tx.amount))} />
                        <DetailItem label="Formas de pagamento" value={item.paymentForms.join(", ") || "-"} />
                        <DetailItem label="Total investido" value={currency(item.summary.totalInvested)} />
                        <DetailItem label="Total fiado" value={currency(item.summary.totalFiado)} />
                        <DetailItem label="Total cash-out" value={currency(item.summary.totalCashout)} />
                        <DetailItem label="Resultado da sessão" value={currency(item.summary.result)} valueClassName={item.summary.result >= 0 ? "text-primary" : "text-destructive"} />
                        <DetailItem label="Cliente paga" value={currency(item.openDebt)} valueClassName={item.openDebt > 0 ? "text-destructive" : undefined} />
                        <DetailItem label="Cliente recebe" value={currency(item.openCredit)} />
                      </div>

                      <div className="rounded-md border border-border overflow-hidden">
                        <div className="grid grid-cols-[90px_1fr_120px] gap-2 bg-background/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
                          <span>Horário</span>
                          <span>Movimentação</span>
                          <span className="text-right">Valor</span>
                        </div>
                        {item.transactions.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-muted-foreground">Nenhuma movimentação registrada.</div>
                        ) : item.transactions.map(tx => {
                          const financialTx = item.financialTransactions.find(financial =>
                            financial.type === tx.type &&
                            financial.amount === tx.amount &&
                            Math.abs(new Date(financial.occurredAt).getTime() - new Date(tx.timestamp).getTime()) < 2000
                          );
                          const payment = financialTx ? paymentLabels[financialTx.paymentMethod] ?? financialTx.paymentMethod : "";
                          return (
                            <div key={tx.id} className="grid grid-cols-[90px_1fr_120px] gap-2 border-t border-border px-3 py-2 text-sm">
                              <span className="text-muted-foreground">{dateTime(tx.timestamp).slice(12)}</span>
                              <span>{transactionLabels[tx.type] ?? tx.type}{payment ? ` - ${payment}` : ""}</span>
                              <span className="text-right font-semibold">{currency(tx.amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <PlayerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onPlayerCreated={() => loadPlayers()}
        editPlayer={editPlayer}
      />
    </div>
  );
};

function SummaryCard({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}

function DetailItem({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}

export default Players;
