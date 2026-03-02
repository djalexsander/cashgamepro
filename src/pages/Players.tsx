import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Search, Trash2, Edit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { db, type DBPlayer } from "@/db/database";
import PlayerModal from "@/components/PlayerModal";
import { toast } from "@/hooks/use-toast";

const Players = () => {
  const [players, setPlayers] = useState<DBPlayer[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editPlayer, setEditPlayer] = useState<DBPlayer | null>(null);

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

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.nickname.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
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
            <Card key={player.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{player.name}</p>
                  {player.nickname && <p className="text-sm text-muted-foreground truncate">"{player.nickname}"</p>}
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{player.totalSessions} sessões</span>
                    <span className={player.totalWinnings - player.totalLosses >= 0 ? "text-primary" : "text-destructive"}>
                      R$ {(player.totalWinnings - player.totalLosses).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditPlayer(player); setModalOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(player)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlayerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onPlayerCreated={() => loadPlayers()}
        editPlayer={editPlayer}
      />
    </div>
  );
};

export default Players;
