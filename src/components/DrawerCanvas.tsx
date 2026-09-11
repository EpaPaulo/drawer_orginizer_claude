import { useCallback, useId, useRef, useState } from 'react';

import { UNIT_MM, unitsToCm } from '../domain/modules';
import { freeRectangles, type FreeRect, type Layout, type PlacedBin } from '../domain/solver';

/** Espessura desenhada das paredes da gaveta, em mm. */
const FRAME_MM = 16;
/** Folga desenhada entre caixas vizinhas, para se distinguirem. */
const GAP_MM = 2;

const LABEL_SIZE = UNIT_MM * 0.3;
const SIZE_SIZE = UNIT_MM * 0.22;
/** Espaço entre a pastilha e a parede da caixa. */
const PILL_PAD = 5;
/**
 * Largura média de um caractere, em fração do corpo da letra. Serve para
 * decidir onde cortar o nome; o recorte SVG garante o resto.
 */
const CHAR_RATIO = 0.62;

interface Props {
  layout: Layout;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onMove: (key: string, x: number, y: number) => void;
  onAddAt: (rect: FreeRect) => void;
}

interface DragState {
  key: string;
  pointerId: number;
  /** Deslocamento entre o ponto agarrado e o canto da caixa, em mm. */
  offsetXMm: number;
  offsetYMm: number;
  x: number;
  y: number;
}

/** Corta o texto ao que cabe na largura disponível, com reticências. */
function truncate(text: string, availableMm: number, fontSizeMm: number): string {
  const maxChars = Math.floor(availableMm / (fontSizeMm * CHAR_RATIO));
  if (maxChars >= text.length) return text;
  if (maxChars <= 1) return '…';
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

export function DrawerCanvas({ layout, selectedKey, onSelect, onMove, onAddAt }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Prefixo próprio desta instância, para os ids de recorte não colidirem.
  const instanceId = useId().replace(/:/g, '');

  const widthMm = layout.cols * UNIT_MM;
  const depthMm = layout.rows * UNIT_MM;
  const free = freeRectangles(layout);

  /** Converte coordenadas do ecrã para milímetros dentro da gaveta. */
  const toDrawerMm = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { xMm: point.x, yMm: point.y };
  }, []);

  const beginDrag = (event: React.PointerEvent, bin: PlacedBin) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const position = toDrawerMm(event.clientX, event.clientY);
    if (!position) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(bin.key);
    setDrag({
      key: bin.key,
      pointerId: event.pointerId,
      offsetXMm: position.xMm - bin.x * UNIT_MM,
      offsetYMm: position.yMm - bin.y * UNIT_MM,
      x: bin.x,
      y: bin.y,
    });
  };

  const continueDrag = (event: React.PointerEvent, bin: PlacedBin) => {
    if (!drag || drag.key !== bin.key || drag.pointerId !== event.pointerId) return;
    const position = toDrawerMm(event.clientX, event.clientY);
    if (!position) return;

    const x = Math.round((position.xMm - drag.offsetXMm) / UNIT_MM);
    const y = Math.round((position.yMm - drag.offsetYMm) / UNIT_MM);
    const clampedX = Math.min(Math.max(0, x), layout.cols - bin.w);
    const clampedY = Math.min(Math.max(0, y), layout.rows - bin.d);
    if (clampedX !== drag.x || clampedY !== drag.y) {
      setDrag({ ...drag, x: clampedX, y: clampedY });
    }
  };

  const endDrag = (event: React.PointerEvent, bin: PlacedBin) => {
    if (!drag || drag.key !== bin.key) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.x !== bin.x || drag.y !== bin.y) onMove(bin.key, drag.x, drag.y);
    setDrag(null);
  };

  /** Setas movem a caixa selecionada — alternativa ao arrastar. */
  const handleKey = (event: React.KeyboardEvent, bin: PlacedBin) => {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      onSelect(bin.key);
      onMove(bin.key, bin.x + step[0], bin.y + step[1]);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(bin.key === selectedKey ? null : bin.key);
    }
  };

  return (
    <svg
      ref={svgRef}
      className="drawer-svg"
      viewBox={`${-FRAME_MM} ${-FRAME_MM} ${widthMm + FRAME_MM * 2} ${depthMm + FRAME_MM * 2}`}
      role="group"
      aria-label={`Esquema da gaveta, ${layout.cols} por ${layout.rows} módulos`}
    >
      <rect
        x={-FRAME_MM}
        y={-FRAME_MM}
        width={widthMm + FRAME_MM * 2}
        height={depthMm + FRAME_MM * 2}
        rx={FRAME_MM}
        fill="var(--wood)"
      />
      <rect x={0} y={0} width={widthMm} height={depthMm} fill="var(--wood-inner)" />

      {/* Grelha dos módulos base, como referência de escala. */}
      <g stroke="rgba(0,0,0,0.06)" strokeWidth={1}>
        {Array.from({ length: layout.cols - 1 }, (_, i) => (
          <line key={`v${i}`} x1={(i + 1) * UNIT_MM} y1={0} x2={(i + 1) * UNIT_MM} y2={depthMm} />
        ))}
        {Array.from({ length: layout.rows - 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={(i + 1) * UNIT_MM} x2={widthMm} y2={(i + 1) * UNIT_MM} />
        ))}
      </g>

      {free.map((rect) => (
        <g
          key={`free-${rect.x}-${rect.y}`}
          className="freerect"
          role="button"
          tabIndex={0}
          aria-label={`Espaço livre de ${unitsToCm(rect.w)} por ${unitsToCm(rect.d)} cm. Acrescentar uma caixa aqui.`}
          onClick={() => onAddAt(rect)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onAddAt(rect);
            }
          }}
        >
          <rect
            className="freerect__box"
            x={rect.x * UNIT_MM + GAP_MM}
            y={rect.y * UNIT_MM + GAP_MM}
            width={rect.w * UNIT_MM - GAP_MM * 2}
            height={rect.d * UNIT_MM - GAP_MM * 2}
            rx={8}
          />
          <text
            className="freerect__plus"
            x={(rect.x + rect.w / 2) * UNIT_MM}
            y={(rect.y + rect.d / 2) * UNIT_MM}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: LABEL_SIZE * 1.4 }}
          >
            +
          </text>
        </g>
      ))}

      {layout.bins.map((bin) => {
        const dragging = drag?.key === bin.key;
        const x = (dragging ? drag.x : bin.x) * UNIT_MM;
        const y = (dragging ? drag.y : bin.y) * UNIT_MM;
        const w = bin.w * UNIT_MM;
        const d = bin.d * UNIT_MM;
        const selected = bin.key === selectedKey;

        return (
          <g
            key={bin.key}
            className={[
              'bin',
              selected ? 'bin--selected' : '',
              dragging ? 'bin--dragging' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${bin.name}, ${unitsToCm(bin.w)} por ${unitsToCm(bin.d)} centímetros`}
            opacity={dragging ? 0.85 : 1}
            onPointerDown={(event) => beginDrag(event, bin)}
            onPointerMove={(event) => continueDrag(event, bin)}
            onPointerUp={(event) => endDrag(event, bin)}
            onPointerCancel={(event) => endDrag(event, bin)}
            onKeyDown={(event) => handleKey(event, bin)}
          >
            <title>{bin.name}</title>
            <rect
              className="bin__body"
              x={x + GAP_MM}
              y={y + GAP_MM}
              width={w - GAP_MM * 2}
              height={d - GAP_MM * 2}
              rx={7}
            />
            {/* Pastilha de cor com o nome do grupo, como nos ecrãs da proposta. */}
            {(() => {
              const pillX = x + GAP_MM + PILL_PAD;
              const pillY = y + GAP_MM + PILL_PAD;
              const pillW = Math.max(0, w - GAP_MM * 2 - PILL_PAD * 2);
              const pillH = LABEL_SIZE * 1.7;
              const clipId = `${instanceId}-${bin.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
              return (
                <>
                  <clipPath id={clipId}>
                    <rect x={pillX} y={pillY} width={pillW} height={pillH} />
                  </clipPath>
                  <rect
                    x={pillX}
                    y={pillY}
                    width={pillW}
                    height={pillH}
                    rx={LABEL_SIZE * 0.85}
                    fill={bin.color}
                  />
                  <text
                    className="bin__label"
                    clipPath={`url(#${clipId})`}
                    x={pillX + LABEL_SIZE * 0.6}
                    y={pillY + pillH / 2}
                    dominantBaseline="central"
                    style={{ fontSize: LABEL_SIZE }}
                  >
                    {truncate(bin.name, pillW - LABEL_SIZE * 1.2, LABEL_SIZE)}
                  </text>
                </>
              );
            })()}
            <text
              className="bin__size"
              x={x + w / 2}
              y={y + d - GAP_MM - SIZE_SIZE}
              textAnchor="middle"
              style={{ fontSize: SIZE_SIZE }}
            >
              {unitsToCm(bin.w)} × {unitsToCm(bin.d)} cm
            </text>
          </g>
        );
      })}
    </svg>
  );
}
