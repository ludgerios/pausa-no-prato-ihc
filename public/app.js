/* Pausa no Prato: protótipo de pedido para retirada no balcão.
   Todo o catálogo, o carrinho e a simulação ficam no navegador (localStorage).
   Valores em centavos; formatação em reais apenas na exibição. */
'use strict';

(() => {
  const STORAGE_KEY = 'pausa-no-prato:v1';
  const MAX_QTY = 10;
  const QUEUE_MINUTES = 3; // fila média do balcão somada ao preparo mais longo

  const CATEGORIES = [
    { id: 'todos', label: 'Todos' },
    { id: 'pratos', label: 'Pratos' },
    { id: 'bebidas', label: 'Bebidas' },
    { id: 'sobremesas', label: 'Sobremesas' },
  ];
  const CATEGORY_NAME = { pratos: 'Prato', bebidas: 'Bebida', sobremesas: 'Sobremesa' };

  // Dados fictícios.
  const MENU = [
    { id: 'frango', cat: 'pratos', name: 'Frango grelhado', desc: 'Filé de frango, arroz, feijão, salada verde e legumes no vapor.', price: 2190, prep: 12, featured: true },
    { id: 'moqueca', cat: 'pratos', name: 'Moqueca de peixe', desc: 'Peixe em molho de tomate e coentro, com arroz branco e pirão.', price: 2790, prep: 15 },
    { id: 'bowl', cat: 'pratos', name: 'Bowl vegetariano', desc: 'Grão-de-bico, arroz integral, abóbora assada e folhas.', price: 1950, prep: 10, featured: true },
    { id: 'escondidinho', cat: 'pratos', name: 'Escondidinho de carne', desc: 'Carne desfiada com purê de aipim gratinado e salada.', price: 2250, prep: 14 },
    { id: 'suco', cat: 'bebidas', name: 'Suco de laranja', desc: 'Natural, sem açúcar, copo de 300 ml.', price: 690, prep: 3, featured: true },
    { id: 'agua', cat: 'bebidas', name: 'Água mineral', desc: 'Garrafa de 500 ml, com ou sem gás.', price: 350, prep: 1 },
    { id: 'refri', cat: 'bebidas', name: 'Refrigerante', desc: 'Lata de 350 ml, sabores variados.', price: 550, prep: 1 },
    { id: 'pudim', cat: 'sobremesas', name: 'Pudim de leite', desc: 'Fatia individual com calda de caramelo.', price: 650, prep: 2 },
    { id: 'frutas', cat: 'sobremesas', name: 'Salada de frutas', desc: 'Frutas da estação em pote de 200 g.', price: 590, prep: 2 },
    { id: 'brownie', cat: 'sobremesas', name: 'Brownie', desc: 'Chocolate meio amargo, pedaço de 80 g.', price: 700, prep: 2 },
  ];
  const BY_ID = Object.fromEntries(MENU.map((item) => [item.id, item]));

  const PAYMENTS = [
    { id: 'pix', label: 'Pix', hint: 'Pagamento instantâneo (simulado). Nada é cobrado.' },
    { id: 'cartao', label: 'Cartão na retirada', hint: 'Débito ou crédito na maquininha do balcão (simulado).' },
    { id: 'dinheiro', label: 'Dinheiro na retirada', hint: 'Pagamento no balcão ao retirar (simulado).' },
  ];

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brl = (cents) => money.format(cents / 100);
  const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

  /* ---------- Estado ---------- */
  const emptyState = () => ({ cart: [], payment: null, filter: 'todos', lastOrder: null });

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!raw || typeof raw !== 'object') return emptyState();
      const cart = Array.isArray(raw.cart)
        ? raw.cart.filter((l) => BY_ID[l.id] && Number.isInteger(l.qty) && l.qty > 0).map((l) => ({ id: l.id, qty: Math.min(l.qty, MAX_QTY) }))
        : [];
      return {
        cart,
        payment: PAYMENTS.some((p) => p.id === raw.payment) ? raw.payment : null,
        filter: CATEGORIES.some((c) => c.id === raw.filter) ? raw.filter : 'todos',
        lastOrder: raw.lastOrder && Array.isArray(raw.lastOrder.lines) ? raw.lastOrder : null,
      };
    } catch {
      return emptyState();
    }
  }

  let state = load();
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* modo privado sem armazenamento */ }
  };

  const itemCount = () => state.cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = () => state.cart.reduce((sum, l) => sum + BY_ID[l.id].price * l.qty, 0);
  const pickupMinutes = (lines) => (lines.length ? Math.max(...lines.map((l) => BY_ID[l.id].prep)) + QUEUE_MINUTES : 0);
  const itemsLabel = (n) => (n === 1 ? '1 item' : `${n} itens`);
  const qtyOf = (id) => state.cart.find((l) => l.id === id)?.qty ?? 0;

  function addItem(id) {
    const line = state.cart.find((l) => l.id === id);
    if (line) {
      if (line.qty >= MAX_QTY) return false;
      line.qty += 1;
    } else {
      state.cart.push({ id, qty: 1 });
    }
    save();
    return true;
  }

  function setQty(id, qty) {
    const line = state.cart.find((l) => l.id === id);
    if (!line) return;
    line.qty = Math.max(1, Math.min(MAX_QTY, qty));
    save();
  }

  function removeItem(id) {
    state.cart = state.cart.filter((l) => l.id !== id);
    save();
  }

  /* ---------- Utilidades de DOM ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#conteudo');
  const toast = $('#toast');

  const ICON = {
    plus: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    minus: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trash: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    store: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10h18M9 20v-6h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    alert: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M12 7v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1.4" fill="#fff"/></svg>',
    info: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/></svg>',
    cat: {
      pratos: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      bebidas: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 4h12l-1.5 16a1.5 1.5 0 0 1-1.5 1.4H9a1.5 1.5 0 0 1-1.5-1.4L6 4zM6.6 9h10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
      sobremesas: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 14h16l-1.5 6.5h-13L4 14zM6 14a6 6 0 0 1 12 0M12 5.5V8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    },
  };

  /* ---------- Feedback ---------- */
  let toastTimer;
  function announce(message) {
    clearTimeout(toastTimer);
    toast.textContent = '';
    toast.classList.remove('is-visible');
    // Pequeno atraso para que a mesma frase seja anunciada de novo pelo leitor de tela.
    requestAnimationFrame(() => {
      toast.innerHTML = `${ICON.check}<span>${esc(message)}</span>`;
      toast.classList.add('is-visible');
    });
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4500);
  }

  function updateChrome() {
    const n = itemCount();
    $('#cart-count').textContent = String(n);
    $('#cart-count-sr').textContent = `, ${itemsLabel(n)}`;
    $('#cart-link').classList.toggle('has-items', n > 0);
    const route = currentRoute();
    const bar = $('#cartbar');
    bar.hidden = !(n > 0 && (route === 'inicio' || route === 'cardapio'));
    document.body.classList.toggle('has-cartbar', !bar.hidden);
    $('#cartbar-items').textContent = itemsLabel(n);
    $('#cartbar-total').textContent = brl(cartTotal());
    const link = $('#cart-link');
    if (route === 'finalizacao') link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  /* ---------- Componentes ---------- */
  function itemCard(item, headingLevel = 3) {
    const q = qtyOf(item.id);
    return `
      <li class="item" data-cat="${item.cat}">
        <article class="item__body" aria-labelledby="nome-${item.id}">
          <div class="item__top">
            <span class="tag tag--${item.cat}">${ICON.cat[item.cat]}${CATEGORY_NAME[item.cat]}</span>
            <span class="item__prep">${ICON.clock}${item.prep} min</span>
          </div>
          <h${headingLevel} class="item__name" id="nome-${item.id}">${esc(item.name)}</h${headingLevel}>
          <p class="item__desc">${esc(item.desc)}</p>
          <div class="item__foot">
            <p class="item__price"><span class="visually-hidden">Preço: </span>${brl(item.price)}</p>
            <button type="button" class="btn btn--add" data-add="${item.id}" aria-label="Adicionar ${esc(item.name)} ao carrinho">
              ${ICON.plus}<span>Adicionar</span>
            </button>
          </div>
          <p class="item__incart" data-incart="${item.id}" ${q ? '' : 'hidden'}>${ICON.check}<span>No carrinho: ${q}</span></p>
        </article>
      </li>`;
  }

  function refreshInCart(id) {
    document.querySelectorAll(`[data-incart="${id}"]`).forEach((el) => {
      const q = qtyOf(id);
      el.hidden = q === 0;
      el.querySelector('span').textContent = `No carrinho: ${q}`;
    });
  }

  /* ---------- Telas ---------- */
  function renderInicio() {
    const featured = MENU.filter((i) => i.featured);
    const minPrep = Math.min(...MENU.filter((i) => i.cat === 'pratos').map((i) => i.prep)) + QUEUE_MINUTES;
    const maxPrep = Math.max(...MENU.filter((i) => i.cat === 'pratos').map((i) => i.prep)) + QUEUE_MINUTES;
    return `
      <section class="hero" aria-labelledby="titulo-tela">
        <p class="eyebrow">Cantina do campus · Grande Vitória</p>
        <h1 id="titulo-tela" tabindex="-1">Almoço rápido entre aulas</h1>
        <p class="lead">Escolha, revise e confirme em poucos toques. Seu pedido fica pronto para retirar no balcão.</p>
        <ul class="facts" aria-label="Como funciona a retirada">
          <li>${ICON.store}<span><strong>Retirada no balcão</strong><br>sem cadastro e sem endereço</span></li>
          <li>${ICON.clock}<span><strong>Pronto em ${minPrep} a ${maxPrep} min</strong><br>estimativa aparece antes de confirmar</span></li>
        </ul>
        <a class="btn btn--primary btn--block" href="#/cardapio">Ver cardápio ${ICON.next}</a>
      </section>

      <section class="section" aria-labelledby="titulo-destaques">
        <div class="section__head">
          <h2 id="titulo-destaques">Destaques de hoje</h2>
          <p class="muted">Opções rápidas que cabem em R$ 30 com uma bebida</p>
        </div>
        <ul class="grid" role="list">
          ${featured.map((i) => itemCard(i, 3)).join('')}
        </ul>
        <p class="center"><a class="btn btn--ghost" href="#/cardapio">Ver cardápio completo ${ICON.next}</a></p>
      </section>`;
  }

  function renderCardapio() {
    const f = state.filter;
    const items = f === 'todos' ? MENU : MENU.filter((i) => i.cat === f);
    const activeLabel = CATEGORIES.find((c) => c.id === f).label;
    return `
      <div class="page-head">
        <h1 id="titulo-tela" tabindex="-1">Cardápio</h1>
        <p class="muted">Preços por unidade. Tempo de preparo estimado em cada item.</p>
      </div>
      <div class="filters" role="group" aria-label="Filtrar cardápio por categoria">
        ${CATEGORIES.map((c) => `
          <button type="button" class="chip" data-filter="${c.id}" aria-pressed="${c.id === f}">
            <span class="chip__check" aria-hidden="true">${ICON.check}</span>${c.label}
          </button>`).join('')}
      </div>
      <p class="filter-status" id="filter-status">Mostrando: <strong>${activeLabel}</strong> · ${items.length} ${items.length === 1 ? 'opção' : 'opções'}</p>
      <ul class="grid" role="list" aria-labelledby="titulo-tela">
        ${items.map((i) => itemCard(i, 2)).join('')}
      </ul>`;
  }

  function renderFinalizacao() {
    if (state.cart.length === 0) {
      return `
        <div class="page-head">
          <h1 id="titulo-tela" tabindex="-1">Finalização do pedido</h1>
        </div>
        <div class="empty">
          <svg class="empty__art" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="34" r="22" fill="#F3E3D3"/><circle cx="32" cy="34" r="13" fill="none" stroke="#9E3A1A" stroke-width="3"/><path d="M14 10v12M10 10v8a4 4 0 0 0 8 0v-8M50 10c-4 2-5 8-5 12h5v14" fill="none" stroke="#5C534D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <h2>Seu carrinho está vazio</h2>
          <p>Escolha um prato ou uma bebida no cardápio. Os itens adicionados aparecem aqui para você revisar antes de confirmar.</p>
          <a class="btn btn--primary" href="#/cardapio">${ICON.back} Ver cardápio</a>
        </div>`;
    }
    const total = cartTotal();
    const minutes = pickupMinutes(state.cart);
    return `
      <div class="page-head">
        <h1 id="titulo-tela" tabindex="-1">Finalização do pedido</h1>
        <p class="muted">Revise os itens, escolha o pagamento e confirme.</p>
      </div>
      <p class="notice notice--info">${ICON.info}<span><strong>Protótipo:</strong> o pedido e o pagamento são simulados. Nenhum valor é cobrado.</span></p>
      <div class="checkout">
        <section class="panel" aria-labelledby="titulo-itens">
          <h2 id="titulo-itens">Itens do pedido <span class="muted">(${itemsLabel(itemCount())})</span></h2>
          <ul class="lines" role="list">
            ${state.cart.map((l) => {
              const item = BY_ID[l.id];
              return `
              <li class="line">
                <div class="line__info">
                  <h3 class="line__name">${esc(item.name)}</h3>
                  <p class="line__unit muted">${brl(item.price)} cada</p>
                </div>
                <div class="line__controls">
                  <div class="stepper" role="group" aria-label="Quantidade de ${esc(item.name)}">
                    <button type="button" class="stepper__btn" data-dec="${l.id}" aria-label="Diminuir quantidade de ${esc(item.name)}" ${l.qty <= 1 ? 'disabled' : ''}>${ICON.minus}</button>
                    <output class="stepper__value" aria-label="Quantidade de ${esc(item.name)}: ${l.qty}">${l.qty}</output>
                    <button type="button" class="stepper__btn" data-inc="${l.id}" aria-label="Aumentar quantidade de ${esc(item.name)}" ${l.qty >= MAX_QTY ? 'disabled' : ''}>${ICON.plus}</button>
                  </div>
                  <p class="line__subtotal"><span class="visually-hidden">Subtotal: </span>${brl(item.price * l.qty)}</p>
                  <button type="button" class="btn btn--text" data-remove="${l.id}" aria-label="Remover ${esc(item.name)} do pedido">${ICON.trash}<span>Remover</span></button>
                </div>
              </li>`;
            }).join('')}
          </ul>
          <a class="btn btn--ghost" href="#/cardapio">${ICON.back} Voltar ao cardápio</a>
        </section>

        <section class="panel panel--summary" aria-labelledby="titulo-resumo">
          <h2 id="titulo-resumo">Resumo</h2>
          <dl class="totals">
            <div><dt>Subtotal</dt><dd>${brl(total)}</dd></div>
            <div><dt>Taxa de entrega</dt><dd>R$ 0,00 <span class="muted">(retirada)</span></dd></div>
            <div class="totals__grand"><dt>Total</dt><dd id="total-final">${brl(total)}</dd></div>
          </dl>
          <p class="pickup">${ICON.clock}<span><strong>Retirada no balcão em cerca de ${minutes} min</strong><br><span class="muted">Contada a partir da confirmação.</span></span></p>

          <form class="pay" id="form-pedido" novalidate>
            <fieldset class="pay__group" id="pagamento" aria-describedby="pagamento-ajuda">
              <legend>Forma de pagamento <span class="muted">(simulada)</span></legend>
              <p class="pay__help muted" id="pagamento-ajuda">Obrigatório. Escolha uma opção para confirmar.</p>
              <p class="field-error" id="pagamento-erro" hidden>${ICON.alert}<span>Escolha uma forma de pagamento para confirmar o pedido.</span></p>
              ${PAYMENTS.map((p) => `
                <label class="pay__opt">
                  <input type="radio" name="pagamento" value="${p.id}" ${state.payment === p.id ? 'checked' : ''} aria-labelledby="rotulo-${p.id}" aria-describedby="hint-${p.id}">
                  <span class="pay__mark" aria-hidden="true">${ICON.check}</span>
                  <span class="pay__text"><span class="pay__label" id="rotulo-${p.id}">${p.label}</span><span class="pay__hint" id="hint-${p.id}">${p.hint}</span></span>
                </label>`).join('')}
            </fieldset>
            <button type="submit" class="btn btn--primary btn--block">${ICON.check} Confirmar pedido · ${brl(total)}</button>
          </form>
        </section>
      </div>`;
  }

  function renderConfirmacao() {
    const order = state.lastOrder;
    if (!order) {
      return `
        <div class="page-head">
          <h1 id="titulo-tela" tabindex="-1">Nenhum pedido confirmado</h1>
        </div>
        <div class="empty">
          <p>Ainda não há um pedido simulado concluído para mostrar. Monte o pedido no cardápio e confirme na finalização.</p>
          <a class="btn btn--primary" href="#/cardapio">${ICON.back} Ver cardápio</a>
        </div>`;
    }
    const payment = PAYMENTS.find((p) => p.id === order.payment);
    const ready = timeFmt.format(new Date(order.readyAt));
    return `
      <section class="ticket" aria-labelledby="titulo-tela">
        <div class="ticket__head">
          <span class="ticket__badge" aria-hidden="true">${ICON.check}</span>
          <h1 id="titulo-tela" tabindex="-1">Pedido simulado confirmado</h1>
          <p class="ticket__code">Pedido <strong>${esc(order.code)}</strong> · mostre este número no balcão</p>
        </div>
        <p class="pickup pickup--big">${ICON.clock}<span><strong>Retirada prevista às ${ready}</strong><br><span class="muted">em cerca de ${esc(order.minutes)} min, no balcão da cantina</span></span></p>
        <h2 class="ticket__sub">Itens</h2>
        <ul class="ticket__lines" role="list">
          ${order.lines.map((l) => `
            <li><span>${esc(l.qty)} × ${esc(l.name)}</span><span>${brl(l.unit * l.qty)}</span></li>`).join('')}
        </ul>
        <dl class="totals">
          <div class="totals__grand"><dt>Total</dt><dd id="total-confirmado">${brl(order.total)}</dd></div>
          <div><dt>Pagamento</dt><dd>${esc(payment ? payment.label : order.payment)} <span class="muted">(simulado)</span></dd></div>
        </dl>
        <p class="notice notice--info">${ICON.info}<span>Nada foi cobrado. Este resumo fica disponível até você começar um novo pedido.</span></p>
        <button type="button" class="btn btn--primary btn--block" data-action="novo-pedido">${ICON.plus} Fazer novo pedido</button>
      </section>`;
  }

  const ROUTES = {
    inicio: { title: 'Início', render: renderInicio },
    cardapio: { title: 'Cardápio', render: renderCardapio },
    finalizacao: { title: 'Finalização do pedido', render: renderFinalizacao },
    confirmacao: { title: 'Pedido confirmado', render: renderConfirmacao },
  };

  function currentRoute() {
    const name = location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
    return ROUTES[name] ? name : 'inicio';
  }

  let firstRender = true;
  function render({ focus = true } = {}) {
    const name = currentRoute();
    const route = ROUTES[name];
    view.innerHTML = route.render();
    view.dataset.route = name;
    document.title = `${route.title} · Pausa no Prato`;
    updateChrome();
    if (focus && !firstRender) {
      window.scrollTo(0, 0);
      const h1 = $('#titulo-tela');
      (h1 || view).focus({ preventScroll: true });
    }
    firstRender = false;
  }

  /* ---------- Eventos ---------- */
  // Ao trocar de tela, o aviso da tela anterior some para não cobrir o novo conteúdo.
  window.addEventListener('hashchange', () => {
    clearTimeout(toastTimer);
    toast.classList.remove('is-visible');
    toast.textContent = '';
    render();
  });

  // Outra aba alterou o carrinho: recarrega o estado sem mover o foco.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = load();
    render({ focus: false });
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;

    if (t.dataset.add) {
      const item = BY_ID[t.dataset.add];
      if (addItem(item.id)) {
        announce(`${item.name} adicionado ao carrinho. Total: ${brl(cartTotal())}.`);
      } else {
        announce(`Limite de ${MAX_QTY} unidades de ${item.name} por pedido.`);
      }
      refreshInCart(item.id);
      updateChrome();
      return;
    }

    if (t.dataset.filter) {
      state.filter = t.dataset.filter;
      save();
      render({ focus: false });
      $(`[data-filter="${state.filter}"]`).focus();
      return;
    }

    const lineId = t.dataset.inc || t.dataset.dec || t.dataset.remove;
    if (lineId) {
      const item = BY_ID[lineId];
      let msg;
      let focusSel;
      if (t.dataset.inc) {
        setQty(lineId, qtyOf(lineId) + 1);
        msg = `${item.name}: quantidade ${qtyOf(lineId)}. Total: ${brl(cartTotal())}.`;
        focusSel = qtyOf(lineId) >= MAX_QTY ? `[data-dec="${lineId}"]` : `[data-inc="${lineId}"]`;
      } else if (t.dataset.dec) {
        setQty(lineId, qtyOf(lineId) - 1);
        msg = `${item.name}: quantidade ${qtyOf(lineId)}. Total: ${brl(cartTotal())}.`;
        focusSel = qtyOf(lineId) <= 1 ? `[data-inc="${lineId}"]` : `[data-dec="${lineId}"]`;
      } else {
        const idx = state.cart.findIndex((l) => l.id === lineId);
        removeItem(lineId);
        msg = state.cart.length
          ? `${item.name} removido do pedido. Total: ${brl(cartTotal())}.`
          : `${item.name} removido. O carrinho está vazio.`;
        const next = state.cart[Math.min(idx, state.cart.length - 1)];
        focusSel = next ? `[data-remove="${next.id}"]` : '#titulo-tela';
      }
      render({ focus: false });
      announce(msg);
      const el = $(focusSel);
      if (el) el.focus();
      return;
    }

    if (t.dataset.action === 'novo-pedido') {
      state = { ...emptyState(), filter: state.filter };
      save();
      // Anuncia depois da troca de tela, que limpa o aviso anterior.
      window.addEventListener('hashchange', () => announce('Novo pedido iniciado. O carrinho está vazio.'), { once: true });
      location.hash = '#/inicio';
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.name === 'pagamento') {
      state.payment = e.target.value;
      save();
      const err = $('#pagamento-erro');
      if (err) {
        err.hidden = true;
        $('#pagamento').classList.remove('is-invalid');
        $('#pagamento').setAttribute('aria-describedby', 'pagamento-ajuda');
        document.querySelectorAll('input[name="pagamento"]').forEach((r) => r.removeAttribute('aria-invalid'));
      }
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'form-pedido') return;
    e.preventDefault();
    if (state.cart.length === 0) {
      render({ focus: true });
      return;
    }
    if (!state.payment) {
      const group = $('#pagamento');
      group.classList.add('is-invalid');
      group.setAttribute('aria-describedby', 'pagamento-erro pagamento-ajuda');
      $('#pagamento-erro').hidden = false;
      document.querySelectorAll('input[name="pagamento"]').forEach((r) => r.setAttribute('aria-invalid', 'true'));
      const first = group.querySelector('input');
      first.focus({ preventScroll: true });
      group.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const minutes = pickupMinutes(state.cart);
    const now = Date.now();
    const order = {
      code: `PP-${1000 + (Math.floor(now / 1000) % 9000)}`,
      lines: state.cart.map((l) => ({ id: l.id, name: BY_ID[l.id].name, unit: BY_ID[l.id].price, qty: l.qty })),
      total: cartTotal(),
      payment: state.payment,
      minutes,
      readyAt: now + minutes * 60000,
      createdAt: now,
    };
    state.lastOrder = order;
    state.cart = [];
    state.payment = null;
    save();
    location.hash = '#/confirmacao';
  });

  render();
})();
