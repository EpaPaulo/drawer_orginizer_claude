/**
 * Catálogo de grupos típicos de uma gaveta de casa.
 *
 * Cada grupo tem uma forma preferida (compacto, alongado ou amplo) e uma
 * quantidade escolhida pelo utilizador. A combinação das duas dá uma lista
 * ordenada de módulos: o solver tenta o primeiro e desce na lista quando
 * não há espaço, em vez de deixar o grupo de fora.
 */

import type { ModuleId } from './modules';

export type Shape = 'compacto' | 'alongado' | 'amplo';
export type Amount = 'pouco' | 'medio' | 'muito';

export const AMOUNTS: readonly { id: Amount; label: string }[] = [
  { id: 'pouco', label: 'Pouco' },
  { id: 'medio', label: 'Médio' },
  { id: 'muito', label: 'Muito' },
];

export interface GroupSpec {
  id: string;
  name: string;
  /** Exemplos do que costuma entrar neste grupo. */
  hint: string;
  shape: Shape;
  /** Quantidade sugerida quando o grupo é selecionado. */
  defaultAmount: Amount;
  /** Cor da etiqueta no esquema da gaveta. */
  color: string;
  /** Sugerido por omissão no primeiro arranque. */
  common?: boolean;
}

/**
 * Tons suaves, legíveis com texto escuro por cima, na linha da paleta
 * marfim/carvão/laranja da proposta.
 */
export const GROUP_CATALOG: readonly GroupSpec[] = [
  {
    id: 'escrita',
    name: 'Escrita',
    hint: 'Canetas, lápis, marcadores',
    shape: 'alongado',
    defaultAmount: 'medio',
    color: '#cfe6cd',
    common: true,
  },
  {
    id: 'cabos',
    name: 'Cabos e carregadores',
    hint: 'Cabos USB, transformadores, auriculares',
    shape: 'amplo',
    defaultAmount: 'medio',
    color: '#d7e8dd',
    common: true,
  },
  {
    id: 'fitas',
    name: 'Fitas e adesivos',
    hint: 'Fita-cola, fita isoladora, cola',
    shape: 'compacto',
    defaultAmount: 'pouco',
    color: '#f3e5b8',
    common: true,
  },
  {
    id: 'panos',
    name: 'Panos e guardanapos',
    hint: 'Panos dobrados, guardanapos, toalhetes',
    shape: 'amplo',
    defaultAmount: 'muito',
    color: '#f2d5d8',
    common: true,
  },
  {
    id: 'pequenos',
    name: 'Pequenos itens',
    hint: 'Clipes, molas, elásticos, agulhas',
    shape: 'compacto',
    defaultAmount: 'pouco',
    color: '#cfe0f0',
    common: true,
  },
  {
    id: 'ferramentas',
    name: 'Ferramentas de casa',
    hint: 'Chave de fendas, fita métrica, alicate',
    shape: 'alongado',
    defaultAmount: 'medio',
    color: '#f7d6bd',
    common: true,
  },
  {
    id: 'tesouras',
    name: 'Tesouras e x-atos',
    hint: 'Tesouras, x-ato, abre-cartas',
    shape: 'alongado',
    defaultAmount: 'pouco',
    color: '#e6dbc6',
  },
  {
    id: 'pilhas',
    name: 'Pilhas',
    hint: 'AA, AAA, pilhas-botão',
    shape: 'compacto',
    defaultAmount: 'pouco',
    color: '#e3d9ef',
  },
  {
    id: 'medicamentos',
    name: 'Medicamentos',
    hint: 'Caixas, pensos, termómetro',
    shape: 'amplo',
    defaultAmount: 'medio',
    color: '#d6e9e6',
  },
  {
    id: 'chaves',
    name: 'Chaves',
    hint: 'Chaves soltas, porta-chaves, cadeados',
    shape: 'compacto',
    defaultAmount: 'pouco',
    color: '#efdcc9',
  },
  {
    id: 'talheres',
    name: 'Talheres e utensílios',
    hint: 'Talheres, colheres de servir, palhinhas',
    shape: 'alongado',
    defaultAmount: 'muito',
    color: '#dde3ea',
  },
  {
    id: 'velas',
    name: 'Velas e fósforos',
    hint: 'Velas, fósforos, isqueiros',
    shape: 'compacto',
    defaultAmount: 'pouco',
    color: '#f0e2cf',
  },
  {
    id: 'papelaria',
    name: 'Papelaria e documentos',
    hint: 'Blocos, envelopes, recibos, manuais',
    shape: 'amplo',
    defaultAmount: 'medio',
    color: '#e4e0d4',
  },
  {
    id: 'costura',
    name: 'Costura',
    hint: 'Linhas, botões, alfinetes, dedal',
    shape: 'compacto',
    defaultAmount: 'pouco',
    color: '#efd4e2',
  },
  {
    id: 'eletronica',
    name: 'Objetos grandes',
    hint: 'Balança, comandos, estojos, canecas',
    shape: 'amplo',
    defaultAmount: 'muito',
    color: '#dcd6ee',
  },
];

const CATALOG_BY_ID = new Map(GROUP_CATALOG.map((g) => [g.id, g]));

export function groupById(id: string): GroupSpec | undefined {
  return CATALOG_BY_ID.get(id);
}

/** Grupos propostos por omissão num projeto novo. */
export const DEFAULT_GROUP_IDS: readonly string[] = GROUP_CATALOG.filter((g) => g.common).map(
  (g) => g.id,
);

/**
 * Módulos aceitáveis para um grupo, do preferido ao mínimo tolerável.
 * O solver percorre esta lista por ordem.
 */
export function modulePreferences(shape: Shape, amount: Amount): ModuleId[] {
  const table: Record<Amount, Record<Shape, ModuleId[]>> = {
    pouco: {
      compacto: ['quadrado'],
      alongado: ['pequeno', 'quadrado'],
      amplo: ['pequeno', 'quadrado'],
    },
    medio: {
      compacto: ['pequeno', 'quadrado'],
      alongado: ['longo', 'pequeno', 'quadrado'],
      amplo: ['medio', 'pequeno', 'quadrado'],
    },
    muito: {
      compacto: ['medio', 'pequeno', 'quadrado'],
      alongado: ['longo', 'medio', 'pequeno'],
      amplo: ['grande', 'medio', 'pequeno'],
    },
  };
  return [...table[amount][shape]];
}
