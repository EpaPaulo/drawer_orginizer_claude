import { useEffect, useState } from 'react';

import { moduleLabel, MODULES, unitsToCm, type ModuleId } from '../domain/modules';
import { generateLayout, moduleTally, type Project } from '../domain/project';
import {
  addBin,
  changeModule,
  moveBin,
  removeBin,
  renameBin,
  rotateBin,
  usedUnits,
  type EditResult,
  type FreeRect,
  type Layout,
} from '../domain/solver';
import { DrawerCanvas } from './DrawerCanvas';

interface Props {
  project: Project;
  onChange: (patch: Partial<Project>, invalidatesLayout?: boolean) => void;
}

/** Maior módulo que cabe num retângulo livre, em qualquer orientação. */
function largestModuleFor(rect: FreeRect): ModuleId | null {
  const fitting = MODULES.filter(
    (m) => (m.w <= rect.w && m.d <= rect.d) || (m.d <= rect.w && m.w <= rect.d),
  ).sort((a, b) => b.w * b.d - a.w * a.d);
  return fitting[0]?.id ?? null;
}

export function StepLayout({ project, onChange }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const layout = project.layout;
  const selected = layout?.bins.find((bin) => bin.key === selectedKey) ?? null;

  // Se a caixa selecionada desaparecer (removida ou regenerada), limpar.
  useEffect(() => {
    if (selectedKey && !layout?.bins.some((bin) => bin.key === selectedKey)) {
      setSelectedKey(null);
    }
  }, [layout, selectedKey]);

  if (!layout) {
    return (
      <p className="banner banner--warn">
        Ainda não há proposta. Volta atrás e confirma as medidas e os grupos.
      </p>
    );
  }

  const setLayout = (next: Layout) => onChange({ layout: next });

  /** Aplica uma edição e explica a recusa em vez de a ignorar. */
  const apply = (result: EditResult, successMessage?: string) => {
    if (result.ok) {
      setLayout(result.layout);
      setStatus(successMessage ?? null);
    } else {
      setStatus(result.reason);
    }
  };

  const handleAddAt = (rect: FreeRect) => {
    const moduleId = largestModuleFor(rect);
    if (!moduleId) {
      setStatus('Esse espaço é mais pequeno do que a caixa mais pequena (8 × 8 cm).');
      return;
    }
    const key = `extra-${Date.now()}`;
    apply(
      addBin(
        layout,
        { key, groupId: 'custom', name: 'Nova caixa', color: '#e6dfd2', moduleId },
        { x: rect.x, y: rect.y },
      ),
      'Caixa acrescentada. Dá-lhe um nome no painel ao lado.',
    );
    setSelectedKey(key);
  };

  const tally = moduleTally(layout);
  const used = usedUnits(layout);
  const capacity = layout.cols * layout.rows;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="stack stack--tight">
        <span className="eyebrow">Etapa 3</span>
        <h2>A tua proposta.</h2>
        <p className="lead">
          Arrasta as caixas para as mudar de sítio, toca numa para a editar e usa os espaços
          tracejados para acrescentar mais.
        </p>
      </div>

      {layout.unplaced.length > 0 && (
        <div className="banner banner--warn" role="alert">
          Não houve espaço para: <strong>{layout.unplaced.map((u) => u.name).join(', ')}</strong>.
          Podes libertar espaço aqui, ou voltar atrás e reduzir a quantidade de outro grupo.
        </div>
      )}

      <div className="grid2 grid2--wide">
        <div className="stack">
          <div className="drawer-wrap">
            <DrawerCanvas
              layout={layout}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              onMove={(key, x, y) => apply(moveBin(layout, key, x, y))}
              onAddAt={handleAddAt}
            />
          </div>

          <p className="note" aria-live="polite">
            {status ?? (
              <>
                Ocupado: {used} de {capacity} módulos. Com o teclado, seleciona uma caixa com Tab e
                move-a com as setas.
              </>
            )}
          </p>

          <div className="btnrow">
            <button
              className="btn btn--small"
              onClick={() => {
                setLayout(generateLayout(project));
                setSelectedKey(null);
                setStatus('Distribuição gerada de novo a partir dos teus grupos.');
              }}
            >
              Repor distribuição
            </button>
          </div>
        </div>

        <div className="stack">
          {selected ? (
            <div className="card stack stack--tight">
              <span className="eyebrow">Caixa selecionada</span>
              <div className="field">
                <label className="field__label" htmlFor="bin-name">
                  Nome
                </label>
                <input
                  id="bin-name"
                  type="text"
                  maxLength={28}
                  value={selected.name}
                  onChange={(event) => setLayout(renameBin(layout, selected.key, event.target.value))}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="bin-module">
                  Tamanho
                </label>
                <select
                  id="bin-module"
                  value={selected.moduleId}
                  onChange={(event) =>
                    apply(changeModule(layout, selected.key, event.target.value as ModuleId))
                  }
                >
                  {MODULES.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.name} — {moduleLabel(spec.id)}
                    </option>
                  ))}
                </select>
              </div>

              {selected.downgraded && (
                <p className="note">
                  Esta caixa ficou mais pequena do que pediste por falta de espaço.
                </p>
              )}

              <div className="btnrow">
                <button
                  className="btn btn--small"
                  disabled={selected.w === selected.d}
                  onClick={() => apply(rotateBin(layout, selected.key))}
                >
                  Rodar 90°
                </button>
                <button
                  className="btn btn--small btn--danger"
                  onClick={() => {
                    setLayout(removeBin(layout, selected.key));
                    setSelectedKey(null);
                    setStatus(`"${selected.name}" removida.`);
                  }}
                >
                  Remover
                </button>
              </div>

              <p className="note">
                Ocupa {unitsToCm(selected.w)} × {unitsToCm(selected.d)} cm no canto x=
                {unitsToCm(selected.x)} cm, y={unitsToCm(selected.y)} cm.
              </p>
            </div>
          ) : (
            <div className="card card--flat">
              <p className="note">
                Escolhe uma caixa no esquema para lhe mudar o nome, o tamanho ou a orientação.
              </p>
            </div>
          )}

          <div className="card stack stack--tight">
            <span className="eyebrow">Módulos utilizados</span>
            <div className="tally">
              {tally.map((entry) => (
                <div className="tally__row" key={entry.moduleId}>
                  <span className="tally__count">{entry.count}×</span>
                  <span className="tally__name">
                    <div>{entry.name}</div>
                    <div className="tally__label">{entry.label}</div>
                  </span>
                </div>
              ))}
              {tally.length === 0 && <p className="note">A gaveta está vazia.</p>}
            </div>
          </div>

          {project.photo && (
            <div className="card stack stack--tight">
              <span className="eyebrow">A tua gaveta</span>
              <img className="photo" src={project.photo} alt="A gaveta que estás a organizar" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
