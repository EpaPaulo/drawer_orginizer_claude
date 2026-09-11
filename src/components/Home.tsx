import { useMemo } from 'react';

import { createProject, generateLayout } from '../domain/project';
import { DrawerCanvas } from './DrawerCanvas';

interface Props {
  hasSaved: boolean;
  onStart: () => void;
  onResume: () => void;
}

export function Home({ hasSaved, onStart, onResume }: Props) {
  // O herói é o próprio produto: uma gaveta distribuída pelo mesmo solver.
  const demo = useMemo(() => generateLayout(createProject()), []);

  return (
    <div className="stack" style={{ gap: 26 }}>
      <div className="grid2" style={{ alignItems: 'center' }}>
        <div className="stack">
          <span className="eyebrow">Gavetas de casa</span>
          <h1>
            Uma gaveta.
            <br />
            Um lugar para
            <br />
            <span className="orange">cada coisa.</span>
          </h1>
          <p className="lead">
            Mede a gaveta, diz o que guardas lá dentro e recebe um conjunto de caixas modulares que
            encaixa nela — prontas a imprimir em 3D.
          </p>
          <div className="btnrow">
            <button className="btn btn--primary btn--block" onClick={onStart} style={{ flex: 1 }}>
              Começar →
            </button>
          </div>
          {hasSaved && (
            <button className="btn btn--ghost" onClick={onResume}>
              Retomar o projeto guardado
            </button>
          )}
          <p className="note">
            Funciona sem conta e sem ligação. O projeto e a fotografia ficam guardados apenas neste
            navegador.
          </p>
        </div>

        <div className="drawer-wrap" aria-hidden="true" style={{ pointerEvents: 'none' }}>
          <DrawerCanvas
            layout={demo}
            selectedKey={null}
            onSelect={() => {}}
            onMove={() => {}}
            onAddAt={() => {}}
          />
        </div>
      </div>

      <div className="grid2">
        <div className="card stack stack--tight">
          <span className="eyebrow">01 · Medir</span>
          <h3>Medidas interiores</h3>
          <p className="note">
            Todas as caixas são múltiplos de um módulo de 4 cm, por isso combinam entre si e enchem a
            gaveta sem sobras estranhas.
          </p>
        </div>
        <div className="card stack stack--tight">
          <span className="eyebrow">02 · Distribuir</span>
          <h3>Um esquema que podes mexer</h3>
          <p className="note">
            A distribuição é calculada a sério para as tuas medidas. Arrasta, roda, troca de tamanho
            e muda os nomes até servir.
          </p>
        </div>
        <div className="card stack stack--tight">
          <span className="eyebrow">03 · Produzir</span>
          <h3>Ficheiros STL reais</h3>
          <p className="note">
            As caixas são geradas em STL, prontas a abrir no fatiador. Sem contas, sem espera e sem
            passar por nenhum servidor.
          </p>
        </div>
      </div>
    </div>
  );
}
