import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Spade, Users, History, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/cash-games", icon: Spade, label: "Cash Games" },
  { to: "/close-accounts", icon: Wallet, label: "Fechar" },
  { to: "/players", icon: Users, label: "Jogadores" },
  { to: "/history", icon: History, label: "Histórico" },
];

const Layout = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center glow-green">
            <Spade className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg leading-tight text-poker-gold">Poker Manager</h1>
            <p className="text-xs text-muted-foreground font-sans normal-case tracking-normal">Cash Game Pro</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 pb-24 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-2 py-2 z-50">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[64px]",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
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
