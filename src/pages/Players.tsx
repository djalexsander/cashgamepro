import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const Players = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl text-poker-gold">Jogadores</h2>
        <Button size="sm" className="font-display">
          <Plus className="w-4 h-4 mr-1" />
          Novo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar jogador..."
          className="pl-10 bg-card border-border"
        />
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-8 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum jogador cadastrado.</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione jogadores ao seu banco de dados.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Players;
