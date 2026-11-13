// Gera as capturas das quatro telas com o mesmo pedido de demonstração (frango + suco = R$ 28,80).
// Uso: node scripts/capture.mjs [URL]   (padrão: http://localhost:8000)
// O relógio do navegador é fixado em 12:30 para que a previsão de retirada seja estável nas imagens.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = (process.argv[2] ?? 'http://localhost:8000').replace(/\/$/, '');
const out = resolve(import.meta.dirname, '../docs/capturas');
await mkdir(out, { recursive: true });

const W = 390;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', hasTouch: true });
await context.clock.setFixedTime(new Date('2026-11-16T12:30:00-03:00'));
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const settle = async () => {
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
};

// 1. Início
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await settle();
await page.screenshot({ path: `${out}/1-inicio.png` });

// 2. Cardápio com feedback de adição
await page.getByRole('link', { name: 'Ver cardápio', exact: true }).click();
await page.getByRole('button', { name: 'Pratos', exact: true }).click();
await page.getByRole('button', { name: 'Adicionar Frango grelhado ao carrinho' }).click();
await page.getByRole('button', { name: 'Bebidas', exact: true }).click();
await page.getByRole('button', { name: 'Adicionar Suco de laranja ao carrinho' }).click();
await page.evaluate(() => window.scrollTo(0, 0));
await settle();
await page.screenshot({ path: `${out}/2-cardapio.png` });

// 3. Finalização com Pix escolhido. A página é longa no celular: duas metades lado a lado na mesma figura.
await page.locator('#cartbar a').click();
await page.waitForURL(/#\/finalizacao$/);
await page.getByRole('radio', { name: 'Pix', exact: true }).check();
// Viewport com a altura da página: evita repetir o cabeçalho fixo numa captura com rolagem.
const height = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({ width: W, height });
await settle();
const full = await page.screenshot();
const split = await page.evaluate(() => Math.round(document.querySelector('.panel--summary').getBoundingClientRect().top - 8));
await page.setViewportSize({ width: W, height: 844 });

// 5 (complementar). Erro ao confirmar sem pagamento.
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('pausa-no-prato:v1'));
  s.payment = null;
  localStorage.setItem('pausa-no-prato:v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Confirmar pedido/ }).click();
await page.waitForTimeout(500);
await page.mouse.move(0, 0);
await page.locator('#form-pedido').screenshot({ path: `${out}/5-erro-pagamento.png` });
await page.getByRole('radio', { name: 'Pix', exact: true }).check();

// 4. Confirmação
await page.getByRole('button', { name: /Confirmar pedido/ }).click();
await page.waitForURL(/#\/confirmacao$/);
await settle();
const confHeight = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({ width: W, height: Math.max(844, confHeight) });
await settle();
await page.screenshot({ path: `${out}/4-confirmacao.png` });

// Monta a figura 3 a partir da captura de página inteira.
const composer = await context.newPage();
await composer.setViewportSize({ width: W * 2 + 24, height: Math.max(split, height - split) + 0 });
const src = `data:image/png;base64,${full.toString('base64')}`;
await composer.setContent(`<!doctype html><html><body style="margin:0;background:#E9DED4;display:flex;gap:24px;align-items:flex-start">
  <div style="width:${W}px;height:${split}px;overflow:hidden;background:#FFF8F1"><img src="${src}" style="width:${W}px;display:block"></div>
  <div style="width:${W}px;height:${height - split}px;overflow:hidden;background:#FFF8F1"><img src="${src}" style="width:${W}px;display:block;margin-top:-${split}px"></div>
</body></html>`);
await composer.waitForLoadState('load');
await composer.screenshot({ path: `${out}/3-finalizacao.png`, fullPage: true });

await browser.close();
if (errors.length) { console.error(errors); process.exit(1); }
console.log(`Capturas salvas em ${out}`);
