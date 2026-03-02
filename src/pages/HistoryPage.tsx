import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";

const HistoryPage = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl text-poker-gold">Histórico</h2>

      <Card className="bg-card border-border">
        <CardContent className="p-8 text-center">
          <History className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum histórico disponível.</p>
          <p className="text-sm text-muted-foreground mt-1">Os cash games finalizados aparecerão aqui.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoryPage;
