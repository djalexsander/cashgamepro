import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

const isTauriDesktop = () =>
  Boolean(
    import.meta.env.TAURI ||
      window.__TAURI__ ||
      window.__TAURI_INTERNALS__ ||
      window.location.protocol === "tauri:" ||
      window.location.hostname === "tauri.localhost",
  );

const cleanupDesktopServiceWorker = async () => {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }
};

const DesktopServiceWorkerCleanup = () => {
  useEffect(() => {
    cleanupDesktopServiceWorker().catch((error) => {
      console.warn("[pwa] desktop service worker cleanup failed", error);
    });
  }, []);

  return null;
};

const WebPWAUpdatePrompt = () => {
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

const PWAUpdatePrompt = () => {
  if (isTauriDesktop()) {
    return <DesktopServiceWorkerCleanup />;
  }

  return <WebPWAUpdatePrompt />;
};

export default PWAUpdatePrompt;
