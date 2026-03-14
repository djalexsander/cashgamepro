import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const PWAUpdatePrompt = () => {
  const [showBanner, setShowBanner] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for updates every 30 seconds
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 30 * 1000);
      }
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowBanner(true);
      toast({
        title: "Nova atualização disponível!",
        description: "O app será atualizado automaticamente em instantes...",
      });
      // Auto-update after 3 seconds
      const timer = setTimeout(() => {
        updateServiceWorker(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [needRefresh, updateServiceWorker]);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm font-sans normal-case tracking-normal">
          Atualizando o app...
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => updateServiceWorker(true)}
        className="font-sans normal-case tracking-normal"
      >
        Atualizar agora
      </Button>
    </div>
  );
};

export default PWAUpdatePrompt;
