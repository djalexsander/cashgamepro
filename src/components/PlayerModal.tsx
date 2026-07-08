import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db, generateId, type DBPlayer } from "@/db/database";
import { toast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";

interface PlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlayerCreated?: (player: DBPlayer) => void;
  editPlayer?: DBPlayer | null;
}

const PlayerModal = ({ open, onOpenChange, onPlayerCreated, editPlayer }: PlayerModalProps) => {
  const [name, setName] = useState(editPlayer?.name ?? "");
  const [nickname, setNickname] = useState(editPlayer?.nickname ?? "");
  const [phone, setPhone] = useState(editPlayer?.phone ?? "");
  const [pix, setPIX] = useState(editPlayer?.pix ?? "");
  const [notes, setNotes] = useState(editPlayer?.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editPlayer?.name ?? "");
    setNickname(editPlayer?.nickname ?? "");
    setPhone(editPlayer?.phone ?? "");
    setPIX(editPlayer?.pix ?? "");
    setNotes(editPlayer?.notes ?? "");
  }, [open, editPlayer]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editPlayer) {
        await db.players.update(editPlayer.id, {
          name: name.trim(),
          nickname: nickname.trim(),
          phone: phone.trim() || undefined,
          pix: pix.trim() || undefined,
          notes: notes.trim() || undefined,
          updatedAt: now,
        });
        toast({ title: "Jogador atualizado!", description: `${name.trim()} foi atualizado.` });
        onPlayerCreated?.({ ...editPlayer, name: name.trim(), nickname: nickname.trim(), phone, pix, notes, updatedAt: now });
      } else {
        const player: DBPlayer = {
          id: generateId(),
          name: name.trim(),
          nickname: nickname.trim(),
          phone: phone.trim() || undefined,
          pix: pix.trim() || undefined,
          notes: notes.trim() || undefined,
          tags: [],
          totalWinnings: 0,
          totalLosses: 0,
          totalSessions: 0,
          createdAt: now,
          updatedAt: now,
        };
        await db.players.add(player);
        toast({ title: "Jogador criado!", description: `${player.name} foi adicionado ao banco.` });
        onPlayerCreated?.(player);
      }
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar jogador:", error);
      toast({ title: "Erro", description: "Falha ao salvar jogador. Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName(""); setNickname(""); setPhone(""); setPIX(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-poker-gold">
            <UserPlus className="w-5 h-5" />
            {editPlayer ? "Editar jogador" : "Novo jogador"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="bg-muted border-border" />
          </div>
          <div className="space-y-2">
            <Label>Apelido</Label>
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Apelido na mesa" className="bg-muted border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(99) 99999-9999" className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>PIX</Label>
              <Input value={pix} onChange={(e) => setPIX(e.target.value)} placeholder="Chave PIX" className="bg-muted border-border" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas sobre o jogador..." className="bg-muted border-border" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="glow-green">
            {saving ? "Salvando..." : editPlayer ? "Atualizar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerModal;
