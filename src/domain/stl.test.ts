import { describe, expect, it } from 'vitest';

import {
  encodeBinaryStl,
  plateStl,
  translateTriangles,
  trayTriangles,
  trayVolumeMm3,
  type TraySpec,
  type Triangle,
} from './stl';

const spec: TraySpec = { widthMm: 240, depthMm: 160, heightMm: 65, wallMm: 2 };

function edgeKey(a: readonly number[], b: readonly number[]): string {
  return `${a.join()}|${b.join()}`;
}

/**
 * Volume assinado pelo teorema da divergência. Positivo significa que os
 * triângulos estão enrolados com as normais para fora.
 */
function signedVolume(triangles: readonly Triangle[]): number {
  let total = 0;
  for (const { vertices: [a, b, c] } of triangles) {
    total +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return total / 6;
}

describe('trayTriangles', () => {
  it('produz 28 triângulos — 14 quadriláteros', () => {
    expect(trayTriangles(spec)).toHaveLength(28);
  });

  it('gera uma malha fechada: cada aresta tem exatamente um par oposto', () => {
    const triangles = trayTriangles(spec);
    const edges = new Map<string, number>();

    for (const { vertices: [a, b, c] } of triangles) {
      for (const [from, to] of [
        [a, b],
        [b, c],
        [c, a],
      ] as const) {
        const key = edgeKey(from, to);
        expect(edges.has(key), `aresta repetida: ${key}`).toBe(false);
        edges.set(key, 1);
      }
    }

    for (const key of edges.keys()) {
      const [from, to] = key.split('|');
      expect(edges.has(`${to}|${from}`), `aresta sem par: ${key}`).toBe(true);
    }
  });

  it('tem as normais viradas para fora e o volume correto', () => {
    const triangles = trayTriangles(spec);
    expect(signedVolume(triangles)).toBeCloseTo(trayVolumeMm3(spec), 3);
    expect(signedVolume(triangles)).toBeGreaterThan(0);
  });

  it('tem normais unitárias coerentes com o enrolamento', () => {
    for (const { normal } of trayTriangles(spec)) {
      expect(Math.hypot(...normal)).toBeCloseTo(1, 6);
    }
  });

  it('mantém-se dentro das dimensões exteriores pedidas', () => {
    for (const { vertices } of trayTriangles(spec)) {
      for (const [x, y, z] of vertices) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(spec.widthMm);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(spec.depthMm);
        expect(z).toBeGreaterThanOrEqual(0);
        expect(z).toBeLessThanOrEqual(spec.heightMm);
      }
    }
  });

  it('recusa caixas mais finas do que duas paredes', () => {
    expect(() => trayTriangles({ ...spec, widthMm: 4, wallMm: 2 })).toThrow();
  });
});

describe('trayVolumeMm3', () => {
  it('desconta o bolso do bloco exterior', () => {
    const outer = spec.widthMm * spec.depthMm * spec.heightMm;
    const pocket = (spec.widthMm - 4) * (spec.depthMm - 4) * (spec.heightMm - 2);
    expect(trayVolumeMm3(spec)).toBe(outer - pocket);
  });
});

describe('encodeBinaryStl', () => {
  it('escreve o cabeçalho, a contagem e 50 bytes por triângulo', () => {
    const triangles = trayTriangles(spec);
    const buffer = encodeBinaryStl(triangles, 'ORGANIZA');
    expect(buffer.byteLength).toBe(84 + triangles.length * 50);

    const view = new DataView(buffer);
    expect(view.getUint32(80, true)).toBe(triangles.length);

    const header = new TextDecoder().decode(new Uint8Array(buffer, 0, 8));
    expect(header).toBe('ORGANIZA');
  });

  it('trunca cabeçalhos com mais de 80 bytes', () => {
    const buffer = encodeBinaryStl(trayTriangles(spec), 'x'.repeat(200));
    expect(new DataView(buffer).getUint32(80, true)).toBe(28);
  });

  it('escreve o primeiro vértice tal como está na malha', () => {
    const triangles = trayTriangles(spec);
    const view = new DataView(encodeBinaryStl(triangles, ''));
    const first = triangles[0]!.vertices[0];
    expect(view.getFloat32(84 + 12, true)).toBeCloseTo(first[0], 3);
    expect(view.getFloat32(84 + 16, true)).toBeCloseTo(first[1], 3);
    expect(view.getFloat32(84 + 20, true)).toBeCloseTo(first[2], 3);
  });
});

describe('plateStl', () => {
  it('junta várias caixas num só ficheiro, sem as sobrepor', () => {
    const specs = [spec, { ...spec, widthMm: 120 }];
    const buffer = plateStl(specs, 'ORGANIZA', 5);
    expect(new DataView(buffer).getUint32(80, true)).toBe(56);
  });

  it('desloca a segunda caixa para lá da primeira', () => {
    const moved = translateTriangles(trayTriangles(spec), spec.widthMm + 5, 0);
    const minX = Math.min(...moved.flatMap((t) => t.vertices.map((v) => v[0])));
    expect(minX).toBe(spec.widthMm + 5);
  });
});
