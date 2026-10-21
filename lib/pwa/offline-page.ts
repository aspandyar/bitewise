import { appearanceCss, appearanceScript, themeColorViewport } from "@/lib/appearance";
import { PWA } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import { offlineIcon, pwaIconUrl } from "./icons";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char);
}

// Served by the worker when there is no network, so it carries its own styles and loads nothing.
const STYLES =
  "body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:var(--background);color:var(--foreground)}" +
  "main{max-width:28rem;margin:0 auto;padding:2rem 1rem;display:flex;flex-direction:column;gap:1rem}" +
  "h1{margin:0;font-size:1.5rem}p{margin:0;opacity:.7}" +
  `a{display:flex;align-items:center;justify-content:center;min-height:${PWA.offlineTapPx}px;border-radius:.5rem;background:var(--accent);color:var(--on-accent);font-weight:500;text-decoration:none}`;

// The same status-bar colors as the app (the head script recolors them for a forced theme), and
// a favicon the worker serves from its cache when the network is gone (#96).
function headLinks(): string {
  const colors = themeColorViewport()
    .map(({ media, color }) => `<meta name="theme-color" media="${media}" content="${color}">`)
    .join("");
  return `${colors}<link rel="icon" type="image/png" href="${pwaIconUrl(offlineIcon())}">`;
}

export function offlinePageHtml(): string {
  const t = ru.offline;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${headLinks()}<title>${escapeHtml(ru.app.name)}</title><style>${appearanceCss()}${STYLES}</style><script>${appearanceScript()}</script></head><body><main><h1>${escapeHtml(t.title)}</h1><p>${escapeHtml(t.text)}</p><a href="">${escapeHtml(t.retry)}</a></main></body></html>`;
}
