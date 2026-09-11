/**
 * Módulos ORGANIZA.
 *
 * Todos os organizadores são múltiplos de um módulo base de 40 mm, o que
 * permite combiná-los em qualquer gaveta sem sobras irregulares. Os cinco
 * formatos abaixo são os apresentados na proposta (8, 12, 16 e 24 cm).
 */

/** Lado do módulo base, em milímetros. */
export const UNIT_MM = 40;

/** Espessura de parede e de fundo das caixas impressas, em milímetros. */
export const WALL_MM = 2;

/** Folga vertical deixada entre o topo da caixa e o topo da gaveta. */
export const HEIGHT_CLEARANCE_MM = 5;

/** Limites de altura útil de uma caixa (impressão razoável). */
export const MIN_BOX_HEIGHT_MM = 20;
export const MAX_BOX_HEIGHT_MM = 120;

export type ModuleId = 'quadrado' | 'pequeno' | 'longo' | 'medio' | 'grande';

export interface ModuleSpec {
  id: ModuleId;
  /** Nome apresentado ao utilizador. */
  name: string;
  /** Largura em módulos base. */
  w: number;
  /** Profundidade em módulos base. */
  d: number;
}

export const MODULES: readonly ModuleSpec[] = [
  { id: 'quadrado', name: 'Quadrado', w: 2, d: 2 },
  { id: 'pequeno', name: 'Pequeno', w: 3, d: 2 },
  { id: 'longo', name: 'Longo', w: 6, d: 2 },
  { id: 'medio', name: 'Médio', w: 4, d: 3 },
  { id: 'grande', name: 'Grande', w: 6, d: 4 },
];

const BY_ID = new Map<ModuleId, ModuleSpec>(MODULES.map((m) => [m.id, m]));

export function moduleById(id: ModuleId): ModuleSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`Módulo desconhecido: ${id}`);
  return spec;
}

/** Área do módulo, em módulos base. */
export function moduleArea(id: ModuleId): number {
  const m = moduleById(id);
  return m.w * m.d;
}

/** Etiqueta de dimensões, ex.: "24 × 16 cm". */
export function moduleLabel(id: ModuleId): string {
  const m = moduleById(id);
  return `${unitsToCm(m.w)} × ${unitsToCm(m.d)} cm`;
}

export function unitsToMm(units: number): number {
  return units * UNIT_MM;
}

export function unitsToCm(units: number): number {
  return (units * UNIT_MM) / 10;
}

/**
 * Grelha de módulos que cabe numa gaveta, e a sobra em cada eixo.
 * A sobra é o espaço que fica livre por não dar um módulo inteiro.
 */
export interface DrawerGrid {
  cols: number;
  rows: number;
  slackWidthMm: number;
  slackDepthMm: number;
}

export function drawerGrid(widthMm: number, depthMm: number): DrawerGrid {
  const cols = Math.max(0, Math.floor(widthMm / UNIT_MM));
  const rows = Math.max(0, Math.floor(depthMm / UNIT_MM));
  return {
    cols,
    rows,
    slackWidthMm: Math.round(widthMm - cols * UNIT_MM),
    slackDepthMm: Math.round(depthMm - rows * UNIT_MM),
  };
}

/**
 * Altura das caixas para uma dada altura útil de gaveta: ocupa a altura
 * disponível menos uma folga, dentro dos limites de impressão.
 */
export function boxHeightMm(drawerHeightMm: number): number {
  const target = drawerHeightMm - HEIGHT_CLEARANCE_MM;
  return Math.round(Math.min(MAX_BOX_HEIGHT_MM, Math.max(MIN_BOX_HEIGHT_MM, target)));
}
