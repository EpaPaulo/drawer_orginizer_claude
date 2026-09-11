/**
 * Geração dos ficheiros STL das caixas.
 *
 * Cada caixa é um tabuleiro aberto no topo: um bloco exterior com um bolso
 * retangular escavado. São 14 quadriláteros (28 triângulos) e a malha é
 * fechada — fundo, paredes exteriores, aro do topo, paredes interiores e fundo
 * do bolso — para que fatiadores como o PrusaSlicer ou o Cura a aceitem sem
 * reparações.
 */

export type Vec3 = readonly [number, number, number];

export interface Triangle {
  normal: Vec3;
  vertices: readonly [Vec3, Vec3, Vec3];
}

export interface TraySpec {
  /** Dimensões exteriores em milímetros. */
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Espessura das paredes e do fundo. */
  wallMm: number;
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (length === 0) return [0, 0, 0];
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * Dois triângulos a partir de quatro vértices em sentido anti-horário visto
 * de fora. A normal vem do próprio enrolamento, para não haver hipótese de
 * ficar dessincronizada dos vértices.
 */
function quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3): Triangle[] {
  const normal = normalize(cross(subtract(b, a), subtract(c, a)));
  return [
    { normal, vertices: [a, b, c] },
    { normal, vertices: [a, c, d] },
  ];
}

/** Malha de um tabuleiro aberto, com o canto inferior esquerdo na origem. */
export function trayTriangles(spec: TraySpec): Triangle[] {
  const { widthMm: w, depthMm: d, heightMm: h, wallMm: t } = spec;

  if (!(w > 2 * t) || !(d > 2 * t) || !(h > t)) {
    throw new Error('A caixa é demasiado pequena para a espessura de parede pedida.');
  }

  // Limites do bolso interior.
  const x0 = t;
  const x1 = w - t;
  const y0 = t;
  const y1 = d - t;

  return [
    // Fundo exterior (normal para baixo).
    ...quad([0, 0, 0], [0, d, 0], [w, d, 0], [w, 0, 0]),

    // Paredes exteriores, em circuito anti-horário visto de cima.
    ...quad([0, 0, 0], [w, 0, 0], [w, 0, h], [0, 0, h]),
    ...quad([w, 0, 0], [w, d, 0], [w, d, h], [w, 0, h]),
    ...quad([w, d, 0], [0, d, 0], [0, d, h], [w, d, h]),
    ...quad([0, d, 0], [0, 0, 0], [0, 0, h], [0, d, h]),

    // Aro do topo: a moldura entre o contorno exterior e o bolso.
    ...quad([0, 0, h], [w, 0, h], [x1, y0, h], [x0, y0, h]),
    ...quad([w, 0, h], [w, d, h], [x1, y1, h], [x1, y0, h]),
    ...quad([w, d, h], [0, d, h], [x0, y1, h], [x1, y1, h]),
    ...quad([0, d, h], [0, 0, h], [x0, y0, h], [x0, y1, h]),

    // Paredes do bolso, com as normais viradas para dentro.
    ...quad([x1, y0, t], [x0, y0, t], [x0, y0, h], [x1, y0, h]),
    ...quad([x1, y1, t], [x1, y0, t], [x1, y0, h], [x1, y1, h]),
    ...quad([x0, y1, t], [x1, y1, t], [x1, y1, h], [x0, y1, h]),
    ...quad([x0, y0, t], [x0, y1, t], [x0, y1, h], [x0, y0, h]),

    // Fundo do bolso (normal para cima).
    ...quad([x0, y0, t], [x1, y0, t], [x1, y1, t], [x0, y1, t]),
  ];
}

/** Volume de material do tabuleiro, em mm³ (bloco exterior menos o bolso). */
export function trayVolumeMm3(spec: TraySpec): number {
  const { widthMm: w, depthMm: d, heightMm: h, wallMm: t } = spec;
  const pocket = Math.max(0, w - 2 * t) * Math.max(0, d - 2 * t) * Math.max(0, h - t);
  return w * d * h - pocket;
}

/** Densidade do PLA, em g/cm³ — usada para estimar o filamento necessário. */
export const PLA_DENSITY_G_CM3 = 1.24;

/**
 * Estimativa de filamento para uma peça sólida nas paredes. Impressões reais
 * usam enchimento parcial, por isso o valor é um teto, não uma previsão.
 */
export function trayFilamentGrams(spec: TraySpec): number {
  return (trayVolumeMm3(spec) / 1000) * PLA_DENSITY_G_CM3;
}

export function translateTriangles(
  triangles: readonly Triangle[],
  dx: number,
  dy: number,
): Triangle[] {
  const shift = (v: Vec3): Vec3 => [v[0] + dx, v[1] + dy, v[2]];
  return triangles.map(({ normal, vertices: [a, b, c] }) => ({
    normal,
    vertices: [shift(a), shift(b), shift(c)],
  }));
}

/** STL binário: cabeçalho de 80 bytes, contagem e 50 bytes por triângulo. */
export function encodeBinaryStl(triangles: readonly Triangle[], header: string): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // O cabeçalho tem de caber em 80 bytes ASCII; o resto fica a zero.
  const headerBytes = new TextEncoder().encode(header);
  bytes.set(headerBytes.subarray(0, 80), 0);

  view.setUint32(80, triangles.length, true);

  let offset = 84;
  for (const triangle of triangles) {
    view.setFloat32(offset, triangle.normal[0], true);
    view.setFloat32(offset + 4, triangle.normal[1], true);
    view.setFloat32(offset + 8, triangle.normal[2], true);
    offset += 12;
    for (const vertex of triangle.vertices) {
      view.setFloat32(offset, vertex[0], true);
      view.setFloat32(offset + 4, vertex[1], true);
      view.setFloat32(offset + 8, vertex[2], true);
      offset += 12;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
}

export function trayStl(spec: TraySpec, header: string): ArrayBuffer {
  return encodeBinaryStl(trayTriangles(spec), header);
}

/**
 * Várias caixas num só ficheiro, alinhadas lado a lado com folga entre elas,
 * prontas a abrir de uma vez no fatiador.
 */
export function plateStl(
  specs: readonly TraySpec[],
  header: string,
  gapMm = 5,
): ArrayBuffer {
  const triangles: Triangle[] = [];
  let cursorX = 0;
  for (const spec of specs) {
    triangles.push(...translateTriangles(trayTriangles(spec), cursorX, 0));
    cursorX += spec.widthMm + gapMm;
  }
  return encodeBinaryStl(triangles, header);
}
