import { NavLink, Outlet } from "react-router-dom";
import { version } from "../../package.json";
import {
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Spade,
  UserCog,
  Users,
  Wallet,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useAdmin } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/cash-games", icon: Spade, label: "Cash Games" },
  { to: "/close-accounts", icon: Wallet, label: "Fechar" },
  { to: "/finance", icon: WalletCards, label: "Financeiro" },
  { to: "/players", icon: Users, label: "Jogadores" },
  { to: "/history", icon: History, label: "Histórico" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

const Layout = () => {
  const { signOut, user, fullName } = useAuth();
  const isAdmin = useAdmin();

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Logout realizado", description: "At? logo!" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center glow-green">
            <Spade className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg leading-tight text-poker-gold">Cash Game Pro - Gerenciador de Poker</h1>
            <p className="text-xs text-muted-foreground font-sans normal-case tracking-normal">
              Cash Game Pro v{version}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-sans normal-case tracking-normal hidden sm:block max-w-[140px] truncate">
            {fullName || user?.email || ""}
          </span>
          {isAdmin && (
            <>
              <NavLink
                to="/manage-users"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-sans normal-case tracking-normal transition-colors",
                    isActive ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <UserCog className="w-3 h-3" />
                Usu?rios
              </NavLink>
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-sans normal-case tracking-normal">
                <Shield className="w-3 h-3" />
                Admin
              </div>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" aria-label="Sair da conta">
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 overflow-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-2 py-2 z-50">
        <div className="flex justify-around items-center max-w-2xl mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[58px]",
                  isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium font-sans normal-case tracking-normal">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
