import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  getReceiptPrinter,
  getReceiptWidthMm,
  isDesktop,
  listPrinters,
  setReceiptPrinter,
  setReceiptWidthMm,
  type PrinterInfo,
} from "@/integrations/desktop/printers";
import { Printer, RefreshCw, Save, Settings as SettingsIcon } from "lucide-react";

const Settings = () => {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState(getReceiptPrinter() ?? "");
  const [widthMm, setWidthMm] = useState<58 | 80>(getReceiptWidthMm());
  const [loading, setLoading] = useState(false);

  const selectedInfo = useMemo(
    () => printers.find((printer) => printer.name === selectedPrinter),
    [printers, selectedPrinter],
  );

  const loadPrinters = async () => {
    setLoading(true);
    try {
      const list = await listPrinters();
      setPrinters(list);

      const saved = getReceiptPrinter();
      if (!saved && list.length > 0) {
        const preferred = list.find((printer) => printer.is_thermal) ?? list.find((printer) => printer.is_default) ?? list[0];
        setSelectedPrinter(preferred.name);
      }
    } catch (error) {
      console.error("[settings] printers error", error);
      toast({
        title: "Falha ao listar impressoras",
        description: error instanceof Error ? error.message : "Nao foi possivel consultar o sistema operacional.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPrinters();
  }, []);

  const handleSave = () => {
    if (!selectedPrinter) {
      toast({
        title: "Selecione uma impressora",
        description: "Escolha a impressora que recebera os recibos do Cash Game Pro.",
        variant: "destructive",
      });
      return;
    }

    setReceiptPrinter(selectedPrinter);
    setReceiptWidthMm(widthMm);
    toast({
      title: "Impressora salva",
      description: `Recibos serao enviados diretamente para "${selectedPrinter}".`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl text-poker-gold">Configuracoes</h2>
          <p className="text-sm text-muted-foreground">Preferencias locais deste computador.</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Printer className="w-5 h-5 text-primary" />
                Impressao
              </CardTitle>
              <CardDescription>
                Configure a impressora termica que recebera os recibos sem abrir preview.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadPrinters()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!isDesktop() && (
            <div className="rounded-md border border-secondary/40 bg-secondary/10 px-3 py-2 text-sm text-secondary">
              Impressao direta esta disponivel no aplicativo desktop. No navegador, o sistema usa o dialogo padrao.
            </div>
          )}

          <div className="grid gap-2">
            <Label>Impressora padrao do app</Label>
            <Select value={selectedPrinter} onValueChange={setSelectedPrinter} disabled={loading || printers.length === 0}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder={loading ? "Carregando impressoras..." : "Selecione uma impressora"} />
              </SelectTrigger>
              <SelectContent>
                {printers.map((printer) => (
                  <SelectItem key={printer.name} value={printer.name}>
                    {printer.name}
                    {printer.is_thermal ? " - termica" : printer.is_default ? " - padrao do Windows" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {printers.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">Nenhuma impressora detectada neste computador.</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Largura do recibo</Label>
            <Select value={String(widthMm)} onValueChange={(value) => setWidthMm(value === "58" ? 58 : 80)}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="80">80mm - POS-80</SelectItem>
                <SelectItem value="58">58mm - POS-58</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedInfo && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm">
              <span className="font-medium">{selectedInfo.name}</span>
              {selectedInfo.is_thermal && <Badge>Termica</Badge>}
              {selectedInfo.is_default && <Badge variant="secondary">Padrao do SO</Badge>}
              {selectedInfo.status && <span className="text-muted-foreground">{selectedInfo.status}</span>}
            </div>
          )}

          <Button type="button" onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            Salvar impressora
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
