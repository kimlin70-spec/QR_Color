/* Renders labels.html to an A4 PDF: `node test/make-pdf.cjs [start] [count]` (default 1 500). */
const path = require('path');
const { chromium } = require('playwright');
const { serve } = require('./serve.cjs');

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const start = parseInt(process.argv[2] || '1', 10);
  const count = parseInt(process.argv[3] || '500', 10);
  const pad = n => String(n).padStart(4, '0');
  const { server, base } = await serve(ROOT);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base + 'labels.html?start=' + start + '&count=' + count);
  await page.waitForFunction(n => document.querySelectorAll('.lab').length === n, count);
  // Margins are given explicitly here; CSS @page margins are zeroed so they are not applied twice.
  await page.addStyleTag({ content: '@page { margin: 0 }' });
  const out = path.join(ROOT, 'labels_' + pad(start) + '-' + pad(start + count - 1) + '.pdf');
  await page.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: '8mm', right: '8mm', bottom: '6mm', left: '8mm' } });
  console.log('Wrote ' + out);
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
