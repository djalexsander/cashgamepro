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
import CloseAccounts from "./pages/CloseAccounts";
import ManageUsers from "./pages/ManageUsers";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import HomePokerGuide from "./pages/HomePokerGuide";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

const queryClient = new QueryClient();

const AppContent = () => {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("[app] unhandled rejection", {
        reason: event.reason,
        message: event.reason instanceof Error ? event.reason.message : String(event.reason),
        stack: event.reason instanceof Error ? event.reason.stack : undefined,
      });
      toast({
        title: "Falha inesperada no app",
        description:
          event.reason instanceof Error
            ? event.reason.message
            : "Veja o console para o detalhe técnico do erro.",
        variant: "destructive",
      });
      event.preventDefault();
    };
    const errorHandler = (event: ErrorEvent) => {
      console.error("[app] unhandled error", {
        error: event.error,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
      toast({
        title: "Falha inesperada no app",
        description:
          event.error instanceof Error
            ? event.error.message
            : "Veja o console para o detalhe técnico do erro.",
        variant: "destructive",
      });
    };
    window.addEventListener("unhandledrejection", handler);
    window.addEventListener("error", errorHandler);
    return () => {
      window.removeEventListener("unhandledrejection", handler);
      window.removeEventListener("error", errorHandler);
    };
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/guides/home-poker-management" element={<HomePokerGuide />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Index />} />
        <Route path="/cash-games" element={<CashGames />} />
        <Route path="/cash-games/new" element={<NewCashGame />} />
        <Route path="/cash-games/:id" element={<ActiveCashGame />} />
        <Route path="/close-accounts" element={<CloseAccounts />} />
        <Route path="/players" element={<Players />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/manage-users" element={<ManageUsers />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

import PWAUpdatePrompt from "./components/PWAUpdatePrompt";

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAUpdatePrompt />
          <BrowserRouter>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
