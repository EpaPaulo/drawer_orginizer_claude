import { boxHeightMm, drawerGrid } from '../domain/modules';
import { moduleTally, projectSummary, type Project } from '../domain/project';
import { downloadJson, downloadText } from '../lib/download';

interface Props {
  project: Project;
  onRestart: () => void;
  onBack: () => void;
}

export function Done({ project, onRestart, onBack }: Props) {
  const layout = project.layout;
  const tally = layout ? moduleTally(layout) : [];
  const grid = drawerGrid(project.widthMm, project.depthMm);

  return (
    <div className="stack" style={{ gap: 22, textAlign: 'center', alignItems: 'center' }}>
      <div className="tick" aria-hidden="true">
        ✓
      </div>
      <h2>Projeto pronto.</h2>
      <p className="lead" style={{ margin: '0 auto' }}>
        {project.output === 'files'
          ? 'Tens os ficheiros para imprimir. Confirma as medidas na gaveta antes de começar.'
          : 'Tens a lista de peças e os ficheiros para pedires orçamento.'}
      </p>

      <div className="card stack" style={{ textAlign: 'left', maxWidth: 460, width: '100%' }}>
        <ul className="summary-list">
          <li>
            <span>Gaveta</span>
            <span>
              {project.widthMm} × {project.depthMm} × {project.heightMm} mm
            </span>
          </li>
          <li>
            <span>Grelha</span>
            <span>
              {grid.cols} × {grid.rows} módulos
            </span>
          </li>
          <li>
            <span>Caixas</span>
            <span>{layout?.bins.length ?? 0}</span>
          </li>
          <li>
            <span>Altura das caixas</span>
            <span>{boxHeightMm(project.heightMm)} mm</span>
          </li>
          {tally.map((entry) => (
            <li key={entry.moduleId}>
              <span>{entry.name}</span>
              <span>
                {entry.count}× · {entry.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="btnrow" style={{ justifyContent: 'center' }}>
        <button
          className="btn btn--primary"
          onClick={() => downloadText(projectSummary(project), 'organiza-resumo.txt')}
        >
          Descarregar resumo
        </button>
        <button className="btn" onClick={() => downloadJson(project, 'organiza-projeto.json')}>
          Guardar projeto (.json)
        </button>
      </div>

      <div className="btnrow" style={{ justifyContent: 'center' }}>
        <button className="btn btn--ghost" onClick={onBack}>
          ← Voltar à proposta
        </button>
        <button className="btn btn--ghost" onClick={onRestart}>
          Começar uma gaveta nova
        </button>
      </div>

      <p className="note" style={{ margin: '0 auto' }}>
        O projeto continua guardado neste navegador. Começar uma gaveta nova substitui-o.
      </p>
    </div>
  );
}
