import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import CashGames from "./pages/CashGames";
import Players from "./pages/Players";
import HistoryPage from "./pages/HistoryPage";
import NewCashGame from "./pages/NewCashGame";
import ActiveCashGame from "./pages/ActiveCashGame";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      toast({ title: "Erro inesperado", description: "Algo deu errado. Tente novamente.", variant: "destructive" });
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/cash-games" element={<CashGames />} />
              <Route path="/cash-games/new" element={<NewCashGame />} />
              <Route path="/cash-games/:id" element={<ActiveCashGame />} />
              <Route path="/players" element={<Players />} />
              <Route path="/history" element={<HistoryPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
