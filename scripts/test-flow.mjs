// Percorre o protótipo com Playwright e registra o resultado de cada verificação.
// Uso: node scripts/test-flow.mjs [URL]   (padrão: http://localhost:8000)
// Saída: docs/verificacao/resultado-<host>.json e resumo no terminal. Sai com código 1 se algo falhar.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = (process.argv[2] ?? 'http://localhost:8000').replace(/\/$/, '');
const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail: String(detail) });
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const consoleErrors = [];
const failedRequests = [];

async function newPage(viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', hasTouch: viewport.width < 600 });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${page.url()} → ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`${page.url()} → ${e.message}`));
  // ERR_ABORTED = requisição cancelada pela própria navegação do teste, não falha do servidor.
  page.on('requestfailed', (r) => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') failedRequests.push(`${r.url()} (${r.failure()?.errorText})`); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) failedRequests.push(`${r.url()} (HTTP ${r.status()})`); });
  return { context, page };
}

const count = (page) => page.locator('#cart-count').innerText();
const text = (page, sel) => page.locator(sel).innerText();
const activeInfo = (page) => page.evaluate(() => {
  const el = document.activeElement;
  return { tag: el.tagName, id: el.id, label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 60), name: el.name || '', value: el.value || '' };
});

async function axe(page, label) {
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate(async () => {
    const out = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return out.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
  check(`axe-core sem violações WCAG A/AA em ${label}`, r.length === 0, r.join(', ') || '0 violações');
}

/* 1. Fluxo principal com o cenário de demonstração */
{
  const { context, page } = await newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check('Início carrega com título «Almoço rápido entre aulas»', (await text(page, 'h1')) === 'Almoço rápido entre aulas');
  check('Início mostra retirada no balcão e tempo estimado', /Retirada no balcão/.test(await text(page, 'main')) && /Pronto em \d+ a \d+ min/.test(await text(page, 'main')));
  check('Início mostra destaques', (await page.locator('.item').count()) >= 3, `${await page.locator('.item').count()} destaques`);
  check('Contador do carrinho começa em 0', (await count(page)) === '0');
  check('lang="pt-BR" no documento', (await page.getAttribute('html', 'lang')) === 'pt-BR');
  await axe(page, 'Início');

  await page.getByRole('link', { name: 'Ver cardápio', exact: true }).click();
  await page.waitForURL(/#\/cardapio$/);
  check('«Ver cardápio» abre a tela Cardápio', (await text(page, 'h1')) === 'Cardápio');
  check('Foco vai para o título ao mudar de tela', (await activeInfo(page)).id === 'titulo-tela');

  for (const [label, expected] of [['Pratos', 4], ['Bebidas', 3], ['Sobremesas', 3], ['Todos', 10]]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    const n = await page.locator('.item').count();
    const pressed = await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed');
    const status = await text(page, '#filter-status');
    check(`Filtro «${label}» mostra ${expected} itens e fica marcado`, n === expected && pressed === 'true' && status.includes(label), `${n} itens, aria-pressed=${pressed}, «${status}»`);
  }
  const activeChipStyle = await page.getByRole('button', { name: 'Todos', exact: true }).evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, icon: getComputedStyle(el.querySelector('.chip__check')).display }));
  check('Filtro ativo tem sinal além da cor (ícone de seleção)', activeChipStyle.icon !== 'none', JSON.stringify(activeChipStyle));
  await axe(page, 'Cardápio');

  await page.getByRole('button', { name: 'Adicionar Frango grelhado ao carrinho' }).click();
  await page.waitForTimeout(150);
  const toastText = await text(page, '#toast');
  check('Feedback «Frango grelhado adicionado ao carrinho» aparece', toastText.includes('Frango grelhado adicionado ao carrinho'), toastText);
  check('Feedback está em região de status (role=status)', (await page.getAttribute('#toast', 'role')) === 'status');
  check('Contador atualiza para 1', (await count(page)) === '1');
  check('Usuário continua no Cardápio após adicionar', page.url().endsWith('#/cardapio'));
  check('Foco permanece no botão «Adicionar»', (await activeInfo(page)).label === 'Adicionar Frango grelhado ao carrinho');
  await page.getByRole('button', { name: 'Adicionar Suco de laranja ao carrinho' }).click();
  await page.getByRole('button', { name: 'Adicionar Água mineral ao carrinho' }).click();
  check('Contador mostra 3 itens', (await count(page)) === '3');
  check('Barra do carrinho mostra 3 itens e R$ 32,30', /3 itens/.test(await text(page, '#cartbar')) && /32,30/.test(await text(page, '#cartbar')), (await text(page, '#cartbar')).replace(/\s+/g, ' '));

  await page.reload({ waitUntil: 'networkidle' });
  check('Recarregar o Cardápio preserva o carrinho', (await count(page)) === '3');

  await page.locator('#cartbar a').click();
  await page.waitForURL(/#\/finalizacao$/);
  check('Finalização lista 3 linhas', (await page.locator('.line').count()) === 3);
  check('Finalização informa que pedido e pagamento são simulados', /pedido e o pagamento são simulados/.test(await text(page, 'main')));
  check('Finalização mostra estimativa de retirada', /Retirada no balcão em cerca de 15 min/.test(await text(page, 'main')));
  await axe(page, 'Finalização');

  await page.getByRole('button', { name: 'Aumentar quantidade de Suco de laranja' }).click();
  check('Aumentar quantidade do suco para 2 atualiza o total para R$ 39,20', (await text(page, '#total-final')).includes('39,20'), await text(page, '#total-final'));
  await page.getByRole('button', { name: 'Diminuir quantidade de Suco de laranja' }).click();
  check('Diminuir volta o total para R$ 32,30', (await text(page, '#total-final')).includes('32,30'));
  check('Botão «Diminuir» fica indisponível na quantidade 1', await page.getByRole('button', { name: 'Diminuir quantidade de Suco de laranja' }).isDisabled());
  await page.getByRole('button', { name: 'Remover Água mineral do pedido' }).click();
  check('Remover água deixa 2 linhas e total R$ 28,80', (await page.locator('.line').count()) === 2 && (await text(page, '#total-final')).includes('28,80'));
  check('Remoção é anunciada na região de status', (await text(page, '#toast')).includes('Água mineral removido'), await text(page, '#toast'));

  await page.getByRole('link', { name: 'Voltar ao cardápio' }).click();
  await page.waitForURL(/#\/cardapio$/);
  check('Voltar ao cardápio preserva 2 itens', (await count(page)) === '2');
  await page.goBack();
  await page.waitForURL(/#\/finalizacao$/);
  check('Botão Voltar do navegador retorna à Finalização', (await text(page, 'h1')) === 'Finalização do pedido');
  await page.reload({ waitUntil: 'networkidle' });
  check('Recarregar a Finalização preserva os itens', (await page.locator('.line').count()) === 2);

  await page.getByRole('button', { name: /Confirmar pedido/ }).click();
  const err = page.locator('#pagamento-erro');
  check('Confirmar sem pagamento mostra a mensagem junto às opções', await err.isVisible(), await err.innerText());
  const af = await activeInfo(page);
  check('Foco vai para o grupo de pagamento', af.name === 'pagamento', JSON.stringify(af));
  check('Pedido não é confirmado sem pagamento', page.url().endsWith('#/finalizacao'));
  check('Grupo de pagamento descreve o erro por aria-describedby', (await page.getAttribute('#pagamento', 'aria-describedby')).includes('pagamento-erro'));

  await page.getByRole('radio', { name: 'Pix', exact: true }).check();
  check('Escolher Pix esconde a mensagem de erro', !(await err.isVisible()));
  const totalBefore = await text(page, '#total-final');
  await page.getByRole('button', { name: /Confirmar pedido/ }).click();
  await page.waitForURL(/#\/confirmacao$/);
  check('Confirmação mostra «Pedido simulado confirmado»', (await text(page, 'h1')) === 'Pedido simulado confirmado');
  const ticket = await text(page, '.ticket');
  check('Confirmação lista itens, pagamento e retirada', /1 × Frango grelhado/.test(ticket) && /1 × Suco de laranja/.test(ticket) && /Pix/.test(ticket) && /Retirada prevista às \d{2}:\d{2}/.test(ticket));
  check('Total da confirmação igual ao da finalização (R$ 28,80)', (await text(page, '#total-confirmado')) === totalBefore && totalBefore.includes('28,80'), `${totalBefore} → ${await text(page, '#total-confirmado')}`);
  check('Carrinho é limpo após confirmar', (await count(page)) === '0');
  await axe(page, 'Confirmação');
  await page.reload({ waitUntil: 'networkidle' });
  check('Resumo da compra continua visível após recarregar', (await text(page, 'h1')) === 'Pedido simulado confirmado');

  await page.getByRole('button', { name: 'Fazer novo pedido' }).click();
  await page.waitForURL(/#\/inicio$/);
  check('«Fazer novo pedido» volta ao Início com carrinho vazio', (await count(page)) === '0');
  await page.goto(`${BASE}/#/confirmacao`);
  check('Confirmação não aparece sem pedido concluído', (await text(page, 'h1')) === 'Nenhum pedido confirmado');
  await page.goto(`${BASE}/#/finalizacao`);
  check('Carrinho vazio mostra orientação e caminho para o cardápio', /Seu carrinho está vazio/.test(await text(page, 'main')) && (await page.getByRole('link', { name: 'Ver cardápio' }).count()) === 1);
  check('Carrinho vazio não oferece «Confirmar pedido»', (await page.getByRole('button', { name: /Confirmar pedido/ }).count()) === 0);
  await axe(page, 'Finalização com carrinho vazio');
  await context.close();
}

/* 2. Teclado */
{
  const { context, page } = await newPage({ width: 1280, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  check('Primeiro Tab mostra «Pular para o conteúdo»', (await activeInfo(page)).label === 'Pular para o conteúdo' && (await page.locator('.skip-link').boundingBox()).y >= 0);
  const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`; });
  check('Foco tem contorno visível', outline.startsWith('solid 3px'), outline);

  const tabTo = async (predicate, max = 40) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      if (predicate(await activeInfo(page))) return true;
    }
    return false;
  };
  check('Tab alcança «Ver cardápio»', await tabTo((a) => a.label.startsWith('Ver cardápio')));
  await page.keyboard.press('Enter');
  await page.waitForURL(/#\/cardapio$/);
  check('Enter em «Ver cardápio» abre o Cardápio com foco no título', (await activeInfo(page)).id === 'titulo-tela');
  check('Tab alcança o filtro «Bebidas»', await tabTo((a) => a.label === 'Bebidas'));
  await page.keyboard.press('Enter');
  check('Enter ativa o filtro e mantém o foco nele', (await activeInfo(page)).label === 'Bebidas' && (await page.locator('.item').count()) === 3);
  check('Tab alcança «Adicionar Suco de laranja»', await tabTo((a) => a.label === 'Adicionar Suco de laranja ao carrinho'));
  await page.keyboard.press('Enter');
  check('Enter adiciona o suco (contador 1)', (await count(page)) === '1');
  await page.keyboard.press('Shift+Tab');
  check('Shift+Tab volta para os filtros', await (async () => { for (let i = 0; i < 6; i++) { if ((await activeInfo(page)).label === 'Pratos') return true; await page.keyboard.press('Shift+Tab'); } return false; })());
  await page.keyboard.press('Enter');
  check('Tab alcança «Adicionar Frango grelhado»', await tabTo((a) => a.label === 'Adicionar Frango grelhado ao carrinho'));
  await page.keyboard.press('Space');
  check('Espaço adiciona o frango (contador 2)', (await count(page)) === '2');
  check('Tab alcança a barra «Revisar pedido»', await tabTo((a) => a.label.includes('Revisar pedido')));
  await page.keyboard.press('Enter');
  await page.waitForURL(/#\/finalizacao$/);
  check('Tab alcança a primeira opção de pagamento', await tabTo((a) => a.name === 'pagamento'));
  await page.keyboard.press('ArrowDown');
  const sel = await activeInfo(page);
  check('Seta para baixo seleciona «Cartão na retirada»', sel.value === 'cartao' && (await page.locator('input[value="cartao"]').isChecked()), JSON.stringify(sel));
  const selStyle = await page.locator('.pay__opt:has(input:checked)').evaluate((el) => `${getComputedStyle(el).borderColor} / ícone ${getComputedStyle(el.querySelector('.pay__mark')).display}`);
  check('Opção escolhida tem destaque e ícone de seleção', selStyle.includes('ícone flex') || selStyle.includes('ícone inline-flex'), selStyle);
  check('Tab alcança «Confirmar pedido»', await tabTo((a) => a.label.startsWith('Confirmar pedido')));
  await page.keyboard.press('Enter');
  await page.waitForURL(/#\/confirmacao$/);
  check('Pedido confirmado só com teclado', (await text(page, 'h1')) === 'Pedido simulado confirmado' && /Cartão na retirada/.test(await text(page, '.ticket')));
  await context.close();
}

/* 3. Larguras de tela, rolagem horizontal e alvos de toque */
for (const vp of [{ width: 320, height: 640 }, { width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
  const { context, page } = await newPage(vp);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('pausa-no-prato:v1', JSON.stringify({ cart: [{ id: 'frango', qty: 1 }, { id: 'suco', qty: 1 }], payment: null, filter: 'todos', lastOrder: null })));
  const issues = [];
  const small = [];
  for (const route of ['inicio', 'cardapio', 'finalizacao']) {
    await page.goto(`${BASE}/#/${route}`);
    await page.reload({ waitUntil: 'networkidle' });
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, font: getComputedStyle(document.body).fontSize }));
    if (m.sw > m.cw) issues.push(`${route}: ${m.sw}>${m.cw}`);
    const targets = await page.evaluate(() => [...document.querySelectorAll('main .btn, .chip, .stepper__btn, .cart-link, .pay__opt, .brand, .cartbar__link')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => { const r = el.getBoundingClientRect(); return { t: (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter((r) => r.w < 44 || r.h < 44));
    small.push(...targets.map((t) => `${route}: ${t.t} ${t.w}×${t.h}`));
    if (route === 'inicio') check(`${vp.width}px: texto base de ${m.font}`, m.font === '16px');
  }
  check(`${vp.width}px: sem rolagem horizontal em Início, Cardápio e Finalização`, issues.length === 0, issues.join('; ') || 'scrollWidth = clientWidth');
  check(`${vp.width}px: alvos de toque com pelo menos 44×44 px`, small.length === 0, small.join('; ') || 'todos ≥ 44×44');
  await context.close();
}

{
  const { context, page } = await newPage();
  for (const asset of ['/', '/styles.css', '/app.js', '/favicon.svg']) {
    const r = await page.request.get(`${BASE}${asset}`);
    check(`Recurso ${asset} responde HTTP 200`, r.status() === 200, `HTTP ${r.status()}`);
  }
  await context.close();
}
check('Nenhum erro no console', consoleErrors.length === 0, consoleErrors.join(' | ') || '0 erros');
check('Nenhum recurso falhou ao carregar', failedRequests.length === 0, failedRequests.join(' | ') || '0 falhas');

await browser.close();
const failed = results.filter((r) => !r.ok);
const host = new URL(BASE).host.replace(/[:.]/g, '-');
await mkdir(resolve(root, 'docs/verificacao'), { recursive: true });
await writeFile(resolve(root, `docs/verificacao/resultado-${host}.json`), JSON.stringify({ base: BASE, date: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} verificações aprovadas em ${BASE}`);
process.exit(failed.length ? 1 : 0);
