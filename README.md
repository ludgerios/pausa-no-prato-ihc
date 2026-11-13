# Pausa no Prato

Protótipo navegável de média fidelidade de um app de pedidos de comida para retirada no balcão, feito para a disciplina de **Interação Humano-Computador (IHC)**.

- **Versão publicada:** https://pausa-no-prato-ihc.pages.dev
- **Relatório em PDF:** [docs/Pausa_no_Prato_IHC.pdf](docs/Pausa_no_Prato_IHC.pdf)
- **Integrante:** Breno Ludgerio

Público-alvo: estudantes universitários da Grande Vitória que pedem o almoço pelo celular num intervalo curto entre aulas. Cenário de demonstração: cerca de 20 minutos de intervalo e R$ 30 para um prato e uma bebida.

> Cardápio, preços, tempos e pagamento são fictícios. Nenhum pedido é enviado e nada é cobrado. Todo o estado fica no navegador (`localStorage`).

## Roteiro para o professor testar (cerca de 3 minutos)

1. Abra a versão publicada no celular ou no computador. Na tela **Início**, toque em **Ver cardápio**.
2. No **Cardápio**, use os filtros **Pratos**, **Bebidas**, **Sobremesas** e **Todos**. O filtro ativo fica escuro e com ✓.
3. Adicione **Frango grelhado** (Pratos) e **Suco de laranja** (Bebidas). Observe a mensagem «… adicionado ao carrinho», o contador no topo e a barra inferior com **2 itens · R$ 28,80**.
4. Recarregue a página: o carrinho continua igual. Toque em **Revisar pedido**.
5. Na **Finalização**, aumente e diminua a quantidade do suco e veja o total mudar. Use **Voltar ao cardápio** e depois o botão Voltar do navegador: os itens ficam preservados.
6. Toque em **Confirmar pedido** sem escolher o pagamento: a mensagem aparece junto às opções e o foco vai para elas.
7. Escolha **Pix** e confirme. A **Confirmação** mostra «Pedido simulado confirmado», os itens, o total de R$ 28,80, a forma de pagamento e o horário previsto de retirada.
8. Toque em **Fazer novo pedido**: o carrinho volta vazio. Abra o carrinho para ver o estado vazio com o caminho de volta ao cardápio.

Teclado: `Tab` percorre os controles na ordem visual, `Enter`/`Espaço` acionam botões e as setas trocam a forma de pagamento. O primeiro `Tab` mostra «Pular para o conteúdo».

## Executar localmente

Requer Python 3 (servidor estático) ou qualquer servidor de arquivos.

```bash
python3 -m http.server 8000 --directory public
```

Depois abra http://localhost:8000. No Windows, use `python` no lugar de `python3`.

### Testes automatizados (opcional)

Requer Node.js 20+ e Microsoft Edge instalado (o Playwright usa o canal `msedge`).

```bash
npm install
npm test            # percurso completo, teclado, 320/375/768/1280 px, axe-core, console
npm run capture     # regenera as capturas em docs/capturas/
node scripts/contrast.mjs   # mede o contraste das cores usadas
```

Para testar a versão publicada: `node scripts/test-flow.mjs https://pausa-no-prato-ihc.pages.dev`.

## Estrutura

```
public/            site estático publicado (index.html, styles.css, app.js, favicon.svg)
docs/              relatório (HTML com estilo de impressão e PDF), capturas e resultados das verificações
scripts/           testes, capturas, contraste, geração do PDF e deploy
```

Navegação por hash (`#/inicio`, `#/cardapio`, `#/finalizacao`, `#/confirmacao`), compatível com o botão Voltar e com hospedagem estática. Valores calculados em centavos e formatados em reais.

## Publicação

Cloudflare Pages, projeto `pausa-no-prato-ihc`, produção a partir da branch `main`, diretório de saída `public`, sem comando de build.

## Créditos

- Código, textos, ícones SVG e cardápio criados para este trabalho. Não há imagens, fontes ou bibliotecas externas no site publicado (usa a fonte do sistema).
- Ferramentas de verificação (somente desenvolvimento): [Playwright](https://playwright.dev/) e [axe-core](https://github.com/dequelabs/axe-core) (Deque Systems, licença MPL-2.0).
- Referências: [10 heurísticas de usabilidade de Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/) e [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
