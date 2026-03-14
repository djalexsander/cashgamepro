import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers, AppUser } from "@/hooks/useUsers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Shield, ShieldOff, UserX, UserCheck, Users, Trash2, CalendarIcon, Ban, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const ManageUsers = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { users, loading, fetchUsers, createUser, updateRole, toggleActive, updateSubscription, deleteUser } = useUsers();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("user");
  const [creating, setCreating] = useState(false);

  // Subscription dialog state
  const [subDialogUser, setSubDialogUser] = useState<AppUser | null>(null);
  const [subDate, setSubDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  if (authLoading) return null;
  if (!isAdmin) {
    toast({ title: "Acesso restrito ao administrador", variant: "destructive" });
    return <Navigate to="/" replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await createUser(email, password, fullName, role);
      toast({ title: "Usuário criado com sucesso!" });
      setOpen(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("user");
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (user: AppUser, newRole: string) => {
    try {
      await updateRole(user.id, newRole);
      toast({ title: `Função alterada para ${newRole}` });
    } catch (err: any) {
      toast({ title: "Erro ao alterar função", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    try {
      await toggleActive(user.id, !user.active);
      toast({ title: user.active ? "Usuário desativado" : "Usuário reativado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (user: AppUser) => {
    try {
      await deleteUser(user.id);
      toast({ title: "Usuário excluído com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const openSubDialog = (user: AppUser) => {
    setSubDialogUser(user);
    setSubDate(user.subscription_due_date ? new Date(user.subscription_due_date + "T12:00:00") : undefined);
  };

  const handleSaveSubscription = async () => {
    if (!subDialogUser) return;
    try {
      const dateStr = subDate ? format(subDate, "yyyy-MM-dd") : null;
      await updateSubscription(subDialogUser.id, dateStr, subDate ? "active" : "active");
      toast({ title: "Vencimento atualizado!" });
      setSubDialogUser(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleBlockSubscription = async (user: AppUser) => {
    try {
      await updateSubscription(user.id, user.subscription_due_date, "blocked");
      toast({ title: "Usuário bloqueado por inadimplência" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleUnblockSubscription = async (user: AppUser) => {
    try {
      await updateSubscription(user.id, user.subscription_due_date, "active");
      await toggleActive(user.id, true);
      toast({ title: "Usuário desbloqueado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const getSubscriptionBadge = (user: AppUser) => {
    if (user.subscription_status === "blocked") {
      return <Badge variant="destructive" className="font-sans normal-case tracking-normal">Bloqueado</Badge>;
    }
    if (!user.subscription_due_date) {
      return <Badge variant="secondary" className="font-sans normal-case tracking-normal">Sem vencimento</Badge>;
    }
    const due = new Date(user.subscription_due_date + "T23:59:59");
    const today = new Date();
    const daysLeft = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return <Badge variant="destructive" className="font-sans normal-case tracking-normal">Vencido</Badge>;
    }
    if (daysLeft <= 5) {
      return <Badge className="bg-yellow-600 text-white font-sans normal-case tracking-normal">Vence em {daysLeft}d</Badge>;
    }
    return <Badge variant="outline" className="text-primary border-primary font-sans normal-case tracking-normal">Em dia</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-xl text-poker-gold">Gerenciar Usuários</h2>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-sans normal-case tracking-normal">Criar Novo Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={creating} />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={creating} />
              <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} disabled={creating} />
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Usuário"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Subscription dialog */}
      <Dialog open={!!subDialogUser} onOpenChange={(o) => !o && setSubDialogUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-sans normal-case tracking-normal">
              Vencimento - {subDialogUser?.full_name || subDialogUser?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-sans normal-case tracking-normal">
              Defina a data de vencimento da mensalidade. Após essa data, o usuário será bloqueado automaticamente.
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal font-sans normal-case tracking-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {subDate ? format(subDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={subDate} onSelect={setSubDate} locale={ptBR} />
              </PopoverContent>
            </Popover>
            <div className="flex gap-2">
              <Button onClick={handleSaveSubscription} className="flex-1">
                Salvar
              </Button>
              {subDate && (
                <Button variant="outline" onClick={() => setSubDate(undefined)}>
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 font-sans normal-case tracking-normal">
              Nenhum usuário encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-sans normal-case tracking-normal">Nome</TableHead>
                    <TableHead className="font-sans normal-case tracking-normal">Email</TableHead>
                    <TableHead className="font-sans normal-case tracking-normal">Função</TableHead>
                    <TableHead className="font-sans normal-case tracking-normal">Status</TableHead>
                    <TableHead className="font-sans normal-case tracking-normal">Mensalidade</TableHead>
                    <TableHead className="font-sans normal-case tracking-normal">Vencimento</TableHead>
                    <TableHead className="font-sans normal-case tracking-normal text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="font-sans normal-case tracking-normal">
                          {u.role === "admin" ? "Admin" : "Usuário"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.active ? "outline" : "destructive"}
                          className="font-sans normal-case tracking-normal"
                        >
                          {u.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getSubscriptionBadge(u)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {u.subscription_due_date
                          ? format(new Date(u.subscription_due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Set due date */}
                          <Button variant="ghost" size="icon" title="Definir vencimento" onClick={() => openSubDialog(u)}>
                            <CalendarIcon className="w-4 h-4 text-primary" />
                          </Button>

                          {/* Block/Unblock subscription */}
                          {u.subscription_status === "blocked" ? (
                            <Button variant="ghost" size="icon" title="Desbloquear" onClick={() => handleUnblockSubscription(u)}>
                              <CheckCircle className="w-4 h-4 text-primary" />
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Bloquear por inadimplência">
                                  <Ban className="w-4 h-4 text-yellow-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-sans normal-case tracking-normal">Bloquear Usuário</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Bloquear <strong>{u.email}</strong> por inadimplência? O usuário receberá uma notificação para regularizar.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleBlockSubscription(u)}>
                                    Bloquear
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {/* Toggle role */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title={u.role === "admin" ? "Rebaixar" : "Promover"}>
                                {u.role === "admin" ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-sans normal-case tracking-normal">Alterar Função</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.role === "admin"
                                    ? `Rebaixar ${u.email} para usuário comum?`
                                    : `Promover ${u.email} para administrador?`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRoleChange(u, u.role === "admin" ? "user" : "admin")}>
                                  Confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          {/* Toggle active */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title={u.active ? "Desativar" : "Reativar"}>
                                {u.active ? <UserX className="w-4 h-4 text-destructive" /> : <UserCheck className="w-4 h-4 text-primary" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-sans normal-case tracking-normal">
                                  {u.active ? "Desativar Usuário" : "Reativar Usuário"}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.active
                                    ? `${u.email} não poderá mais acessar o sistema.`
                                    : `${u.email} terá acesso ao sistema novamente.`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleToggleActive(u)}>
                                  Confirmar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          {/* Delete user */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Excluir usuário">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-sans normal-case tracking-normal">
                                  Excluir Usuário
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir permanentemente <strong>{u.email}</strong>? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(u)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageUsers;
