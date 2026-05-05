const PRINT_RULES = `body { padding: 20px !important; background: #fff !important; color: #222 !important; }
* { max-width: 100% !important; overflow: visible !important; height: auto !important; max-height: none !important; -webkit-text-fill-color: initial !important; -webkit-background-clip: initial !important; background-clip: initial !important; color: #222 !important; background: transparent !important; background-image: none !important; }
strong, b { color: #111 !important; }
.badge { background: #e8e8e8 !important; color: #333 !important; }
.highlight { background: #f5f5dc !important; border-left-color: #ccc !important; }
.card { background: #fafafa !important; border-color: #ddd !important; box-shadow: none !important; }
.hero { background: #f0f0f0 !important; }
.hero h1 { color: #111 !important; }
a { color: #1a73e8 !important; }
.compare-table th { background: #f0f0f0 !important; color: #333 !important; }
.compare-table td { border-color: #ddd !important; }
h1,h2,h3,h4,h5,h6 { page-break-after: avoid; color: #111 !important; }
pre, code { background: #f5f5f5 !important; color: #333 !important; }
pre, blockquote, table, .card, .hero, .highlight, section, .compare-table, details, figure, ul, ol { page-break-inside: avoid; break-inside: avoid; border-color: #ccc !important; }
img { max-width: 100% !important; }`;

const LAYOUT_CSS = `body, body > div, body > section, body > article, body > main, [class*="container"], [class*="wrapper"], [class*="content"] { max-width: 100% !important; width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; padding-left: 20px !important; padding-right: 20px !important; }`;

const SINGLE_PAGE_CSS = `${LAYOUT_CSS} @media print { ${PRINT_RULES} }`;

export { PRINT_RULES };

export function exportSinglePageHtml(html, title, filename) {
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${SINGLE_PAGE_CSS}</style></head><body>${html}</body></html>`;
  const blob = new Blob([fullHtml], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
