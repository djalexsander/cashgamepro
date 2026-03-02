import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Spade } from "lucide-react";
import { db, generateId, type GameType } from "@/db/database";
import { toast } from "@/hooks/use-toast";

const NewCashGame = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [gameType, setGameType] = useState<GameType | "">("");
  const [blinds, setBlinds] = useState("");
  const [chipValue, setChipValue] = useState("");
  const [rakePercent, setRakePercent] = useState("");
  const [rakeCap, setRakeCap] = useState("");
  const [notes, setNotes] = useState("");
  const [dealersChoiceGames, setDealersChoiceGames] = useState("");
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    // Validation
    if (!name.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o nome do Cash Game.", variant: "destructive" });
      return;
    }
    if (!gameType) {
      toast({ title: "Campo obrigatório", description: "Selecione o tipo de jogo.", variant: "destructive" });
      return;
    }
    if (!blinds.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe os blinds.", variant: "destructive" });
      return;
    }
    if (!chipValue || parseFloat(chipValue) <= 0) {
      toast({ title: "Campo obrigatório", description: "Informe o valor da ficha.", variant: "destructive" });
      return;
    }
    if (!rakePercent || parseFloat(rakePercent) < 0) {
      toast({ title: "Campo obrigatório", description: "Informe o percentual de rake.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const session = {
        id: generateId(),
        name: name.trim(),
        gameType: gameType as GameType,
        blinds: blinds.trim(),
        chipValue: parseFloat(chipValue),
        rakePercent: parseFloat(rakePercent),
        rakeCap: rakeCap ? parseFloat(rakeCap) : 0,
        notes: notes.trim() || undefined,
        dealersChoiceGames: gameType === "dealers_choice" ? dealersChoiceGames.trim() || undefined : undefined,
        status: "active" as const,
        startedAt: new Date().toISOString(),
      };

      await db.cashSessions.add(session);
      toast({ title: "Cash Game iniciado! ♠", description: `${session.name} está ativo.` });
      navigate(`/cash-games/${session.id}`);
    } catch (error) {
      console.error("Erro ao criar sessão:", error);
      toast({ title: "Erro", description: "Falha ao iniciar o Cash Game. Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-2xl text-poker-gold">Novo Cash Game</h2>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Spade className="w-5 h-5 text-primary" />
            Configuração da Sessão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Cash Game *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cash Quinta 5/5" className="bg-muted border-border" />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Jogo *</Label>
            <Select value={gameType} onValueChange={(v) => setGameType(v as GameType)}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="texas">Texas Hold'em</SelectItem>
                <SelectItem value="omaha">Omaha</SelectItem>
                <SelectItem value="omaha_hilo">Omaha Hi-Lo</SelectItem>
                <SelectItem value="5card">5 Card</SelectItem>
                <SelectItem value="dealers_choice">Dealer's Choice</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {gameType === "dealers_choice" && (
            <div className="space-y-2">
              <Label>Jogos Permitidos / Observação de Rodízio</Label>
              <Textarea
                value={dealersChoiceGames}
                onChange={(e) => setDealersChoiceGames(e.target.value)}
                placeholder="Ex: Texas, Omaha, 5 Card Draw, Short Deck..."
                className="bg-muted border-border"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Blinds *</Label>
              <Input value={blinds} onChange={(e) => setBlinds(e.target.value)} placeholder="Ex: 1/2" className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Valor da Ficha (R$) *</Label>
              <Input type="number" value={chipValue} onChange={(e) => setChipValue(e.target.value)} placeholder="1.00" className="bg-muted border-border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Rake (%) *</Label>
              <Input type="number" value={rakePercent} onChange={(e) => setRakePercent(e.target.value)} placeholder="5" className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Cap de Rake (R$)</Label>
              <Input type="number" value={rakeCap} onChange={(e) => setRakeCap(e.target.value)} placeholder="20" className="bg-muted border-border" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações sobre a sessão..." className="bg-muted border-border" />
          </div>

          <Button onClick={handleStart} disabled={saving} className="w-full h-14 text-lg font-display glow-green mt-4" size="lg">
            <Spade className="w-6 h-6 mr-2" />
            {saving ? "Iniciando..." : "Iniciar Cash Game"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewCashGame;
