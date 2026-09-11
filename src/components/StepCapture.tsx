import { useId, useRef, useState } from 'react';

import { boxHeightMm, drawerGrid } from '../domain/modules';
import { LIMITS, type Project } from '../domain/project';
import { readPhotoAsDataUrl } from '../lib/photo';

interface Props {
  project: Project;
  errors: string[];
  onChange: (patch: Partial<Project>, invalidatesLayout?: boolean) => void;
}

export function StepCapture({ project, errors, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const ids = { w: useId(), d: useId(), h: useId() };

  const grid = drawerGrid(project.widthMm, project.depthMm);
  const valid = errors.length === 0;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    try {
      onChange({ photo: await readPhotoAsDataUrl(file) });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Não foi possível ler a imagem.');
    }
  };

  const numberField = (
    id: string,
    label: string,
    value: number,
    limit: { min: number; max: number },
    key: 'widthMm' | 'depthMm' | 'heightMm',
  ) => (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={limit.min}
        max={limit.max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange({ [key]: event.target.valueAsNumber }, true)}
      />
    </div>
  );

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="stack stack--tight">
        <span className="eyebrow">Etapa 1</span>
        <h2>Mede a gaveta.</h2>
        <p className="lead">
          As medidas são o que decide tudo o resto. A fotografia é opcional e serve para teres a
          gaveta à vista enquanto escolhes o conteúdo.
        </p>
      </div>

      <div className="grid2">
        <div className="card stack">
          <h3>Fotografia (opcional)</h3>
          {project.photo ? (
            <div className="photo-frame">
              <img className="photo" src={project.photo} alt="A gaveta que estás a organizar" />
              <div className="photo-frame__corners" />
            </div>
          ) : (
            <div className="photo-empty">
              <strong>Sem fotografia</strong>
              <span>Fotografa a gaveta de cima, com boa luz e os limites à vista.</span>
            </div>
          )}

          <input
            ref={fileRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={(event) => {
              void pickPhoto(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <div className="btnrow">
            <button className="btn btn--small" onClick={() => fileRef.current?.click()}>
              {project.photo ? 'Mudar fotografia' : 'Escolher fotografia'}
            </button>
            {project.photo && (
              <button
                className="btn btn--small btn--danger"
                onClick={() => onChange({ photo: null })}
              >
                Remover
              </button>
            )}
          </div>

          {photoError && (
            <p className="error" role="alert">
              {photoError}
            </p>
          )}
          <p className="note">
            A imagem não é analisada automaticamente — és tu que dizes o que está lá dentro na etapa
            seguinte. Fica guardada neste navegador e não é enviada para lado nenhum.
          </p>
        </div>

        <div className="card stack">
          <h3>Medidas interiores</h3>
          <p className="note">
            Mede por dentro, entre paredes. A altura útil é a que sobra até o topo da gaveta fechar.
          </p>

          <div className="measures">
            {numberField(ids.w, 'Largura · mm', project.widthMm, LIMITS.widthMm, 'widthMm')}
            {numberField(ids.d, 'Profundidade · mm', project.depthMm, LIMITS.depthMm, 'depthMm')}
            {numberField(ids.h, 'Altura útil · mm', project.heightMm, LIMITS.heightMm, 'heightMm')}
          </div>

          {errors.length > 0 ? (
            <div className="banner banner--error" role="alert">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="banner banner--info" aria-live="polite">
              Dá uma grelha de <strong>{grid.cols} × {grid.rows}</strong> módulos de 4 cm, com caixas
              de <strong>{boxHeightMm(project.heightMm)} mm</strong> de altura.
              {(grid.slackWidthMm > 0 || grid.slackDepthMm > 0) && (
                <>
                  {' '}
                  Sobram {grid.slackWidthMm} mm à largura e {grid.slackDepthMm} mm à profundidade —
                  folga suficiente para as caixas entrarem e saírem sem prender.
                </>
              )}
            </div>
          )}

          {valid && (
            <p className="note">
              Uma fotografia não chega para saber a altura: confirma-a com uma fita métrica antes de
              imprimir.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
