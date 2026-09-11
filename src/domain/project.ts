/**
 * O projeto do utilizador: medidas da gaveta, grupos escolhidos e a
 * distribuição gerada. Guardado no navegador, sem conta e sem servidor.
 */

import {
  AMOUNTS,
  DEFAULT_GROUP_IDS,
  GROUP_CATALOG,
  groupById,
  modulePreferences,
  type Amount,
  type Shape,
} from './groups';
import {
  boxHeightMm,
  drawerGrid,
  moduleById,
  moduleLabel,
  unitsToMm,
  WALL_MM,
  type ModuleId,
} from './modules';
import { packLayout, type BinRequest, type Layout } from './solver';
import { trayFilamentGrams, type TraySpec } from './stl';

export const LIMITS = {
  widthMm: { min: 100, max: 1200 },
  depthMm: { min: 100, max: 1200 },
  heightMm: { min: 20, max: 300 },
} as const;

/** Uma gaveta com menos de 2×2 módulos não dá para organizar. */
export const MIN_UNITS_PER_SIDE = 2;

export type Output = 'files' | 'kit';

export interface SelectedGroup {
  /** Identidade estável da caixa correspondente. */
  key: string;
  /** Id do catálogo, ou 'custom' para um grupo escrito pelo utilizador. */
  groupId: string;
  name: string;
  hint: string;
  shape: Shape;
  amount: Amount;
  color: string;
}

export interface Project {
  version: 1;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Fotografia da gaveta, redimensionada, em dataURL. Nunca sai do navegador. */
  photo: string | null;
  groups: SelectedGroup[];
  layout: Layout | null;
  output: Output;
  printerBedMm: { w: number; d: number };
}

export function selectedGroupFromCatalog(id: string, key = id): SelectedGroup | null {
  const spec = groupById(id);
  if (!spec) return null;
  return {
    key,
    groupId: spec.id,
    name: spec.name,
    hint: spec.hint,
    shape: spec.shape,
    amount: spec.defaultAmount,
    color: spec.color,
  };
}

export function createProject(): Project {
  return {
    version: 1,
    widthMm: 420,
    depthMm: 420,
    heightMm: 70,
    photo: null,
    groups: DEFAULT_GROUP_IDS.map((id) => selectedGroupFromCatalog(id)).filter(
      (g): g is SelectedGroup => g !== null,
    ),
    layout: null,
    output: 'files',
    printerBedMm: { w: 220, d: 220 },
  };
}

export function dimensionErrors(project: Project): string[] {
  const errors: string[] = [];
  const check = (value: number, limit: { min: number; max: number }, label: string) => {
    if (!Number.isFinite(value) || value < limit.min || value > limit.max) {
      errors.push(`${label} tem de estar entre ${limit.min} e ${limit.max} mm.`);
    }
  };
  check(project.widthMm, LIMITS.widthMm, 'A largura');
  check(project.depthMm, LIMITS.depthMm, 'A profundidade');
  check(project.heightMm, LIMITS.heightMm, 'A altura útil');

  if (errors.length === 0) {
    const grid = drawerGrid(project.widthMm, project.depthMm);
    if (grid.cols < MIN_UNITS_PER_SIDE || grid.rows < MIN_UNITS_PER_SIDE) {
      errors.push(
        `A gaveta precisa de ter pelo menos ${MIN_UNITS_PER_SIDE * 4} cm de cada lado para levar caixas modulares.`,
      );
    }
  }
  return errors;
}

export function buildRequests(groups: readonly SelectedGroup[]): BinRequest[] {
  return groups.map((group) => ({
    key: group.key,
    groupId: group.groupId,
    name: group.name,
    color: group.color,
    preferences: modulePreferences(group.shape, group.amount),
  }));
}

export function generateLayout(project: Project): Layout {
  const grid = drawerGrid(project.widthMm, project.depthMm);
  return packLayout(buildRequests(project.groups), grid.cols, grid.rows);
}

export interface TallyEntry {
  moduleId: ModuleId;
  name: string;
  label: string;
  count: number;
  /** Dimensões exteriores de uma caixa, em mm. */
  widthMm: number;
  depthMm: number;
}

/** Quantas caixas de cada módulo o projeto precisa. */
export function moduleTally(layout: Layout): TallyEntry[] {
  const counts = new Map<ModuleId, number>();
  for (const bin of layout.bins) {
    counts.set(bin.moduleId, (counts.get(bin.moduleId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([moduleId, count]) => {
      const spec = moduleById(moduleId);
      return {
        moduleId,
        name: spec.name,
        label: moduleLabel(moduleId),
        count,
        widthMm: unitsToMm(spec.w),
        depthMm: unitsToMm(spec.d),
      };
    })
    .sort((a, b) => b.widthMm * b.depthMm - a.widthMm * a.depthMm);
}

export function traySpecFor(entry: TallyEntry, drawerHeightMm: number): TraySpec {
  return {
    widthMm: entry.widthMm,
    depthMm: entry.depthMm,
    heightMm: boxHeightMm(drawerHeightMm),
    wallMm: WALL_MM,
  };
}

/** Uma caixa cabe na base da impressora, em qualquer das duas orientações? */
export function fitsPrinterBed(entry: TallyEntry, bed: { w: number; d: number }): boolean {
  const straight = entry.widthMm <= bed.w && entry.depthMm <= bed.d;
  const turned = entry.depthMm <= bed.w && entry.widthMm <= bed.d;
  return straight || turned;
}

export function totalFilamentGrams(layout: Layout, drawerHeightMm: number): number {
  return moduleTally(layout).reduce(
    (total, entry) => total + entry.count * trayFilamentGrams(traySpecFor(entry, drawerHeightMm)),
    0,
  );
}

function amountLabel(amount: Amount): string {
  return AMOUNTS.find((a) => a.id === amount)?.label ?? amount;
}

/** Resumo do projeto em texto, para guardar ou enviar. */
export function projectSummary(project: Project): string {
  const grid = drawerGrid(project.widthMm, project.depthMm);
  const lines: string[] = [
    'ORGANIZA — resumo do projeto',
    '',
    `Gaveta (medidas interiores): ${project.widthMm} × ${project.depthMm} × ${project.heightMm} mm`,
    `Grelha de módulos: ${grid.cols} × ${grid.rows} módulos de 40 mm`,
    `Sobra: ${grid.slackWidthMm} mm na largura, ${grid.slackDepthMm} mm na profundidade`,
    `Altura das caixas: ${boxHeightMm(project.heightMm)} mm`,
    '',
    'Grupos:',
    ...project.groups.map((g) => `  · ${g.name} — ${amountLabel(g.amount)} (${g.shape})`),
  ];

  if (project.layout) {
    const tally = moduleTally(project.layout);
    lines.push(
      '',
      'Caixas a produzir:',
      ...tally.map((t) => `  · ${t.count} × ${t.name} (${t.label})`),
      '',
      'Posições na gaveta (canto superior esquerdo, em mm):',
      ...project.layout.bins.map(
        (b) =>
          `  · ${b.name}: ${unitsToMm(b.w)} × ${unitsToMm(b.d)} mm em x=${unitsToMm(b.x)}, y=${unitsToMm(b.y)}`,
      ),
      '',
      `Filamento estimado (paredes sólidas): ${Math.round(totalFilamentGrams(project.layout, project.heightMm))} g`,
    );
    if (project.layout.unplaced.length > 0) {
      lines.push(
        '',
        'Sem espaço nesta gaveta:',
        ...project.layout.unplaced.map((u) => `  · ${u.name}`),
      );
    }
  }

  lines.push(
    '',
    `Produção escolhida: ${project.output === 'files' ? 'imprimir em casa' : 'receber um kit'}`,
    '',
    'As medidas das caixas são exteriores. Confirma-as na gaveta antes de imprimir.',
  );

  return lines.join('\n');
}

const STORAGE_KEY = 'organiza.project.v1';

export function saveProject(project: Project): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Espaço esgotado ou armazenamento bloqueado: o projeto continua em memória.
  }
}

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem armazenamento não há nada para limpar.
  }
}

/**
 * Validação do que vem do armazenamento ou de um ficheiro importado: aceita
 * apenas a forma esperada, para não rebentar com dados antigos ou alterados.
 */
export function isProject(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<Project>;
  return (
    p.version === 1 &&
    typeof p.widthMm === 'number' &&
    typeof p.depthMm === 'number' &&
    typeof p.heightMm === 'number' &&
    (p.photo === null || typeof p.photo === 'string') &&
    Array.isArray(p.groups) &&
    p.groups.every(isSelectedGroup) &&
    (p.layout === null || isLayout(p.layout)) &&
    (p.output === 'files' || p.output === 'kit') &&
    typeof p.printerBedMm === 'object' &&
    p.printerBedMm !== null &&
    typeof p.printerBedMm.w === 'number' &&
    typeof p.printerBedMm.d === 'number'
  );
}

function isLayout(value: unknown): value is Layout {
  if (typeof value !== 'object' || value === null) return false;
  const l = value as Partial<Layout>;
  return (
    typeof l.cols === 'number' &&
    typeof l.rows === 'number' &&
    Array.isArray(l.bins) &&
    l.bins.every(isPlacedBin) &&
    Array.isArray(l.unplaced)
  );
}

function isPlacedBin(value: unknown): value is Layout['bins'][number] {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b['key'] === 'string' &&
    typeof b['name'] === 'string' &&
    typeof b['color'] === 'string' &&
    typeof b['moduleId'] === 'string' &&
    ['x', 'y', 'w', 'd'].every((k) => Number.isInteger(b[k]))
  );
}

function isSelectedGroup(value: unknown): value is SelectedGroup {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Partial<SelectedGroup>;
  return (
    typeof g.key === 'string' &&
    typeof g.groupId === 'string' &&
    typeof g.name === 'string' &&
    typeof g.hint === 'string' &&
    typeof g.color === 'string' &&
    (g.shape === 'compacto' || g.shape === 'alongado' || g.shape === 'amplo') &&
    (g.amount === 'pouco' || g.amount === 'medio' || g.amount === 'muito')
  );
}

/** Chave nova e única para acrescentar um grupo já presente. */
export function uniqueKey(groups: readonly SelectedGroup[], base: string): string {
  if (!groups.some((g) => g.key === base)) return base;
  let n = 2;
  while (groups.some((g) => g.key === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export { GROUP_CATALOG };
