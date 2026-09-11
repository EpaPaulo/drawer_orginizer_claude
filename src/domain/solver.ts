/**
 * Distribuição das caixas na gaveta.
 *
 * A gaveta é tratada como uma grelha de módulos base (40 mm). Cada grupo pede
 * um módulo; o solver coloca-os do maior para o menor, na primeira posição
 * livre a contar do fundo da gaveta, experimentando as duas orientações. Quando
 * o módulo preferido não cabe, desce na lista de preferências do grupo antes de
 * desistir — é isso que permite explicar ao utilizador *porquê* uma caixa ficou
 * mais pequena do que o pedido.
 */

import { moduleArea, moduleById, type ModuleId } from './modules';

export interface BinRequest {
  /** Identidade estável da caixa, entre repackings e edições. */
  key: string;
  groupId: string;
  name: string;
  color: string;
  /** Módulos aceitáveis, do preferido ao mínimo tolerável. */
  preferences: ModuleId[];
}

export interface PlacedBin {
  key: string;
  groupId: string;
  name: string;
  color: string;
  moduleId: ModuleId;
  /** Canto superior esquerdo, em módulos base. */
  x: number;
  y: number;
  /** Dimensões já com a rotação aplicada, em módulos base. */
  w: number;
  d: number;
  rotated: boolean;
  /** Ficou com um módulo menor do que o preferido por falta de espaço. */
  downgraded: boolean;
}

export interface FreeRect {
  x: number;
  y: number;
  w: number;
  d: number;
}

export interface Layout {
  cols: number;
  rows: number;
  bins: PlacedBin[];
  /** Grupos que não couberam de todo. */
  unplaced: BinRequest[];
}

export type EditResult =
  | { ok: true; layout: Layout }
  | { ok: false; reason: string };

type Grid = boolean[];

function makeGrid(cols: number, rows: number): Grid {
  return new Array<boolean>(cols * rows).fill(false);
}

function occupy(grid: Grid, cols: number, bin: { x: number; y: number; w: number; d: number }) {
  for (let y = bin.y; y < bin.y + bin.d; y++) {
    for (let x = bin.x; x < bin.x + bin.w; x++) {
      grid[y * cols + x] = true;
    }
  }
}

/** Grelha de ocupação a partir das caixas colocadas, opcionalmente ignorando uma. */
export function buildOccupancy(
  bins: readonly PlacedBin[],
  cols: number,
  rows: number,
  exceptKey?: string,
): Grid {
  const grid = makeGrid(cols, rows);
  for (const bin of bins) {
    if (bin.key === exceptKey) continue;
    occupy(grid, cols, bin);
  }
  return grid;
}

export function fitsAt(
  grid: Grid,
  cols: number,
  rows: number,
  x: number,
  y: number,
  w: number,
  d: number,
): boolean {
  if (x < 0 || y < 0 || x + w > cols || y + d > rows) return false;
  for (let yy = y; yy < y + d; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (grid[yy * cols + xx]) return false;
    }
  }
  return true;
}

/** Primeira posição livre, varrendo por linhas (caixas encostam ao fundo). */
function findSpot(
  grid: Grid,
  cols: number,
  rows: number,
  w: number,
  d: number,
): { x: number; y: number } | null {
  for (let y = 0; y + d <= rows; y++) {
    for (let x = 0; x + w <= cols; x++) {
      if (fitsAt(grid, cols, rows, x, y, w, d)) return { x, y };
    }
  }
  return null;
}

/** Orientações a experimentar para um módulo (sem repetir quando é quadrado). */
function orientations(moduleId: ModuleId): { w: number; d: number; rotated: boolean }[] {
  const m = moduleById(moduleId);
  if (m.w === m.d) return [{ w: m.w, d: m.d, rotated: false }];
  return [
    { w: m.w, d: m.d, rotated: false },
    { w: m.d, d: m.w, rotated: true },
  ];
}

/**
 * Coloca o pedido na grelha, descendo na lista de preferências até caber.
 * Com `smallestOnly`, salta direto ao módulo mínimo que o grupo aceita.
 * Devolve null quando nem esse cabe.
 */
function place(
  request: BinRequest,
  grid: Grid,
  cols: number,
  rows: number,
  smallestOnly: boolean,
): PlacedBin | null {
  const candidates = smallestOnly ? request.preferences.slice(-1) : request.preferences;

  for (const moduleId of candidates) {
    for (const orientation of orientations(moduleId)) {
      const spot = findSpot(grid, cols, rows, orientation.w, orientation.d);
      if (!spot) continue;
      const bin: PlacedBin = {
        key: request.key,
        groupId: request.groupId,
        name: request.name,
        color: request.color,
        moduleId,
        x: spot.x,
        y: spot.y,
        w: orientation.w,
        d: orientation.d,
        rotated: orientation.rotated,
        downgraded: moduleId !== request.preferences[0],
      };
      occupy(grid, cols, bin);
      return bin;
    }
  }
  return null;
}

/** Área do módulo preferido — usada para ordenar do maior para o menor. */
function preferredArea(request: BinRequest): number {
  const first = request.preferences[0];
  return first ? moduleArea(first) : 0;
}

function packOnce(
  requests: readonly BinRequest[],
  cols: number,
  rows: number,
  smallestOnly: boolean,
): Layout {
  const grid = makeGrid(cols, rows);
  const bins: PlacedBin[] = [];
  const unplaced: BinRequest[] = [];

  // Ordenação estável: maiores primeiro, empates pela ordem de entrada.
  const ordered = [...requests].sort((a, b) => preferredArea(b) - preferredArea(a));

  for (const request of ordered) {
    const bin = place(request, grid, cols, rows, smallestOnly);
    if (bin) bins.push(bin);
    else unplaced.push(request);
  }

  return { cols, rows, bins, unplaced };
}

/**
 * Numa gaveta apertada, servir o primeiro grupo no tamanho que pediu pode
 * deixar todos os outros de fora. Por isso, quando alguém fica sem lugar, há
 * uma segunda tentativa com toda a gente no módulo mínimo que aceita: fica a
 * distribuição que arruma mais grupos. É melhor ter todos os grupos em caixas
 * pequenas do que um grupo numa caixa grande e o resto na gaveta à solta.
 */
export function packLayout(
  requests: readonly BinRequest[],
  cols: number,
  rows: number,
): Layout {
  const generous = packOnce(requests, cols, rows, false);
  if (generous.unplaced.length === 0) return generous;

  const compact = packOnce(requests, cols, rows, true);
  return compact.bins.length > generous.bins.length ? compact : generous;
}

/**
 * Partição do espaço livre em retângulos, para mostrar onde ainda cabe alguma
 * coisa. Varre por linhas: cresce em largura e depois em profundidade.
 */
export function freeRectangles(layout: Layout): FreeRect[] {
  const { cols, rows } = layout;
  const grid = buildOccupancy(layout.bins, cols, rows);
  const rects: FreeRect[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y * cols + x]) continue;

      let w = 0;
      while (x + w < cols && !grid[y * cols + x + w]) w++;

      let d = 1;
      grow: while (y + d < rows) {
        for (let xx = x; xx < x + w; xx++) {
          if (grid[(y + d) * cols + xx]) break grow;
        }
        d++;
      }

      rects.push({ x, y, w, d });
      occupy(grid, cols, { x, y, w, d });
    }
  }

  return rects;
}

export function usedUnits(layout: Layout): number {
  return layout.bins.reduce((total, bin) => total + bin.w * bin.d, 0);
}

function replaceBin(layout: Layout, key: string, next: PlacedBin): Layout {
  return { ...layout, bins: layout.bins.map((bin) => (bin.key === key ? next : bin)) };
}

function requireBin(layout: Layout, key: string): PlacedBin | undefined {
  return layout.bins.find((bin) => bin.key === key);
}

/** Move uma caixa para uma posição da grelha, se estiver livre. */
export function moveBin(layout: Layout, key: string, x: number, y: number): EditResult {
  const bin = requireBin(layout, key);
  if (!bin) return { ok: false, reason: 'Caixa não encontrada.' };
  if (bin.x === x && bin.y === y) return { ok: true, layout };

  const grid = buildOccupancy(layout.bins, layout.cols, layout.rows, key);
  if (!fitsAt(grid, layout.cols, layout.rows, x, y, bin.w, bin.d)) {
    return { ok: false, reason: 'Não há espaço livre nessa posição.' };
  }
  return { ok: true, layout: replaceBin(layout, key, { ...bin, x, y }) };
}

/** Roda uma caixa 90°, mantendo-a no sítio se possível. */
export function rotateBin(layout: Layout, key: string): EditResult {
  const bin = requireBin(layout, key);
  if (!bin) return { ok: false, reason: 'Caixa não encontrada.' };
  if (bin.w === bin.d) return { ok: false, reason: 'Uma caixa quadrada não muda ao rodar.' };

  const grid = buildOccupancy(layout.bins, layout.cols, layout.rows, key);
  const rotated: PlacedBin = { ...bin, w: bin.d, d: bin.w, rotated: !bin.rotated };

  if (fitsAt(grid, layout.cols, layout.rows, rotated.x, rotated.y, rotated.w, rotated.d)) {
    return { ok: true, layout: replaceBin(layout, key, rotated) };
  }

  const spot = findSpot(grid, layout.cols, layout.rows, rotated.w, rotated.d);
  if (!spot) return { ok: false, reason: 'Não há espaço para rodar esta caixa.' };
  return { ok: true, layout: replaceBin(layout, key, { ...rotated, ...spot }) };
}

/** Troca o módulo de uma caixa, preferindo manter o canto onde já está. */
export function changeModule(layout: Layout, key: string, moduleId: ModuleId): EditResult {
  const bin = requireBin(layout, key);
  if (!bin) return { ok: false, reason: 'Caixa não encontrada.' };

  const grid = buildOccupancy(layout.bins, layout.cols, layout.rows, key);

  for (const orientation of orientations(moduleId)) {
    if (fitsAt(grid, layout.cols, layout.rows, bin.x, bin.y, orientation.w, orientation.d)) {
      return {
        ok: true,
        layout: replaceBin(layout, key, { ...bin, moduleId, ...orientation, downgraded: false }),
      };
    }
  }

  for (const orientation of orientations(moduleId)) {
    const spot = findSpot(grid, layout.cols, layout.rows, orientation.w, orientation.d);
    if (spot) {
      return {
        ok: true,
        layout: replaceBin(layout, key, {
          ...bin,
          moduleId,
          ...orientation,
          ...spot,
          downgraded: false,
        }),
      };
    }
  }

  return { ok: false, reason: 'Esse módulo não cabe no espaço que resta.' };
}

export function removeBin(layout: Layout, key: string): Layout {
  return { ...layout, bins: layout.bins.filter((bin) => bin.key !== key) };
}

export function renameBin(layout: Layout, key: string, name: string): Layout {
  return {
    ...layout,
    bins: layout.bins.map((bin) => (bin.key === key ? { ...bin, name } : bin)),
  };
}

/** Acrescenta uma caixa, opcionalmente numa posição pedida. */
export function addBin(
  layout: Layout,
  bin: Omit<PlacedBin, 'x' | 'y' | 'w' | 'd' | 'rotated' | 'downgraded'>,
  at?: { x: number; y: number },
): EditResult {
  const grid = buildOccupancy(layout.bins, layout.cols, layout.rows);

  for (const orientation of orientations(bin.moduleId)) {
    const spot =
      at && fitsAt(grid, layout.cols, layout.rows, at.x, at.y, orientation.w, orientation.d)
        ? at
        : at
          ? null
          : findSpot(grid, layout.cols, layout.rows, orientation.w, orientation.d);
    if (!spot) continue;
    const placed: PlacedBin = { ...bin, ...orientation, ...spot, downgraded: false };
    return { ok: true, layout: { ...layout, bins: [...layout.bins, placed] } };
  }

  return { ok: false, reason: 'Não há espaço livre para mais uma caixa desse tamanho.' };
}
