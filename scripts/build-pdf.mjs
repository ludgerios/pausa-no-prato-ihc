// Exporta docs/relatorio.html para docs/Pausa_no_Prato_IHC.pdf (A4, texto selecionável, links clicáveis).
// A fonte Arial vem da instalação do sistema operacional; nenhum arquivo de fonte é copiado para o repositório.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'docs/Pausa_no_Prato_IHC.pdf');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(root, 'docs/relatorio.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const arial = await page.evaluate(() => document.fonts.check('12pt Arial'));
if (!arial) throw new Error('Arial não está disponível neste sistema.');
await page.pdf({
  path: output,
  format: 'A4',
  preferCSSPageSize: true,
  printBackground: true,
  tagged: true,
  outline: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;font-family:Arial,sans-serif;font-size:10pt;text-align:right;padding:0 2cm 0 3cm;color:#333"><span class="pageNumber"></span></div>',
});
await browser.close();
console.log(output);
