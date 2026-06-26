import { toast } from "@/hooks/use-toast";

type ThermalPrintOptions = {
  html: string;
  logPrefix?: string;
};

const PRINT_ROOT_ID = "thermal-print-root";
const PRINTING_CLASS = "thermal-printing";
let hasShownHeaderFooterHint = false;

const waitForPrintLayout = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

const removeExistingPrintStyles = () => {
  document.querySelectorAll("style[data-thermal-print-style]").forEach((node) => node.remove());
};

const removeExistingPrintNodes = () => {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  removeExistingPrintStyles();
};

const createPrintStyle = (heightMm?: number) => {
  const style = document.createElement("style");
  style.setAttribute("data-thermal-print-style", "true");
  style.textContent = `
    #${PRINT_ROOT_ID} {
      box-sizing: border-box !important;
      background: #fff !important;
      color: #000 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      font-size: 12px !important;
      line-height: 1.35 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    #${PRINT_ROOT_ID} *,
    #${PRINT_ROOT_ID} *::before,
    #${PRINT_ROOT_ID} *::after {
      box-sizing: border-box !important;
    }

    #${PRINT_ROOT_ID} .receipt {
      display: block !important;
      position: static !important;
      width: 74mm !important;
      margin: 0 auto !important;
      margin-top: 0 !important;
      padding: 2mm 3mm !important;
      transform: none !important;
    }

    #${PRINT_ROOT_ID} h2 {
      text-align: center !important;
      border-bottom: 1px dashed #333 !important;
      padding: 0 0 6px !important;
      margin: 0 0 6px !important;
      font-size: 15px !important;
    }

    #${PRINT_ROOT_ID} p {
      margin: 3px 0 !important;
    }

    #${PRINT_ROOT_ID} .center {
      text-align: center !important;
    }

    #${PRINT_ROOT_ID} .row {
      display: grid !important;
      grid-template-columns: 1fr auto !important;
      column-gap: 8px !important;
      padding: 2px 0 !important;
    }

    #${PRINT_ROOT_ID} .row span:first-child {
      overflow-wrap: anywhere !important;
    }

    #${PRINT_ROOT_ID} .row span:last-child,
    #${PRINT_ROOT_ID} .row strong {
      text-align: right !important;
      white-space: nowrap !important;
    }

    #${PRINT_ROOT_ID} .result {
      font-size: 1.15em !important;
      font-weight: bold !important;
      text-align: center !important;
      margin: 10px 0 !important;
      padding: 6px 0 !important;
      border-top: 1px dashed #999 !important;
      border-bottom: 1px dashed #999 !important;
    }

    #${PRINT_ROOT_ID} .footer {
      text-align: center !important;
      margin-top: 10px !important;
      font-size: 0.82em !important;
      color: #333 !important;
      border-top: 1px dashed #333 !important;
      padding-top: 6px !important;
    }

    #${PRINT_ROOT_ID} .footer p:last-child {
      margin-bottom: 0 !important;
    }

    #${PRINT_ROOT_ID} .sub {
      border-top: 1px dashed #999 !important;
      margin-top: 6px !important;
      padding-top: 4px !important;
    }

    #${PRINT_ROOT_ID} .positive {
      color: #047857 !important;
    }

    #${PRINT_ROOT_ID} .negative {
      color: #dc2626 !important;
    }

    @media screen {
      #${PRINT_ROOT_ID} {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        bottom: auto !important;
        width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transform: none !important;
        z-index: -1 !important;
      }
    }

    @media print {
      ${
        heightMm
          ? `@page {
        size: 80mm ${heightMm}mm;
        margin: 0 !important;
      }`
          : ""
      }

      html.${PRINTING_CLASS},
      html.${PRINTING_CLASS} body {
        margin: 0 !important;
        padding: 0 !important;
        width: 80mm !important;
        min-height: 0 !important;
        height: auto !important;
        overflow: hidden !important;
      }

      html.${PRINTING_CLASS} body > *:not(#${PRINT_ROOT_ID}) {
        display: none !important;
      }

      #${PRINT_ROOT_ID},
      #${PRINT_ROOT_ID} * {
        transform: none !important;
      }

      #${PRINT_ROOT_ID} {
        display: block !important;
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        bottom: auto !important;
        width: 80mm !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        opacity: 1 !important;
        visibility: visible !important;
      }

      #${PRINT_ROOT_ID} .receipt {
        position: relative !important;
        top: 0 !important;
        width: 74mm !important;
        margin: 0 auto !important;
        padding: 2mm 3mm !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
    }
  `;
  return style;
};

const appendPrintStyle = (heightMm?: number) => {
  removeExistingPrintStyles();
  document.head.appendChild(createPrintStyle(heightMm));
};

const buildPrintRoot = (html: string) => {
  const parser = new DOMParser();
  const printDoc = parser.parseFromString(html, "text/html");
  const receipt = printDoc.querySelector(".receipt");

  if (!receipt) {
    throw new Error("Elemento .receipt nao encontrado no HTML de impressao.");
  }

  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.top = "0";
  root.style.width = "80mm";
  root.style.margin = "0";
  root.style.padding = "0";
  root.style.opacity = "0";
  root.style.pointerEvents = "none";
  root.style.transform = "none";
  root.style.zIndex = "-1";
  root.appendChild(document.importNode(receipt, true));

  return { root };
};

const getReceipt = (root: HTMLElement) => {
  const receipt = root.querySelector(".receipt") as HTMLElement | null;
  if (!receipt) {
    throw new Error("Elemento .receipt nao encontrado no root de impressao.");
  }

  return receipt;
};

const getReceiptHeightMm = (receipt: HTMLElement) => {
  const rect = receipt.getBoundingClientRect();
  const heightPx = Math.ceil(rect.height);
  const heightMm = Math.max(40, Math.ceil((heightPx * 25.4) / 96) + 4);

  console.log("[thermal-print] receipt rect", rect);
  console.log("[thermal-print] height mm", heightMm);

  return heightMm;
};

const logPrintMetrics = (root: HTMLElement, receipt: HTMLElement, heightMm: number) => {
  console.table({
    bodyScrollHeight: document.body.scrollHeight,
    bodyOffsetHeight: document.body.offsetHeight,
    htmlScrollHeight: document.documentElement.scrollHeight,
    htmlOffsetHeight: document.documentElement.offsetHeight,
    receiptHeight: receipt.offsetHeight,
    receiptScrollHeight: receipt.scrollHeight,
    rootHeight: root.offsetHeight,
    heightMm,
  });

  console.log(
    "[thermal-print] computed body",
    getComputedStyle(document.body).height,
    getComputedStyle(document.body).display,
  );
  console.log(
    "[thermal-print] computed html",
    getComputedStyle(document.documentElement).height,
    getComputedStyle(document.documentElement).display,
  );
  console.log(
    "[thermal-print] computed root",
    getComputedStyle(root).height,
    getComputedStyle(root).display,
    getComputedStyle(root).position,
  );
  console.log(
    "[thermal-print] computed receipt",
    getComputedStyle(receipt).height,
    getComputedStyle(receipt).display,
    getComputedStyle(receipt).position,
  );
};

export const printThermalReceipt = async ({ html }: ThermalPrintOptions) => {
  console.log("[thermal-print] start");
  console.log("[thermal-print] using main-window print root");

  let cleaned = false;
  let cleanupTimer: number | undefined;
  const previousTitle = document.title;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (cleanupTimer) window.clearTimeout(cleanupTimer);
    window.removeEventListener("afterprint", cleanup);
    document.documentElement.classList.remove(PRINTING_CLASS);
    document.title = previousTitle;
    removeExistingPrintNodes();
    console.log("[thermal-print] after cleanup");
  };

  try {
    removeExistingPrintNodes();
    const { root } = buildPrintRoot(html);

    document.body.appendChild(root);
    appendPrintStyle();
    document.documentElement.classList.add(PRINTING_CLASS);
    window.scrollTo(0, 0);

    await waitForPrintLayout();

    const receipt = getReceipt(root);
    const heightMm = getReceiptHeightMm(receipt);
    appendPrintStyle(heightMm);

    await waitForPrintLayout();

    window.addEventListener("afterprint", cleanup, { once: true });
    cleanupTimer = window.setTimeout(cleanup, 30000);

    console.log("[thermal-print] before window.print");
    logPrintMetrics(root, receipt, heightMm);
    if (!hasShownHeaderFooterHint) {
      hasShownHeaderFooterHint = true;
      toast({
        title: "Impressao POS-80",
        description: "Em Mais configuracoes, desative Cabecalhos e rodapes.",
      });
    }
    document.title = "";
    window.focus();
    window.print();
  } catch (error) {
    console.error("[thermal-print] error", error);
    cleanup();
    throw error;
  }
};
