export interface PrinterInfo {
  name: string;
  status: string | null;
  is_default: boolean;
  is_thermal: boolean;
}

const CONFIG_KEY = "cashgamepro.desktop.print.v1";

type PrintConfig = {
  receiptPrinter?: string | null;
  receiptWidthMm?: 58 | 80;
};

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let cachedInvoke: TauriInvoke | null = null;

export const isDesktop = () => "__TAURI_INTERNALS__" in window;

const getInvoke = async (): Promise<TauriInvoke | null> => {
  if (!isDesktop()) return null;
  if (cachedInvoke) return cachedInvoke;

  try {
    const mod = (await import("@tauri-apps/api/core")) as { invoke: TauriInvoke };
    cachedInvoke = mod.invoke;
    return cachedInvoke;
  } catch {
    return null;
  }
};

const readConfig = (): PrintConfig => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PrintConfig;
  } catch {
    return {};
  }
};

const writeConfig = (config: PrintConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const getReceiptPrinter = () => readConfig().receiptPrinter ?? null;

export const setReceiptPrinter = (name: string | null) => {
  writeConfig({ ...readConfig(), receiptPrinter: name });
};

export const getReceiptWidthMm = (): 58 | 80 => (readConfig().receiptWidthMm === 58 ? 58 : 80);

export const setReceiptWidthMm = (widthMm: 58 | 80) => {
  writeConfig({ ...readConfig(), receiptWidthMm: widthMm });
};

export const listPrinters = async (): Promise<PrinterInfo[]> => {
  const invoke = await getInvoke();
  if (!invoke) return [];

  const printers = await invoke<PrinterInfo[]>("list_printers");
  return printers.map((printer) => ({
    ...printer,
    is_thermal: Boolean(printer.is_thermal),
    is_default: Boolean(printer.is_default),
  }));
};

export const printReceiptText = async (
  text: string,
  printerName: string,
  options: { widthMm?: 58 | 80; cut?: boolean } = {},
) => {
  const invoke = await getInvoke();
  if (!invoke) {
    throw new Error("Impressão direta só está disponível no app desktop.");
  }

  return invoke<string>("print_receipt_text", {
    text,
    printerName,
    widthMm: options.widthMm ?? 80,
    cut: options.cut ?? true,
  });
};


