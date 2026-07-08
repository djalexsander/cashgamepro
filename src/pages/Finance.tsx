import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  db,
  generateId,
  calculateSessionFiadoBalances,
  getSessionFinanceSummary,
  payReceivable,
  reconcileSessionFiadoBalances,
  type DBCashSession,
  type DBFinancialTransaction,
  type PlayerFiadoBalance,
  type DBPlayer,
  type DBReceivable,
  type DBSessionExpense,
  type ExpenseCategory,
  type FinancialPaymentMethod,
  type ReceivablePaymentMethod,
  type SessionFinanceSummary,
} from "@/db/database";
import { toast } from "@/hooks/use-toast";
import { Banknote, CalendarDays, CreditCard, DollarSign, Edit, Plus, Receipt, Trash2, WalletCards } from "lucide-react";

type ReceivableGroup = {
  playerId: string;
  player?: DBPlayer;
  items: DBReceivable[];
  totalOpen: number;
  lastDebit?: DBReceivable;
  originSession?: DBCashSession;
};

type MonthlySummary = SessionFinanceSummary & {
  fiadoGenerated: number;
  sessionsCount: number;
};

const money = (value: number) => `R$ ${value.toFixed(2)}`;
const dateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const toDateTimeLocal = (iso: string) => {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};
const fromDateTimeLocal = (value: string) => value ? new Date(value).toISOString() : new Date().toISOString();

const paymentLabels: Record<FinancialPaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit: "Crédito",
  debit: "Débito",
  fiado: "Fiado",
};

const txLabels: Record<string, string> = {
  buyin: "Buy-in",
  rebuy: "Rebuy",
  addon: "Add-on",
  settlement: "Acerto",
  fiado_payment: "Pagamento de fiado",
  manual_adjustment: "Ajuste manual",
};

const expenseLabels: Record<ExpenseCategory, string> = {
  dealer: "Dealer",
  food: "Alimentação",
  drinks: "Bebidas",
  staff: "Funcionários",
  cleaning: "Limpeza",
  rent: "Aluguel",
  other: "Outros",
};

const emptySummary: SessionFinanceSummary = {
  receivedTotal: 0,
  cash: 0,
  pix: 0,
  credit: 0,
  debit: 0,
  fiado: 0,
  totalReceivable: 0,
  expenses: 0,
  rakeGross: 0,
  dealerPercentage: 0,
  dealerPayment: 0,
  houseRakeNet: 0,
  netResult: 0,
  fiadoReceived: 0,
};

const Finance = () => {
  const [sessions, setSessions] = useState<DBCashSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [players, setPlayers] = useState<DBPlayer[]>([]);
  const [transactions, setTransactions] = useState<DBFinancialTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<DBFinancialTransaction[]>([]);
  const [receivables, setReceivables] = useState<DBReceivable[]>([]);
  const [fiadoCredits, setFiadoCredits] = useState<PlayerFiadoBalance[]>([]);
  const [expenses, setExpenses] = useState<DBSessionExpense[]>([]);
  const [allExpenses, setAllExpenses] = useState<DBSessionExpense[]>([]);
  const [summary, setSummary] = useState<SessionFinanceSummary>(emptySummary);
  const [filterMethod, setFilterMethod] = useState<FinancialPaymentMethod | "all">("all");
  const [loading, setLoading] = useState(true);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentGroup, setPaymentGroup] = useState<ReceivableGroup | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ReceivablePaymentMethod>("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DBSessionExpense | null>(null);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("other");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(toDateTimeLocal(new Date().toISOString()));

  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? null;
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const sessionMap = useMemo(() => new Map(sessions.map(s => [s.id, s])), [sessions]);

  const load = async () => {
    setLoading(true);
    try {
      const allSessions = await db.cashSessions.orderBy("startedAt").reverse().toArray();
      await Promise.all(allSessions.map(session => reconcileSessionFiadoBalances(session.id)));

      const [allPlayers, allReceivables, everyTransaction, everyExpense] = await Promise.all([
        db.players.orderBy("name").toArray(),
        db.receivables.toArray(),
        db.financialTransactions.toArray(),
        db.sessionExpenses.toArray(),
      ]);
      setSessions(allSessions);
      setPlayers(allPlayers);
      setReceivables(allReceivables);
      setAllTransactions(everyTransaction);
      setAllExpenses(everyExpense);

      const preferred = selectedSessionId || allSessions.find(s => s.status === "active")?.id || allSessions[0]?.id || "";
      setSelectedSessionId(preferred);

      if (preferred) {
        const session = allSessions.find(s => s.id === preferred);
        const [sessionTxs, sessionExpenses] = await Promise.all([
          db.financialTransactions.where("sessionId").equals(preferred).toArray(),
          db.sessionExpenses.where("sessionId").equals(preferred).toArray(),
        ]);
        sessionTxs.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
        sessionExpenses.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
        setTransactions(sessionTxs);
        setExpenses(sessionExpenses);
        setFiadoCredits((await calculateSessionFiadoBalances(preferred)).filter(balance => balance.creditAmount > 0));
        setSummary(session ? await getSessionFinanceSummary(session) : emptySummary);
      } else {
        setTransactions([]);
        setExpenses([]);
        setFiadoCredits([]);
        setSummary(emptySummary);
      }
    } catch (error) {
      console.error("Erro ao carregar financeiro:", error);
      toast({ title: "Erro", description: "Falha ao carregar dados financeiros.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selectedSessionId) void load(); }, [selectedSessionId]);

  const filteredTransactions = transactions.filter(tx => filterMethod === "all" || tx.paymentMethod === filterMethod);
  const openReceivables = receivables.filter(item => item.status === "open" && item.originalAmount > item.paidAmount);
  const receivableGroups = useMemo<ReceivableGroup[]>(() => {
    const groups = new Map<string, DBReceivable[]>();
    for (const item of openReceivables) {
      groups.set(item.playerId, [...(groups.get(item.playerId) ?? []), item]);
    }
    return [...groups.entries()].map(([playerId, items]) => {
      const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastDebit = sorted[0];
      return {
        playerId,
        player: playerMap.get(playerId),
        items: sorted,
        totalOpen: sorted.reduce((sum, item) => sum + item.originalAmount - item.paidAmount, 0),
        lastDebit,
        originSession: lastDebit ? sessionMap.get(lastDebit.sessionId) : undefined,
      };
    }).sort((a, b) => b.totalOpen - a.totalOpen);
  }, [openReceivables, playerMap, sessionMap]);

  const monthlySummary = useMemo<MonthlySummary>(() => {
    const m = Number(month) - 1;
    const y = Number(year);
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 1);
    const inMonth = (iso: string) => {
      const d = new Date(iso);
      return d >= monthStart && d < monthEnd;
    };
    const monthSessions = sessions.filter(s => inMonth(s.startedAt));
    const sessionIds = new Set(monthSessions.map(s => s.id));
    const monthTxs = allTransactions.filter(tx => inMonth(tx.occurredAt));
    const sessionExpenses = allExpenses.filter(expense => sessionIds.has(expense.sessionId));
    const rakeGross = monthSessions.reduce((sum, s) => sum + Number(s.rakeFinal ?? 0), 0);
    const dealerPayment = monthSessions.reduce((sum, s) => sum + (Number(s.rakeFinal ?? 0) * Number(s.dealerPercentage ?? 0) / 100), 0);
    const expenseTotal = sessionExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const byMethod = (method: FinancialPaymentMethod) => monthTxs.filter(tx => tx.paymentMethod === method).reduce((sum, tx) => sum + tx.amount, 0);
    const fiadoGenerated = monthTxs.filter(tx => tx.paymentMethod === "fiado").reduce((sum, tx) => sum + tx.amount, 0);
    return {
      ...emptySummary,
      receivedTotal: byMethod("cash") + byMethod("pix") + byMethod("credit") + byMethod("debit"),
      cash: byMethod("cash"),
      pix: byMethod("pix"),
      credit: byMethod("credit"),
      debit: byMethod("debit"),
      fiado: fiadoGenerated,
      fiadoGenerated,
      fiadoReceived: monthTxs.filter(tx => tx.type === "fiado_payment").reduce((sum, tx) => sum + tx.amount, 0),
      totalReceivable: openReceivables.reduce((sum, item) => sum + item.originalAmount - item.paidAmount, 0),
      expenses: expenseTotal,
      rakeGross,
      dealerPayment,
      houseRakeNet: rakeGross - dealerPayment,
      netResult: rakeGross - dealerPayment - expenseTotal,
      sessionsCount: monthSessions.length,
    };
  }, [month, year, sessions, openReceivables, allTransactions, allExpenses]);

  const openPayment = (group: ReceivableGroup) => {
    setPaymentGroup(group);
    setPaymentAmount(String(group.totalOpen.toFixed(2)));
    setPaymentMethod("cash");
    setPaymentNotes("");
    setPaymentOpen(true);
  };

  const registerPayment = async () => {
    if (!paymentGroup) return;
    let remaining = Number(paymentAmount);
    if (!remaining || remaining <= 0 || remaining > paymentGroup.totalOpen) {
      toast({ title: "Valor inválido", description: "Informe um valor maior que zero e menor ou igual ao saldo aberto.", variant: "destructive" });
      return;
    }
    try {
      const sorted = [...paymentGroup.items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      for (const item of sorted) {
        if (remaining <= 0) break;
        const balance = item.originalAmount - item.paidAmount;
        const amount = Math.min(balance, remaining);
        await payReceivable({ receivable: item, amount, paymentMethod, notes: paymentNotes.trim() || undefined });
        remaining -= amount;
      }
      toast({ title: "Pagamento registrado", description: `${paymentGroup.player?.name ?? "Cliente"} atualizado.` });
      setPaymentOpen(false);
      await load();
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      toast({ title: "Erro", description: "Falha ao registrar pagamento.", variant: "destructive" });
    }
  };

  const openExpense = (expense?: DBSessionExpense) => {
    setEditingExpense(expense ?? null);
    setExpenseCategory(expense?.category ?? "other");
    setExpenseDescription(expense?.description ?? "");
    setExpenseAmount(expense ? String(expense.amount) : "");
    setExpenseDate(toDateTimeLocal(expense?.occurredAt ?? new Date().toISOString()));
    setExpenseOpen(true);
  };

  const saveExpense = async () => {
    if (!selectedSession) return;
    const amount = Number(expenseAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Valor inválido", description: "Informe o valor da despesa.", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        sessionId: selectedSession.id,
        category: expenseCategory,
        description: expenseDescription.trim(),
        amount,
        occurredAt: fromDateTimeLocal(expenseDate),
      };
      if (editingExpense) {
        await db.sessionExpenses.update(editingExpense.id, payload);
      } else {
        await db.sessionExpenses.add({ id: generateId(), ...payload });
      }
      toast({ title: editingExpense ? "Despesa atualizada" : "Despesa adicionada" });
      setExpenseOpen(false);
      await load();
    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      toast({ title: "Erro", description: "Falha ao salvar despesa.", variant: "destructive" });
    }
  };

  const deleteExpense = async (expense: DBSessionExpense) => {
    await db.sessionExpenses.delete(expense.id);
    toast({ title: "Despesa excluída" });
    await load();
  };

  const cards = [
    { label: "Recebido total", value: summary.receivedTotal, icon: DollarSign },
    { label: "Dinheiro", value: summary.cash, icon: Banknote },
    { label: "PIX", value: summary.pix, icon: WalletCards },
    { label: "Crédito", value: summary.credit, icon: CreditCard },
    { label: "Débito", value: summary.debit, icon: CreditCard },
    { label: "Fiado", value: summary.fiado, icon: Receipt },
    { label: "Total a receber", value: summary.totalReceivable, icon: Receipt },
    { label: "Clientes a pagar", value: fiadoCredits.reduce((sum, item) => sum + item.creditAmount, 0), icon: Receipt },
    { label: "Despesas", value: summary.expenses, icon: Receipt },
    { label: "Rake bruto", value: summary.rakeGross, icon: DollarSign },
    { label: "Comissão dealer", value: summary.dealerPayment, icon: DollarSign },
    { label: "Rake líquido", value: summary.houseRakeNet, icon: DollarSign },
    { label: "Resultado líquido", value: summary.netResult, icon: DollarSign },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl text-poker-gold">Financeiro</h2>
          <p className="text-xs text-muted-foreground">Controle da sessão, contas a receber, despesas e resumo mensal.</p>
        </div>
        <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
          <SelectTrigger className="bg-muted border-border sm:w-72">
            <SelectValue placeholder="Selecione uma sessão" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map(session => (
              <SelectItem key={session.id} value={session.id}>
                {session.name} - {session.status === "active" ? "Ativa" : "Fechada"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando financeiro...</p>}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {cards.map(card => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="p-3">
              <card.icon className="w-4 h-4 text-primary mb-1" />
              <p className="text-[10px] text-muted-foreground">{card.label}</p>
              <p className="text-base font-bold font-display">{money(card.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="receipts" className="space-y-3">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="receipts">Recebimentos</TabsTrigger>
          <TabsTrigger value="receivables">Clientes</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="monthly">Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="receipts" className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["all", "cash", "pix", "credit", "debit", "fiado"] as const).map(method => (
              <Button key={method} variant={filterMethod === method ? "default" : "outline"} size="sm" onClick={() => setFilterMethod(method)}>
                {method === "all" ? "Todos" : paymentLabels[method]}
              </Button>
            ))}
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3 text-left">Data/hora</th>
                    <th className="p-3 text-left">Jogador</th>
                    <th className="p-3 text-left">Tipo</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-left">Forma</th>
                    <th className="p-3 text-left">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(tx => (
                    <tr key={tx.id} className="border-b border-border/60">
                      <td className="p-3 whitespace-nowrap">{dateTime(tx.occurredAt)}</td>
                      <td className="p-3">{tx.playerId ? playerMap.get(tx.playerId)?.name ?? "Jogador" : "-"}</td>
                      <td className="p-3">{txLabels[tx.type] ?? tx.type}</td>
                      <td className="p-3 text-right font-semibold">{money(tx.amount)}</td>
                      <td className="p-3"><Badge variant="outline">{paymentLabels[tx.paymentMethod]}</Badge></td>
                      <td className="p-3 text-muted-foreground">{tx.notes || "-"}</td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum recebimento encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receivables" className="space-y-3">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Clientes para receber</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3 text-left">Jogador</th>
                    <th className="p-3 text-right">Total em aberto</th>
                    <th className="p-3 text-left">Último débito</th>
                    <th className="p-3 text-left">Sessão de origem</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {receivableGroups.map(group => (
                    <tr key={group.playerId} className="border-b border-border/60">
                      <td className="p-3 font-semibold">{group.player?.name ?? "Jogador"}</td>
                      <td className="p-3 text-right font-bold">{money(group.totalOpen)}</td>
                      <td className="p-3">{group.lastDebit ? dateTime(group.lastDebit.createdAt) : "-"}</td>
                      <td className="p-3">{group.originSession?.name ?? "-"}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" onClick={() => openPayment(group)}>Registrar pagamento</Button>
                      </td>
                    </tr>
                  ))}
                  {receivableGroups.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum cliente com débito em aberto.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Clientes a pagar</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3 text-left">Jogador</th>
                    <th className="p-3 text-right">Crédito</th>
                    <th className="p-3 text-right">Total fiado</th>
                    <th className="p-3 text-right">Total cash-out</th>
                  </tr>
                </thead>
                <tbody>
                  {fiadoCredits.map(balance => (
                    <tr key={`${balance.sessionId}-${balance.playerId}`} className="border-b border-border/60">
                      <td className="p-3 font-semibold">{playerMap.get(balance.playerId)?.name ?? "Jogador"}</td>
                      <td className="p-3 text-right font-bold">{money(balance.creditAmount)}</td>
                      <td className="p-3 text-right">{money(balance.totalFiado)}</td>
                      <td className="p-3 text-right">{money(balance.totalCashout)}</td>
                    </tr>
                  ))}
                  {fiadoCredits.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum cliente com crédito a receber do caixa.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => openExpense()} disabled={!selectedSession}><Plus className="w-4 h-4 mr-1" /> Adicionar despesa</Button>
          </div>
          <div className="space-y-2">
            {expenses.map(expense => (
              <Card key={expense.id} className="bg-card border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{expenseLabels[expense.category]}</Badge>
                      <span className="font-semibold">{expense.description || "Sem descrição"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{dateTime(expense.occurredAt)}</p>
                  </div>
                  <p className="font-bold">{money(expense.amount)}</p>
                  <Button size="icon" variant="ghost" onClick={() => openExpense(expense)}><Edit className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void deleteExpense(expense)}><Trash2 className="w-4 h-4" /></Button>
                </CardContent>
              </Card>
            ))}
            {expenses.length === 0 && (
              <Card className="bg-card border-border"><CardContent className="p-6 text-center text-muted-foreground">Nenhuma despesa nesta sessão.</CardContent></Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{String(i + 1).padStart(2, "0")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={year} onChange={(e) => setYear(e.target.value)} className="bg-muted border-border" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              ["Total recebido", monthlySummary.receivedTotal],
              ["Dinheiro", monthlySummary.cash],
              ["PIX", monthlySummary.pix],
              ["Crédito", monthlySummary.credit],
              ["Débito", monthlySummary.debit],
              ["Fiado gerado", monthlySummary.fiadoGenerated],
              ["Fiado recebido", monthlySummary.fiadoReceived],
              ["Total em aberto", monthlySummary.totalReceivable],
              ["Rake bruto", monthlySummary.rakeGross],
              ["Comissão dealer", monthlySummary.dealerPayment],
              ["Rake líquido", monthlySummary.houseRakeNet],
              ["Despesas", monthlySummary.expenses],
              ["Resultado líquido", monthlySummary.netResult],
              ["Sessões", monthlySummary.sessionsCount],
            ].map(([label, value]) => (
              <Card key={String(label)} className="bg-card border-border">
                <CardContent className="p-3">
                  <CalendarDays className="w-4 h-4 text-primary mb-1" />
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="text-base font-bold font-display">{typeof value === "number" && label !== "Sessões" ? money(value) : value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="text-poker-gold">Registrar pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {paymentGroup?.player?.name ?? "Cliente"} - saldo {money(paymentGroup?.totalOpen ?? 0)}
            </p>
            <div className="space-y-2">
              <Label>Valor pago</Label>
              <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as ReceivablePaymentMethod)}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="bg-muted border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancelar</Button>
            <Button onClick={registerPayment}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="text-poker-gold">{editingExpense ? "Editar despesa" : "Adicionar despesa"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={expenseCategory} onValueChange={(v) => setExpenseCategory(v as ExpenseCategory)}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(expenseLabels) as ExpenseCategory[]).map(category => (
                    <SelectItem key={category} value={category}>{expenseLabels[category]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="datetime-local" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="bg-muted border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancelar</Button>
            <Button onClick={saveExpense}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Finance;
