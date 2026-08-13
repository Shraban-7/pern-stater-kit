import { useEffect, useMemo, useState } from 'react';
import { getJson, postJson } from './api';
import { OptionsPanel } from './OptionsPanel';
import { saveProjectLocally, downloadZip } from './save-local';
import { PRESETS, type Bundle, type Plan, type PresetId, type StarterConfig } from './types';

export function App() {
  const [config, setConfig] = useState<StarterConfig | null>(null);
  const [preset, setPreset] = useState('default');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    void getJson<{ config: StarterConfig }>('/api/defaults')
      .then((data) => {
        data.config.frontend.kind = 'vite-react';
        setConfig(data.config);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!config) return;
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
    setConfig((current) => (current ? update(current) : current));
    setStatus(null);
    setNextSteps([]);
  };

  const applyPreset = async (id: PresetId) => {
    setPreset(id);
    const data = await postJson<{ config: StarterConfig }>('/api/preset', {
      name: config?.name ?? 'my-app',
      preset: id,
    });
    if (data.config.frontend.kind !== 'none') data.config.frontend.kind = 'vite-react';
    setConfig(data.config);
  };

  const generateLocally = async (forceZip = false) => {
    if (!config) return;
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
    if (!config) return '';
    return config.frontend.kind === 'none' ? 'API only' : 'React + Vite';
  }, [config]);

  if (!config) return <div className="app">Loading…</div>;

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
                void getJson<{ config: StarterConfig }>('/api/defaults').then((data) => {
                  data.config.name = config.name;
                  data.config.frontend.kind = 'vite-react';
                  setConfig(data.config);
                });
              }}
            >
              Default
            </button>
            {PRESETS.map((id) => (
              <button
                key={id}
                type="button"
                className={preset === id ? 'active' : ''}
                onClick={() => void applyPreset(id)}
              >
                {id}
              </button>
            ))}
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
