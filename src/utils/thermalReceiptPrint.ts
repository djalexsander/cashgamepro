import { toast } from "@/hooks/use-toast";
import {
  getReceiptPrinter,
  getReceiptWidthMm,
  isDesktop,
  printReceiptText,
} from "@/integrations/desktop/printers";

type ThermalPrintOptions = {
  html: string;
  logPrefix?: string;
};

const PRINT_FRAME_ID = "thermal-print-frame";
let printInProgress = false;

const waitForPrintLayout = (targetWindow: Window = window) =>
  new Promise<void>((resolve) => {
    targetWindow.requestAnimationFrame(() => {
      targetWindow.requestAnimationFrame(() => resolve());
    });
  });

const removeExistingPrintFrame = () => {
  document.getElementById(PRINT_FRAME_ID)?.remove();
};

const parseReceipt = (html: string) => {
  const parser = new DOMParser();
  const printDoc = parser.parseFromString(html, "text/html");
  const receipt = printDoc.querySelector(".receipt") as HTMLElement | null;

  if (!receipt) {
    throw new Error("Elemento .receipt nao encontrado no HTML de impressao.");
  }

  return receipt;
};

const normalizeText = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

const center = (value: string, cols: number) => {
  const text = value.slice(0, cols);
  const left = Math.max(0, Math.floor((cols - text.length) / 2));
  return `${" ".repeat(left)}${text}`;
};

const line = (cols: number, char = "-") => char.repeat(cols);

const row = (label: string, value: string, cols: number) => {
  const cleanLabel = label.trim();
  const cleanValue = value.trim();
  const gap = Math.max(1, cols - cleanLabel.length - cleanValue.length);
  if (gap === 1 && cleanLabel.length + cleanValue.length + gap > cols) {
    return `${cleanLabel}\n${cleanValue.padStart(cols)}`;
  }
  return `${cleanLabel}${" ".repeat(gap)}${cleanValue}`.slice(0, cols);
};

const receiptHtmlToText = (receipt: HTMLElement, widthMm: 58 | 80) => {
  const cols = widthMm === 58 ? 32 : 48;
  const lines: string[] = [];

  const title = normalizeText(receipt.querySelector("h2")?.textContent);
  if (title) {
    lines.push(center(title, cols), line(cols));
  }

  const subtitle = normalizeText(receipt.querySelector("p.center")?.textContent);
  if (subtitle) lines.push(center(subtitle, cols));

  receipt.querySelectorAll(":scope > .row").forEach((node) => {
    const parts = Array.from(node.querySelectorAll("span, strong")).map((part) => normalizeText(part.textContent));
    if (parts.length >= 2) lines.push(row(parts[0], parts.slice(1).join(" "), cols));
  });

  receipt.querySelectorAll(":scope > .sub").forEach((sub) => {
    const heading = normalizeText(sub.querySelector("b")?.textContent);
    lines.push(line(cols));
    if (heading) lines.push(heading);
    sub.querySelectorAll(".row").forEach((node) => {
      const parts = Array.from(node.querySelectorAll("span, strong")).map((part) => normalizeText(part.textContent));
      if (parts.length >= 2) lines.push(row(parts[0], parts.slice(1).join(" "), cols));
    });
  });

  const result = normalizeText(receipt.querySelector(":scope > .result")?.textContent);
  if (result) {
    lines.push(line(cols), center(result, cols), line(cols));
  }

  const footer = receipt.querySelector(":scope > .footer");
  if (footer) {
    const footerLines = Array.from(footer.querySelectorAll("p"))
      .map((node) => normalizeText(node.textContent))
      .filter(Boolean);
    if (footerLines.length > 0) {
      lines.push(line(cols));
      footerLines.forEach((text) => lines.push(center(text, cols)));
    }
  }

  return lines.filter((text, index, all) => text !== "" || all[index - 1] !== "").join("\n");
};

const createReceiptStyles = (heightMm?: number) => `
  ${heightMm ? `
  @page {
    size: 80mm ${heightMm}mm;
    margin: 0;
  }
  ` : ""}

  html,
  body {
    box-sizing: border-box !important;
    width: 80mm !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: #fff !important;
    color: #000 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
    font-size: 12px !important;
    line-height: 1.35 !important;
  }

  .receipt {
    display: block !important;
    width: 74mm !important;
    margin: 0 auto !important;
    padding: 2mm 3mm !important;
  }

  h2 {
    text-align: center !important;
    border-bottom: 1px dashed #333 !important;
    padding: 0 0 6px !important;
    margin: 0 0 6px !important;
    font-size: 15px !important;
  }

  p {
    margin: 3px 0 !important;
  }

  .center {
    text-align: center !important;
  }

  .row {
    display: grid !important;
    grid-template-columns: 1fr auto !important;
    column-gap: 8px !important;
    padding: 2px 0 !important;
  }

  .row span:last-child,
  .row strong {
    text-align: right !important;
    white-space: nowrap !important;
  }

  .result {
    font-size: 1.15em !important;
    font-weight: bold !important;
    text-align: center !important;
    margin: 10px 0 !important;
    padding: 6px 0 !important;
    border-top: 1px dashed #999 !important;
    border-bottom: 1px dashed #999 !important;
  }

  .footer {
    text-align: center !important;
    margin-top: 10px !important;
    font-size: 0.82em !important;
    border-top: 1px dashed #333 !important;
    padding-top: 6px !important;
  }

  .sub {
    border-top: 1px dashed #999 !important;
    margin-top: 6px !important;
    padding-top: 4px !important;
  }
`;

const printWithBrowserPreview = async (receipt: HTMLElement) => {
  removeExistingPrintFrame();

  const iframe = document.createElement("iframe");
  iframe.id = PRINT_FRAME_ID;
  iframe.title = "Recibo termico";
  iframe.style.position = "fixed";
  iframe.style.left = "0";
  iframe.style.top = "0";
  iframe.style.width = "80mm";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-1";
  document.body.appendChild(iframe);

  const printWindow = iframe.contentWindow;
  const printDocument = iframe.contentDocument;
  if (!printWindow || !printDocument) throw new Error("Nao foi possivel criar a area de impressao.");

  const write = (heightMm?: number) => {
    printDocument.open();
    printDocument.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=80mm, initial-scale=1" />
          <title></title>
          <style>${createReceiptStyles(heightMm)}</style>
        </head>
        <body>${receipt.outerHTML}</body>
      </html>
    `);
    printDocument.close();
  };

  write();
  await waitForPrintLayout(printWindow);
  const renderedReceipt = printDocument.querySelector(".receipt") as HTMLElement | null;
  const heightPx = Math.ceil(Math.max(renderedReceipt?.getBoundingClientRect().height ?? 0, renderedReceipt?.scrollHeight ?? 0));
  const heightMm = Math.max(40, Math.ceil((heightPx * 25.4) / 96) + 6);
  write(heightMm);
  await waitForPrintLayout(printWindow);

  const cleanup = () => {
    printWindow.removeEventListener("afterprint", cleanup);
    iframe.remove();
  };
  printWindow.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 15000);
  printWindow.focus();
  printWindow.print();
};

export const printThermalReceipt = async ({ html, logPrefix = "[thermal-print]" }: ThermalPrintOptions) => {
  if (printInProgress) {
    throw new Error("Ja existe uma impressao em andamento. Aguarde concluir para tentar novamente.");
  }

  printInProgress = true;
  console.log(`${logPrefix} start`);

  try {
    const receipt = parseReceipt(html);

    if (isDesktop()) {
      const printer = getReceiptPrinter();
      if (!printer) {
        throw new Error("Nenhuma impressora configurada. Abra Configuracoes > Impressao e selecione a impressora padrao.");
      }

      const widthMm = getReceiptWidthMm();
      const text = receiptHtmlToText(receipt, widthMm);
      const message = await printReceiptText(text, printer, { widthMm, cut: true });
      toast({ title: "Recibo enviado", description: message });
      return;
    }

    toast({
      title: "Impressao via navegador",
      description: "No app desktop, configure uma impressora para impressao direta.",
    });
    await printWithBrowserPreview(receipt);
  } catch (error) {
    console.error(`${logPrefix} error`, error);
    throw error;
  } finally {
    printInProgress = false;
  }
};
