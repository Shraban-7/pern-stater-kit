import { useEffect, useMemo, useState } from 'react';
import { postJson } from './api';
import { clientDefaultConfig, clientPresetConfig } from './config';
import { OptionsPanel } from './OptionsPanel';
import { saveProjectLocally, downloadZip } from './save-local';
import { PRESETS, type Bundle, type Plan, type PresetId, type StarterConfig } from './types';

export function App() {
  const [config, setConfig] = useState<StarterConfig>(() => clientDefaultConfig('my-app'));
  const [preset, setPreset] = useState('default');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void postJson<Plan>('/api/plan', { config })
        .then((data) => {
          setPlan(data);
          setError(null);
        })
        .catch((err: Error) => setError(err.message));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [config]);

  const patch = (update: (current: StarterConfig) => StarterConfig) => {
    setConfig((current) => update(current));
    setStatus(null);
    setNextSteps([]);
  };

  const applyPreset = (id: PresetId) => {
    setPreset(id);
    setConfig(clientPresetConfig(config.name, id));
  };

  const generateLocally = async (forceZip = false) => {
    setBusy(true);
    setError(null);
    try {
      const bundle = await postJson<Bundle>('/api/bundle', { config });
      const result = forceZip
        ? await downloadZip(bundle.project, bundle.contents)
        : await saveProjectLocally(bundle.project, bundle.contents);
      setStatus(result.detail);
      setNextSteps(bundle.next ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.toLowerCase().includes('abort')) setError(message);
    } finally {
      setBusy(false);
    }
  };

  const frontendLabel = useMemo(() => {
    return config.frontend.kind === 'none' ? 'API only' : 'React + Vite';
  }, [config]);

  return (
    <div className="app">
      <header className="mast">
        <div className="reg-mark" aria-hidden="true" />
        <div>
          <h1>PERN Starter</h1>
          <p>Hosted UI · files save on your computer</p>
        </div>
        <div className="vite-pill">Vite · Vercel</div>
      </header>

      <main className="board">
        <section className="panel">
          <label className="field span">
            <span>Project name</span>
            <input
              value={config.name}
              onChange={(event) => patch((c) => ({ ...c, name: event.target.value }))}
            />
          </label>

          <div className="presets">
            <button
              type="button"
              className={preset === 'default' ? 'active' : ''}
              onClick={() => {
                setPreset('default');
                setConfig((current) => clientDefaultConfig(current.name));
              }}
            >
              Default
            </button>
            {PRESETS.map((id) => (
              <button
                key={id}
                type="button"
                className={preset === id ? 'active' : ''}
                onClick={() => applyPreset(id)}
              >
                {id}
              </button>
            ))}
          </div>

          <p className="k">ORM</p>
          <div className="presets">
            <button
              type="button"
              className={config.orm === 'prisma' ? 'active' : ''}
              onClick={() => patch((c) => ({ ...c, orm: 'prisma' }))}
            >
              Prisma
            </button>
            <button
              type="button"
              className={config.orm === 'drizzle' ? 'active' : ''}
              onClick={() => patch((c) => ({ ...c, orm: 'drizzle' }))}
            >
              Drizzle
            </button>
          </div>

          <p className="lede">
            {frontendLabel} · {config.orm} · {config.auth === 'none' ? 'no auth' : config.auth} ·{' '}
            {plan?.files.length ?? 0} files. The site can live on Vercel; generation never writes to
            the server disk.
          </p>

          <div className="actions">
            <button type="button" className="primary" disabled={busy} onClick={() => void generateLocally(false)}>
              {busy ? 'Saving…' : 'Save to this computer'}
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => void generateLocally(true)}>
              Download zip
            </button>
            <button type="button" className="ghost" onClick={() => setOptionsOpen(true)}>
              Options
            </button>
          </div>

          {error ? <p className="err">{error}</p> : null}
          {status ? <p className="ok">{status}</p> : null}
          {nextSteps.length ? (
            <ol className="next">
              {nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
        </section>

        <aside className="sheet">
          <div>
            <h2>Files</h2>
            <div className="meta">
              {config.name} · local save or zip
            </div>
          </div>
          <div className="cut">
            {(plan?.files ?? []).slice(0, 48).map((file) => (
              <div key={file}>+ {file}</div>
            ))}
            {(plan?.files.length ?? 0) > 48 ? <div>… {plan!.files.length - 48} more</div> : null}
          </div>
        </aside>
      </main>

      {optionsOpen ? (
        <div className="overlay" role="presentation" onClick={() => setOptionsOpen(false)}>
          <div role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <OptionsPanel
              config={config}
              onChange={patch}
              onClose={() => setOptionsOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
