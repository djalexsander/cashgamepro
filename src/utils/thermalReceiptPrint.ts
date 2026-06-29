import { toast } from "@/hooks/use-toast";

type ThermalPrintOptions = {
  html: string;
  logPrefix?: string;
};

const PRINT_FRAME_ID = "thermal-print-frame";
const MIN_RECEIPT_HEIGHT_MM = 40;
const PRINT_CLEANUP_TIMEOUT_MS = 15000;

let hasShownHeaderFooterHint = false;
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
  const receipt = printDoc.querySelector(".receipt");

  if (!receipt) {
    throw new Error("Elemento .receipt nao encontrado no HTML de impressao.");
  }

  return receipt.outerHTML;
};

const createPrintFrame = () => {
  removeExistingPrintFrame();

  const iframe = document.createElement("iframe");
  iframe.id = PRINT_FRAME_ID;
  iframe.title = "Recibo termico";
  iframe.setAttribute("aria-hidden", "true");
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

  if (!iframe.contentWindow || !iframe.contentDocument) {
    iframe.remove();
    throw new Error("Nao foi possivel criar a area isolada de impressao.");
  }

  return iframe;
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
    min-width: 80mm !important;
    max-width: 80mm !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: #fff !important;
    color: #000 !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
    font-size: 12px !important;
    line-height: 1.35 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  ${heightMm ? `
  html,
  body {
    height: ${heightMm}mm !important;
    max-height: ${heightMm}mm !important;
  }
  ` : ""}

  *,
  *::before,
  *::after {
    box-sizing: border-box !important;
  }

  .receipt {
    display: block !important;
    position: static !important;
    width: 74mm !important;
    max-width: 74mm !important;
    margin: 0 auto !important;
    padding: 2mm 3mm !important;
    overflow: hidden !important;
    transform: none !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
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

  .row span:first-child {
    overflow-wrap: anywhere !important;
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
    color: #333 !important;
    border-top: 1px dashed #333 !important;
    padding-top: 6px !important;
  }

  .footer p:last-child {
    margin-bottom: 0 !important;
  }

  .sub {
    border-top: 1px dashed #999 !important;
    margin-top: 6px !important;
    padding-top: 4px !important;
  }

  .positive {
    color: #047857 !important;
  }

  .negative {
    color: #dc2626 !important;
  }
`;

const writeFrameDocument = (printDocument: Document, receiptHtml: string, heightMm?: number) => {
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
      <body>${receiptHtml}</body>
    </html>
  `);
  printDocument.close();
};

const getReceiptHeightMm = (receipt: HTMLElement) => {
  const rect = receipt.getBoundingClientRect();
  const heightPx = Math.ceil(Math.max(rect.height, receipt.scrollHeight));
  return Math.max(MIN_RECEIPT_HEIGHT_MM, Math.ceil((heightPx * 25.4) / 96) + 6);
};

export const printThermalReceipt = async ({ html, logPrefix = "[thermal-print]" }: ThermalPrintOptions) => {
  if (printInProgress) {
    throw new Error("Ja existe uma impressao em andamento. Aguarde concluir para tentar novamente.");
  }

  printInProgress = true;
  console.log(`${logPrefix} start`);

  let iframe: HTMLIFrameElement | null = null;
  let cleaned = false;
  let cleanupTimer: number | undefined;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    printInProgress = false;
    if (cleanupTimer) window.clearTimeout(cleanupTimer);
    iframe?.contentWindow?.removeEventListener("afterprint", cleanup);
    iframe?.remove();
    console.log(`${logPrefix} cleanup`);
  };

  try {
    const receiptHtml = parseReceipt(html);
    iframe = createPrintFrame();
    const printWindow = iframe.contentWindow;
    const printDocument = iframe.contentDocument;

    if (!printWindow || !printDocument) {
      throw new Error("Nao foi possivel acessar a janela de impressao.");
    }

    writeFrameDocument(printDocument, receiptHtml);
    await waitForPrintLayout(printWindow);
    await printDocument.fonts?.ready;

    const receipt = printDocument.querySelector(".receipt") as HTMLElement | null;
    if (!receipt) {
      throw new Error("Elemento .receipt nao encontrado na area de impressao.");
    }

    const heightMm = getReceiptHeightMm(receipt);
    console.log(`${logPrefix} receipt height mm`, heightMm);

    writeFrameDocument(printDocument, receiptHtml, heightMm);
    await waitForPrintLayout(printWindow);
    await printDocument.fonts?.ready;

    if (!hasShownHeaderFooterHint) {
      hasShownHeaderFooterHint = true;
      toast({
        title: "Impressao POS-80",
        description: "Em Mais configuracoes, desative Cabecalhos e rodapes.",
      });
    }

    printWindow.addEventListener("afterprint", cleanup, { once: true });
    cleanupTimer = window.setTimeout(cleanup, PRINT_CLEANUP_TIMEOUT_MS);
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    console.error(`${logPrefix} error`, error);
    cleanup();
    throw error;
  }
};
