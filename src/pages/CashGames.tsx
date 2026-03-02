import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus, Spade } from "lucide-react";

const CashGames = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-poker-gold">Cash Games</h2>
      </div>

      <Button
        onClick={() => navigate("/cash-games/new")}
        className="w-full h-14 text-lg font-display glow-green"
        size="lg"
      >
        <Plus className="w-6 h-6 mr-2" />
        Novo Cash Game
      </Button>

      <Card className="bg-card border-border">
        <CardContent className="p-8 text-center">
          <Spade className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum cash game criado ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">Clique acima para iniciar sua primeira sessão.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CashGames;
