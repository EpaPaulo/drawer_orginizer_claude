import { boxHeightMm, WALL_MM } from '../domain/modules';
import {
  fitsPrinterBed,
  moduleTally,
  totalFilamentGrams,
  traySpecFor,
  type Output,
  type Project,
  type TallyEntry,
} from '../domain/project';
import { plateStl, trayStl } from '../domain/stl';
import { downloadBlob, slug } from '../lib/download';

interface Props {
  project: Project;
  onChange: (patch: Partial<Project>, invalidatesLayout?: boolean) => void;
}

function stlName(entry: TallyEntry, heightMm: number): string {
  return `organiza-${slug(entry.name)}-${entry.widthMm}x${entry.depthMm}x${heightMm}mm.stl`;
}

export function StepProduce({ project, onChange }: Props) {
  const layout = project.layout;
  if (!layout) {
    return <p className="banner banner--warn">Volta atrás e gera primeiro uma proposta.</p>;
  }

  const tally = moduleTally(layout);
  const height = boxHeightMm(project.heightMm);
  const bed = project.printerBedMm;
  const tooBig = tally.filter((entry) => !fitsPrinterBed(entry, bed));
  const filament = Math.round(totalFilamentGrams(layout, project.heightMm));

  const downloadOne = (entry: TallyEntry) => {
    const spec = traySpecFor(entry, project.heightMm);
    const stl = trayStl(spec, `ORGANIZA ${entry.name} ${entry.widthMm}x${entry.depthMm}x${height}mm`);
    downloadBlob(new Blob([stl], { type: 'model/stl' }), stlName(entry, height));
  };

  const downloadAll = () => {
    // Uma de cada tamanho: as repetidas imprimem-se a partir do mesmo ficheiro.
    const specs = tally.map((entry) => traySpecFor(entry, project.heightMm));
    const stl = plateStl(specs, 'ORGANIZA — um exemplar de cada caixa');
    downloadBlob(new Blob([stl], { type: 'model/stl' }), 'organiza-todas-as-caixas.stl');
  };

  const choose = (output: Output) => onChange({ output });

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="stack stack--tight">
        <span className="eyebrow">Etapa 4</span>
        <h2>Como queres produzir?</h2>
        <p className="lead">São {layout.bins.length} caixas, com {height} mm de altura.</p>
      </div>

      <div className="grid2">
        <button
          className="choice"
          aria-pressed={project.output === 'files'}
          onClick={() => choose('files')}
        >
          <span className="choice__title">Imprimir em casa</span>
          <span className="choice__desc">Descarrega os ficheiros e imprime quando quiseres.</span>
          <ul className="checklist">
            <li>Ficheiros STL prontos a fatiar</li>
            <li>Paredes de {WALL_MM} mm, fundo fechado</li>
            <li>Sem contas nem espera</li>
          </ul>
        </button>

        <button
          className="choice"
          aria-pressed={project.output === 'kit'}
          onClick={() => choose('kit')}
        >
          <span className="choice__title">Receber um kit</span>
          <span className="choice__desc">Levar a lista de caixas a quem as produza por ti.</span>
          <ul className="checklist">
            <li>Lista de peças com medidas</li>
            <li>Mesmos ficheiros para enviar</li>
            <li>Serve para pedir orçamento</li>
          </ul>
        </button>
      </div>

      {project.output === 'files' ? (
        <div className="card stack">
          <h3>Os teus ficheiros</h3>

          <div className="measures" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <div className="field">
              <label className="field__label" htmlFor="bed-w">
                Base da impressora · largura mm
              </label>
              <input
                id="bed-w"
                type="number"
                min={50}
                max={1000}
                value={bed.w}
                onChange={(event) =>
                  onChange({ printerBedMm: { ...bed, w: event.target.valueAsNumber } })
                }
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="bed-d">
                Base da impressora · profundidade mm
              </label>
              <input
                id="bed-d"
                type="number"
                min={50}
                max={1000}
                value={bed.d}
                onChange={(event) =>
                  onChange({ printerBedMm: { ...bed, d: event.target.valueAsNumber } })
                }
              />
            </div>
          </div>

          {tooBig.length > 0 && (
            <div className="banner banner--warn" role="alert">
              Não cabem na base que indicaste:{' '}
              <strong>{tooBig.map((entry) => `${entry.name} (${entry.label})`).join(', ')}</strong>.
              Troca essas caixas por módulos mais pequenos na etapa anterior, ou imprime-as noutra
              impressora.
            </div>
          )}

          <div className="tally">
            {tally.map((entry) => {
              const fits = fitsPrinterBed(entry, bed);
              return (
                <div className="tally__row" key={entry.moduleId}>
                  <span className="tally__count">{entry.count}×</span>
                  <span className="tally__name">
                    <div>{entry.name}</div>
                    <div className="tally__label">
                      {entry.widthMm} × {entry.depthMm} × {height} mm
                      {!fits && ' · não cabe na base'}
                    </div>
                  </span>
                  <button className="btn btn--small" onClick={() => downloadOne(entry)}>
                    STL
                  </button>
                </div>
              );
            })}
          </div>

          <div className="btnrow">
            <button className="btn btn--primary" onClick={downloadAll} disabled={tally.length === 0}>
              Descarregar um exemplar de cada
            </button>
          </div>

          <p className="note">
            Cada ficheiro traz uma caixa; imprime-a tantas vezes quantas a lista indicar. Filamento
            estimado no total: cerca de <strong>{filament} g</strong> — um teto, porque a impressão
            real usa enchimento parcial. As medidas são exteriores e incluem as paredes.
          </p>
        </div>
      ) : (
        <div className="card stack">
          <h3>A tua lista de peças</h3>
          <ul className="summary-list">
            {tally.map((entry) => (
              <li key={entry.moduleId}>
                <span>
                  {entry.name} · {entry.widthMm} × {entry.depthMm} × {height} mm
                </span>
                <span>{entry.count}×</span>
              </li>
            ))}
            <li>
              <span>Total de caixas</span>
              <span>{layout.bins.length}</span>
            </li>
          </ul>

          <div className="banner banner--info">
            Esta versão não trata de encomendas nem de pagamentos. Leva o resumo e os ficheiros a um
            serviço de impressão 3D para pedires orçamento — é tudo o que eles precisam.
          </div>

          <div className="btnrow">
            <button className="btn" onClick={downloadAll} disabled={tally.length === 0}>
              Descarregar os STL para enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
