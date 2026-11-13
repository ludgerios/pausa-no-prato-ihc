// Mede a razão de contraste (WCAG 2.2) das combinações de cor usadas no protótipo.
// Uso: node scripts/contrast.mjs  → docs/verificacao/contraste.json e tabela no terminal.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const lum = (hex) => {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// [uso, frente, fundo, mínimo exigido]
const pairs = [
  ['Texto principal sobre fundo creme', '#1F1A17', '#FFF8F1', 4.5],
  ['Texto principal sobre cartão branco', '#1F1A17', '#FFFFFF', 4.5],
  ['Texto secundário sobre cartão branco', '#5C534D', '#FFFFFF', 4.5],
  ['Texto secundário sobre fundo creme', '#5C534D', '#FFF8F1', 4.5],
  ['Botão principal: texto branco sobre terracota', '#FFFFFF', '#9E3A1A', 4.5],
  ['Botão principal em foco/hover', '#FFFFFF', '#7A2B12', 4.5],
  ['Link «Remover» e destaque sobre branco', '#7A2B12', '#FFFFFF', 4.5],
  ['Filtro ativo e barra do carrinho: branco sobre grafite', '#FFFFFF', '#1F1A17', 4.5],
  ['Aviso de item adicionado: branco sobre verde', '#FFFFFF', '#1B6B45', 4.5],
  ['Selo «No carrinho»: verde sobre verde-claro', '#1B6B45', '#E3F2EA', 4.5],
  ['Mensagem de erro: vermelho sobre rosa', '#B3261E', '#FDECEA', 4.5],
  ['Ajuda no grupo com erro: secundário sobre rosa', '#5C534D', '#FDECEA', 4.5],
  ['Opção escolhida: texto sobre terracota-claro', '#1F1A17', '#F8E6DA', 4.5],
  ['Opção escolhida: dica sobre terracota-claro', '#5C534D', '#F8E6DA', 4.5],
  ['Aviso informativo: texto sobre azul-claro', '#1F1A17', '#EAF0FA', 4.5],
  ['Etiqueta Prato', '#7A2B12', '#FBE3D6', 4.5],
  ['Etiqueta Bebida', '#1D4E89', '#DDEBF7', 4.5],
  ['Etiqueta Sobremesa', '#6B2A6B', '#F2E2F2', 4.5],
  ['Contador do carrinho vazio', '#1F1A17', '#EFE6DE', 4.5],
  ['Limite de controles (filtros, quantidade, pagamento) sobre branco', '#8A7F78', '#FFFFFF', 3],
  ['Limite de controles sobre fundo creme', '#8A7F78', '#FFF8F1', 3],
  ['Limite de controles sobre rosa (grupo com erro)', '#8A7F78', '#FDECEA', 3],
  ['Borda da opção escolhida sobre branco', '#9E3A1A', '#FFFFFF', 3],
  ['Contorno de foco sobre fundo creme', '#0B57D0', '#FFF8F1', 3],
  ['Contorno de foco sobre cartão branco', '#0B57D0', '#FFFFFF', 3],
  ['Borda do grupo com erro sobre fundo branco', '#B3261E', '#FFFFFF', 3],
  ['Ícones informativos azuis sobre azul-claro', '#1D4E89', '#EAF0FA', 3],
];

const rows = pairs.map(([uso, fg, bg, min]) => ({ uso, fg, bg, min, ratio: Math.round(ratio(fg, bg) * 100) / 100 }))
  .map((r) => ({ ...r, ok: r.ratio >= r.min }));
for (const r of rows) console.log(`${r.ok ? 'OK  ' : 'FALHA'} ${r.ratio.toFixed(2)}:1 (mín. ${r.min}:1)  ${r.uso}  ${r.fg} / ${r.bg}`);
await mkdir(resolve(import.meta.dirname, '../docs/verificacao'), { recursive: true });
await writeFile(resolve(import.meta.dirname, '../docs/verificacao/contraste.json'), JSON.stringify(rows, null, 2));
process.exit(rows.every((r) => r.ok) ? 0 : 1);
