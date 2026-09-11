import { useCallback, useEffect, useMemo, useState } from 'react';

import { Done } from './components/Done';
import { Home } from './components/Home';
import { StepCapture } from './components/StepCapture';
import { StepGroups } from './components/StepGroups';
import { StepLayout } from './components/StepLayout';
import { StepProduce } from './components/StepProduce';
import {
  createProject,
  dimensionErrors,
  generateLayout,
  loadProject,
  saveProject,
  type Project,
} from './domain/project';

export type Step = 'inicio' | 'captura' | 'conteudo' | 'proposta' | 'produzir' | 'fim';

/** As quatro etapas com barra de progresso. */
const FLOW: readonly Step[] = ['captura', 'conteudo', 'proposta', 'produzir'];

const TITLES: Record<Step, string> = {
  inicio: 'Início',
  captura: 'A gaveta',
  conteudo: 'O conteúdo',
  proposta: 'A proposta',
  produzir: 'Produzir',
  fim: 'Concluído',
};

export function App() {
  const [project, setProject] = useState<Project>(() => loadProject() ?? createProject());
  const [step, setStep] = useState<Step>('inicio');
  const [hadSaved] = useState(() => loadProject() !== null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    saveProject(project);
  }, [project]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  /**
   * Alterar medidas ou grupos invalida a distribuição: as caixas passam a não
   * corresponder ao que foi pedido, por isso é regenerada ao entrar na proposta.
   */
  const update = useCallback((patch: Partial<Project>, invalidatesLayout = false) => {
    setProject((current) => ({
      ...current,
      ...patch,
      ...(invalidatesLayout ? { layout: null } : {}),
    }));
  }, []);

  const flowIndex = FLOW.indexOf(step);
  const errors = useMemo(() => dimensionErrors(project), [project]);

  const blockedReason = (): string | null => {
    if (step === 'captura' && errors.length > 0) return errors[0] ?? null;
    if (step === 'conteudo' && project.groups.length === 0) {
      return 'Escolhe pelo menos um grupo para organizar.';
    }
    if (step === 'proposta' && (project.layout?.bins.length ?? 0) === 0) {
      return 'Não há nenhuma caixa na gaveta.';
    }
    return null;
  };

  const goTo = (next: Step) => {
    setMessage(null);
    // A distribuição é calculada à entrada da proposta, com as medidas e os
    // grupos já confirmados.
    if (next === 'proposta') {
      setProject((current) =>
        current.layout ? current : { ...current, layout: generateLayout(current) },
      );
    }
    setStep(next);
  };

  const goNext = () => {
    const blocked = blockedReason();
    if (blocked) {
      setMessage(blocked);
      return;
    }
    const next = step === 'inicio' ? 'captura' : (FLOW[flowIndex + 1] ?? 'fim');
    goTo(next);
  };

  const goBack = () => {
    setMessage(null);
    if (step === 'fim') return setStep('produzir');
    setStep(flowIndex <= 0 ? 'inicio' : (FLOW[flowIndex - 1] ?? 'inicio'));
  };

  const restart = () => {
    setProject(createProject());
    setStep('inicio');
  };

  const nextLabel = step === 'produzir' ? 'Concluir' : 'Continuar';

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <button className="logo" onClick={() => setStep('inicio')}>
            ORGANIZA<i>.</i>
          </button>
          <span className="stepcount">
            {flowIndex >= 0 ? `${flowIndex + 1} / ${FLOW.length} · ${TITLES[step]}` : TITLES[step]}
          </span>
        </div>
        <div className="progress">
          <div
            className="progress__bar"
            style={{
              width:
                step === 'inicio'
                  ? '0%'
                  : step === 'fim'
                    ? '100%'
                    : `${((flowIndex + 1) / FLOW.length) * 100}%`,
            }}
          />
        </div>
      </header>

      <main className="main">
        {step === 'inicio' && (
          <Home hasSaved={hadSaved} onStart={() => goTo('captura')} onResume={() => goTo('proposta')} />
        )}
        {step === 'captura' && <StepCapture project={project} errors={errors} onChange={update} />}
        {step === 'conteudo' && <StepGroups project={project} onChange={update} />}
        {step === 'proposta' && <StepLayout project={project} onChange={update} />}
        {step === 'produzir' && <StepProduce project={project} onChange={update} />}
        {step === 'fim' && <Done project={project} onRestart={restart} onBack={() => setStep('proposta')} />}

        {message && (
          <p className="banner banner--error" role="alert" style={{ marginTop: 18 }}>
            {message}
          </p>
        )}
      </main>

      {step !== 'inicio' && step !== 'fim' && (
        <div className="actionbar">
          <div className="actionbar__inner">
            <button className="btn" onClick={goBack}>
              ← Voltar
            </button>
            <button className="btn btn--primary btn--block" onClick={goNext}>
              {nextLabel} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
