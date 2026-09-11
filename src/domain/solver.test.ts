import { describe, expect, it } from 'vitest';

import { modulePreferences } from './groups';
import { moduleById } from './modules';
import {
  addBin,
  buildOccupancy,
  changeModule,
  freeRectangles,
  moveBin,
  packLayout,
  removeBin,
  rotateBin,
  usedUnits,
  type BinRequest,
  type Layout,
} from './solver';

function request(key: string, preferences: ReturnType<typeof modulePreferences>): BinRequest {
  return { key, groupId: key, name: key, color: '#ccc', preferences };
}

const defaults: BinRequest[] = [
  request('escrita', modulePreferences('alongado', 'medio')),
  request('cabos', modulePreferences('amplo', 'medio')),
  request('fitas', modulePreferences('compacto', 'pouco')),
  request('panos', modulePreferences('amplo', 'muito')),
  request('pequenos', modulePreferences('compacto', 'pouco')),
  request('ferramentas', modulePreferences('alongado', 'medio')),
];

/** Nenhuma caixa sai da gaveta nem se sobrepõe a outra. */
function expectValid(layout: Layout) {
  const seen = new Set<string>();
  for (const bin of layout.bins) {
    expect(bin.x).toBeGreaterThanOrEqual(0);
    expect(bin.y).toBeGreaterThanOrEqual(0);
    expect(bin.x + bin.w).toBeLessThanOrEqual(layout.cols);
    expect(bin.y + bin.d).toBeLessThanOrEqual(layout.rows);
    for (let y = bin.y; y < bin.y + bin.d; y++) {
      for (let x = bin.x; x < bin.x + bin.w; x++) {
        const cell = `${x},${y}`;
        expect(seen.has(cell), `célula ${cell} ocupada duas vezes`).toBe(false);
        seen.add(cell);
      }
    }
  }
}

describe('packLayout', () => {
  it('coloca todos os grupos de uma gaveta comum sem sobreposições', () => {
    const layout = packLayout(defaults, 10, 10);
    expect(layout.unplaced).toEqual([]);
    expect(layout.bins).toHaveLength(defaults.length);
    expectValid(layout);
  });

  it('mantém as dimensões coerentes com o módulo escolhido', () => {
    const layout = packLayout(defaults, 10, 10);
    for (const bin of layout.bins) {
      const spec = moduleById(bin.moduleId);
      const expected = bin.rotated ? [spec.d, spec.w] : [spec.w, spec.d];
      expect([bin.w, bin.d]).toEqual(expected);
    }
  });

  it('é determinístico', () => {
    const a = packLayout(defaults, 9, 7);
    const b = packLayout(defaults, 9, 7);
    expect(a).toEqual(b);
  });

  it('desce para um módulo menor quando o preferido não cabe', () => {
    // 'amplo' + 'muito' prefere o Grande (6×4); numa gaveta de 4×4 não cabe.
    const layout = packLayout([request('panos', modulePreferences('amplo', 'muito'))], 4, 4);
    const bin = layout.bins[0];
    expect(bin).toBeDefined();
    expect(bin?.moduleId).not.toBe('grande');
    expect(bin?.downgraded).toBe(true);
    expectValid(layout);
  });

  it('roda um módulo para o encaixar numa gaveta estreita', () => {
    // O Longo é 6×2; numa gaveta de 2 colunas só entra de pé.
    const layout = packLayout([request('escrita', ['longo'])], 2, 6);
    expect(layout.bins[0]?.rotated).toBe(true);
    expect(layout.bins[0]?.w).toBe(2);
    expect(layout.bins[0]?.d).toBe(6);
  });

  it('assinala os grupos que não cabem de todo', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      request(`g${i}`, modulePreferences('amplo', 'muito')),
    );
    const layout = packLayout(many, 6, 4); // só cabe um Grande
    expect(layout.bins.length).toBeGreaterThan(0);
    expect(layout.unplaced.length).toBeGreaterThan(0);
    expect(layout.bins.length + layout.unplaced.length).toBe(many.length);
    expectValid(layout);
  });

  it('numa gaveta apertada prefere arrumar mais grupos a servir bem o primeiro', () => {
    // 4×4 = 16 módulos. À primeira, 'panos' leva um Médio (4×3) e mais nada
    // cabe; com toda a gente no mínimo entram quatro grupos.
    const layout = packLayout(defaults, 4, 4);
    expect(layout.bins.length).toBeGreaterThan(1);
    expect(layout.bins.every((bin) => bin.w * bin.d <= 6)).toBe(true);
    expectValid(layout);
  });

  it('marca como reduzidas as caixas que não ficaram no módulo preferido', () => {
    const layout = packLayout(defaults, 4, 4);
    const panos = layout.bins.find((bin) => bin.key === 'panos');
    expect(panos?.moduleId).not.toBe('grande');
    expect(panos?.downgraded).toBe(true);
  });

  it('não muda uma gaveta onde tudo já cabia', () => {
    const layout = packLayout(defaults, 10, 10);
    expect(layout.bins.find((bin) => bin.key === 'panos')?.moduleId).toBe('grande');
    expect(layout.bins.every((bin) => !bin.downgraded)).toBe(true);
  });

  it('não coloca nada numa grelha vazia', () => {
    const layout = packLayout(defaults, 0, 0);
    expect(layout.bins).toEqual([]);
    expect(layout.unplaced).toHaveLength(defaults.length);
  });
});

describe('freeRectangles', () => {
  it('cobre exatamente o espaço livre, sem sobreposições', () => {
    const layout = packLayout(defaults, 10, 10);
    const rects = freeRectangles(layout);
    const grid = buildOccupancy(layout.bins, layout.cols, layout.rows);

    let covered = 0;
    const seen = new Set<string>();
    for (const rect of rects) {
      covered += rect.w * rect.d;
      for (let y = rect.y; y < rect.y + rect.d; y++) {
        for (let x = rect.x; x < rect.x + rect.w; x++) {
          expect(grid[y * layout.cols + x], `célula ${x},${y} não estava livre`).toBe(false);
          expect(seen.has(`${x},${y}`)).toBe(false);
          seen.add(`${x},${y}`);
        }
      }
    }
    expect(covered).toBe(layout.cols * layout.rows - usedUnits(layout));
  });

  it('devolve a gaveta inteira quando não há caixas', () => {
    const empty: Layout = { cols: 5, rows: 4, bins: [], unplaced: [] };
    expect(freeRectangles(empty)).toEqual([{ x: 0, y: 0, w: 5, d: 4 }]);
  });
});

describe('edições manuais', () => {
  const base = packLayout(defaults, 10, 10);
  const first = base.bins[0]!;

  it('recusa mover uma caixa para cima de outra', () => {
    const other = base.bins.find((b) => b.key !== first.key)!;
    const result = moveBin(base, first.key, other.x, other.y);
    expect(result.ok).toBe(false);
  });

  it('recusa mover uma caixa para fora da gaveta', () => {
    const result = moveBin(base, first.key, base.cols - 1, base.rows - 1);
    expect(result.ok).toBe(false);
  });

  it('move para um espaço livre e mantém o resultado válido', () => {
    const rects = freeRectangles(base);
    const move = base.bins.flatMap((bin) => {
      const spot = rects.find((r) => r.w >= bin.w && r.d >= bin.d);
      return spot ? [{ bin, spot }] : [];
    })[0];
    expect(move, 'devia haver pelo menos uma caixa com espaço para onde ir').toBeDefined();

    const result = moveBin(base, move!.bin.key, move!.spot.x, move!.spot.y);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expectValid(result.layout);
      const moved = result.layout.bins.find((b) => b.key === move!.bin.key)!;
      expect([moved.x, moved.y]).toEqual([move!.spot.x, move!.spot.y]);
    }
  });

  it('recusa mover a caixa maior quando não sobra espaço do tamanho dela', () => {
    // 'panos' ocupa 6×4 e o espaço livre está fragmentado em 4×5 e 6×2.
    const rects = freeRectangles(base);
    expect(rects.some((r) => r.w >= first.w && r.d >= first.d)).toBe(false);
    const result = moveBin(base, first.key, rects[0]!.x, rects[0]!.y);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/espaço/i);
  });

  it('roda no sítio trocando largura e profundidade', () => {
    const target = base.bins.find((b) => b.moduleId === 'medio')!;
    const result = rotateBin(base, target.key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const rotated = result.layout.bins.find((b) => b.key === target.key)!;
      expect([rotated.w, rotated.d]).toEqual([target.d, target.w]);
      expect(rotated.rotated).toBe(!target.rotated);
      expectValid(result.layout);
    }
  });

  it('não roda caixas quadradas', () => {
    const square = base.bins.find((b) => b.w === b.d)!;
    expect(rotateBin(base, square.key).ok).toBe(false);
  });

  it('recusa rodar quando a orientação virada não cabe em lado nenhum', () => {
    const result = rotateBin(base, first.key); // 6×4 → 4×6 não cabe
    expect(result.ok).toBe(false);
  });

  it('troca o módulo de uma caixa e limpa a marca de redução', () => {
    const small = packLayout([request('panos', modulePreferences('amplo', 'muito'))], 4, 4);
    const result = changeModule(small, 'panos', 'quadrado');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const bin = result.layout.bins[0]!;
      expect(bin.moduleId).toBe('quadrado');
      expect(bin.downgraded).toBe(false);
      expectValid(result.layout);
    }
  });

  it('recusa um módulo que já não cabe', () => {
    const full = packLayout([request('a', ['grande'])], 6, 4);
    const result = changeModule(full, 'a', 'grande');
    expect(result.ok).toBe(true); // cabe onde já está
    const blocked = changeModule(packLayout([request('a', ['quadrado'])], 2, 2), 'a', 'grande');
    expect(blocked.ok).toBe(false);
  });

  it('acrescenta e remove caixas', () => {
    const added = addBin(base, {
      key: 'nova',
      groupId: 'custom',
      name: 'Nova',
      color: '#eee',
      moduleId: 'quadrado',
    });
    expect(added.ok).toBe(true);
    if (added.ok) {
      expect(added.layout.bins).toHaveLength(base.bins.length + 1);
      expectValid(added.layout);
      const removed = removeBin(added.layout, 'nova');
      expect(removed.bins).toHaveLength(base.bins.length);
    }
  });

  it('recusa acrescentar quando a gaveta está cheia', () => {
    const full = packLayout([request('a', ['grande'])], 6, 4);
    const result = addBin(full, {
      key: 'nova',
      groupId: 'custom',
      name: 'Nova',
      color: '#eee',
      moduleId: 'quadrado',
    });
    expect(result.ok).toBe(false);
  });
});
