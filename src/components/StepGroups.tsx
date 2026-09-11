import { useMemo, useState } from 'react';

import { AMOUNTS, GROUP_CATALOG, modulePreferences, type Amount, type Shape } from '../domain/groups';
import { drawerGrid, moduleArea } from '../domain/modules';
import { selectedGroupFromCatalog, uniqueKey, type Project, type SelectedGroup } from '../domain/project';

interface Props {
  project: Project;
  onChange: (patch: Partial<Project>, invalidatesLayout?: boolean) => void;
}

const CUSTOM_COLORS = ['#cfe6cd', '#f3e5b8', '#cfe0f0', '#f2d5d8', '#e3d9ef', '#f7d6bd'];

const SHAPES: readonly { id: Shape; label: string }[] = [
  { id: 'compacto', label: 'Compacto' },
  { id: 'alongado', label: 'Alongado' },
  { id: 'amplo', label: 'Amplo' },
];

export function StepGroups({ project, onChange }: Props) {
  const [custom, setCustom] = useState('');

  const grid = drawerGrid(project.widthMm, project.depthMm);
  const capacity = grid.cols * grid.rows;

  /** Quanto espaço pedem os grupos escolhidos, no tamanho preferido. */
  const requested = useMemo(
    () =>
      project.groups.reduce((total, group) => {
        const preferred = modulePreferences(group.shape, group.amount)[0];
        return total + (preferred ? moduleArea(preferred) : 0);
      }, 0),
    [project.groups],
  );

  const setGroups = (groups: SelectedGroup[]) => onChange({ groups }, true);

  const patchGroup = (key: string, patch: Partial<SelectedGroup>) =>
    setGroups(project.groups.map((group) => (group.key === key ? { ...group, ...patch } : group)));

  const addFromCatalog = (id: string) => {
    const group = selectedGroupFromCatalog(id, uniqueKey(project.groups, id));
    if (group) setGroups([...project.groups, group]);
  };

  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    setGroups([
      ...project.groups,
      {
        key: uniqueKey(project.groups, `custom-${name.toLowerCase().replace(/\s+/g, '-')}`),
        groupId: 'custom',
        name,
        hint: 'Grupo criado por ti',
        shape: 'compacto',
        amount: 'medio',
        color: CUSTOM_COLORS[project.groups.length % CUSTOM_COLORS.length] ?? '#e6dfd2',
      },
    ]);
    setCustom('');
  };

  const available = GROUP_CATALOG.filter(
    (spec) => !project.groups.some((group) => group.groupId === spec.id),
  );

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="stack stack--tight">
        <span className="eyebrow">Etapa 2</span>
        <h2>O que guardas nesta gaveta?</h2>
        <p className="lead">
          Cada grupo vira uma caixa. Diz quanto tens de cada um — é isso que decide o tamanho do
          módulo.
        </p>
      </div>

      <div className="grid2 grid2--wide">
        <div className="stack">
          <div className="grouplist">
            {project.groups.map((group) => (
              <div className="group" key={group.key}>
                <span className="group__dot" style={{ background: group.color }} />
                <div className="group__text">
                  <div className="group__name">{group.name}</div>
                  <div className="group__hint">{group.hint}</div>
                </div>

                <div className="segmented" role="group" aria-label={`Quantidade de ${group.name}`}>
                  {AMOUNTS.map((amount) => (
                    <button
                      key={amount.id}
                      aria-pressed={group.amount === amount.id}
                      onClick={() => patchGroup(group.key, { amount: amount.id as Amount })}
                    >
                      {amount.label}
                    </button>
                  ))}
                </div>

                <div className="segmented" role="group" aria-label={`Formato de ${group.name}`}>
                  {SHAPES.map((shape) => (
                    <button
                      key={shape.id}
                      aria-pressed={group.shape === shape.id}
                      onClick={() => patchGroup(group.key, { shape: shape.id })}
                    >
                      {shape.label}
                    </button>
                  ))}
                </div>

                <button
                  className="btn btn--small btn--danger"
                  aria-label={`Retirar ${group.name}`}
                  onClick={() => setGroups(project.groups.filter((g) => g.key !== group.key))}
                >
                  Retirar
                </button>
              </div>
            ))}

            {project.groups.length === 0 && (
              <p className="banner banner--warn">
                Ainda não escolheste nada. Acrescenta pelo menos um grupo para continuar.
              </p>
            )}
          </div>

          {available.length > 0 && (
            <div className="stack stack--tight">
              <span className="field__label">Acrescentar</span>
              <div className="chips">
                {available.map((spec) => (
                  <button key={spec.id} className="chip" onClick={() => addFromCatalog(spec.id)}>
                    <span className="chip__dot" style={{ background: spec.color }} />+ {spec.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="stack stack--tight">
            <label className="field__label" htmlFor="custom-group">
              Ou escreve o teu
            </label>
            <div className="btnrow">
              <input
                id="custom-group"
                type="text"
                maxLength={28}
                placeholder="Ex.: brinquedos do gato"
                value={custom}
                style={{ flex: 1, minWidth: 180 }}
                onChange={(event) => setCustom(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustom();
                  }
                }}
              />
              <button className="btn" onClick={addCustom} disabled={custom.trim() === ''}>
                Acrescentar
              </button>
            </div>
          </div>
        </div>

        <div className="card stack stack--tight">
          <h3>Espaço pedido</h3>
          <p aria-live="polite" style={{ fontSize: 15 }}>
            Os teus grupos pedem cerca de <strong>{requested}</strong> dos{' '}
            <strong>{capacity}</strong> módulos desta gaveta.
          </p>
          {requested > capacity ? (
            <div className="banner banner--warn">
              É mais do que cabe. Podes continuar: as caixas que não couberem no tamanho pedido
              passam a um módulo mais pequeno, e o que sobrar fica assinalado na proposta.
            </div>
          ) : (
            <div className="banner banner--info">
              Cabe com folga. O espaço que sobrar aparece na proposta para acrescentares mais
              caixas.
            </div>
          )}
          <p className="note">
            <strong>Compacto</strong> para coisas miúdas, <strong>alongado</strong> para o que é
            comprido (canetas, talheres) e <strong>amplo</strong> para volumes grandes.
          </p>
        </div>
      </div>
    </div>
  );
}
