import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Spade, TrendingUp, DollarSign, Clock, Trophy } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Quick Action */}
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
              <p className="text-2xl font-bold font-display">0</p>
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
              <p className="text-2xl font-bold font-display">0</p>
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
              <p className="text-2xl font-bold font-display">R$ 0</p>
              <p className="text-xs text-muted-foreground">Rake Total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">R$ 0</p>
              <p className="text-xs text-muted-foreground">Lucro Casa</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Session */}
      <Card className="bg-poker-felt border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-poker-gold flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Sessão Ativa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Nenhuma sessão ativa no momento.</p>
          <Button
            variant="outline"
            className="mt-3 w-full border-primary/50 text-primary hover:bg-primary/10"
            onClick={() => navigate("/cash-games/new")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar Nova Sessão
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-secondary" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Nenhuma atividade registrada ainda.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
