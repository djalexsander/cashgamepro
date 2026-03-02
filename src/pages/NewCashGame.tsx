import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Spade } from "lucide-react";

const NewCashGame = () => {
  const navigate = useNavigate();

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
            <Label>Nome do Cash Game</Label>
            <Input placeholder="Ex: Cash Quinta 5/5" className="bg-muted border-border" />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Jogo</Label>
            <Select>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="texas">Texas Hold'em</SelectItem>
                <SelectItem value="omaha">Omaha</SelectItem>
                <SelectItem value="omaha_hilo">Omaha Hi-Lo</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Blinds</Label>
              <Input placeholder="Ex: 1/2" className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Valor da Ficha (R$)</Label>
              <Input type="number" placeholder="1.00" className="bg-muted border-border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Rake (%)</Label>
              <Input type="number" placeholder="5" className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Cap de Rake (R$)</Label>
              <Input type="number" placeholder="20" className="bg-muted border-border" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea placeholder="Anotações sobre a sessão..." className="bg-muted border-border" />
          </div>

          <Button className="w-full h-14 text-lg font-display glow-green mt-4" size="lg">
            <Spade className="w-6 h-6 mr-2" />
            Iniciar Cash Game
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewCashGame;
