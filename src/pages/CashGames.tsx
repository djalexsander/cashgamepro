import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus, Spade, Play, Clock, Trash2 } from "lucide-react";
import { db, type DBCashSession } from "@/db/database";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getHiddenSessionIds, hideSessionIds } from "@/utils/visualHistory";

const CashGames = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<DBCashSession[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    db.cashSessions.orderBy("startedAt").reverse().toArray()
      .then(data => {
        const hiddenSessionIds = getHiddenSessionIds();
        setSessions((data ?? []).filter(session => !hiddenSessionIds.has(session.id)));
      })
      .catch(err => {
        console.error("Erro ao carregar sessões:", err);
        setSessions([]);
      });
  }, []);

  const activeSessions = sessions.filter(s => s.status === "active");
  const closedSessions = sessions.filter(s => s.status === "closed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-poker-gold">Cash Games</h2>
      </div>

      <Button onClick={() => navigate("/cash-games/new")} className="w-full h-14 text-lg font-display glow-green" size="lg">
        <Plus className="w-6 h-6 mr-2" />
        Novo Cash Game
      </Button>

      {activeSessions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm text-poker-gold uppercase tracking-wider">Ativas</h3>
          {activeSessions.map(s => (
            <Card key={s.id} className="bg-poker-felt border-primary/30 cursor-pointer" onClick={() => navigate(`/cash-games/${s.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.blinds} • {s.gameType.replace("_", " ")}</p>
                </div>
                <div className="flex items-center gap-2 text-primary">
                  <Play className="w-4 h-4" />
                  <span className="text-xs">ATIVA</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {closedSessions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm text-muted-foreground uppercase tracking-wider">Encerradas</h3>
          {closedSessions.map(s => (
            <Card key={s.id} className="bg-card border-border opacity-70">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/cash-games/${s.id}`)}>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.blinds} • {new Date(s.startedAt).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(s.id!); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sessions.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <Spade className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum cash game criado ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">Clique acima para iniciar sua primeira sessão.</p>
          </CardContent>
        </Card>
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sessão encerrada?</AlertDialogTitle>
            <AlertDialogDescription>A sessão será removida apenas da lista visual. O Financeiro permanece intacto.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              try {
                const sid = deleteTarget!;
                hideSessionIds([sid]);
                setSessions(prev => prev.filter(s => s.id !== sid));
                toast({ title: "Sessão ocultada da lista" });
              } catch (e) { console.error(e); toast({ title: "Erro ao excluir", variant: "destructive" }); }
              setDeleteTarget(null);
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CashGames;
