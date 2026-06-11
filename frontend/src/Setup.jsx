import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import OriginPicker, { useOrigin } from "./OriginPicker";
import { CATEGORY_GROUPS, TYPE_LABELS, extract } from "./places";

const KEY_STORAGE = "gmaps-api-key";
const PREFS_STORAGE = "search-prefs-v1";

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível — vale só para esta sessão */
  }
}

function Step({ n, title, done, children, aside }) {
  return (
    <section className={`step ${done ? "is-done" : ""}`}>
      <header className="step-head">
        <span className="step-n">{done ? <Icon name="check" size={14} /> : n}</span>
        <h2>{title}</h2>
        {aside}
      </header>
      <div className="step-body">{children}</div>
    </section>
  );
}

function ApiKeyField({ apiKey, onChange }) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(!apiKey);

  if (apiKey && !editing) {
    return (
      <div className="key-saved">
        <Icon name="check" className="key-ok" />
        <span className="mono">••••••••{apiKey.slice(-4)}</span>
        <span className="muted">salva neste navegador</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Trocar</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { onChange(null); setEditing(true); }}>Remover</button>
      </div>
    );
  }

  return (
    <>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onChange(draft.trim());
          setDraft("");
          setEditing(false);
        }}
      >
        <input
          className="input mono"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Chave da Google Maps API"
        />
        <button className="btn btn-primary" disabled={!draft.trim()}>Salvar</button>
        {apiKey && (
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
        )}
      </form>
      <p className="help">
        Precisa ter a <b>Places API (New)</b> habilitada.{" "}
        <a className="link" href="https://developers.google.com/maps/documentation/places/web-service/get-api-key" target="_blank" rel="noreferrer">
          Como criar uma chave <Icon name="external" size={11} />
        </a>
        <br />
        A chave fica só no seu navegador e é enviada apenas ao Google. Recomendado: restrinja-a à Places API e ao
        domínio deste site.
      </p>
    </>
  );
}

export default function Setup({ hasResults, onDone, onCancel }) {
  const [apiKey, setApiKeyState] = useState(() => readStorage(KEY_STORAGE, null));
  const [origin, setOrigin] = useOrigin();
  const prefs = readStorage(PREFS_STORAGE, {});
  const [radiusKm, setRadiusKm] = useState(prefs.radiusKm || 10);
  const [types, setTypes] = useState(() => new Set(prefs.types || []));
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const setApiKey = (k) => {
    setApiKeyState(k);
    writeStorage(KEY_STORAGE, k);
  };

  useEffect(() => writeStorage(PREFS_STORAGE, { radiusKm, types: [...types] }), [radiusKm, types]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const toggle = (type) =>
    setTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });

  const toggleGroup = (group, on) =>
    setTypes((prev) => {
      const next = new Set(prev);
      group.types.forEach(([t]) => (on ? next.add(t) : next.delete(t)));
      return next;
    });

  const ready = apiKey && origin && types.size > 0;
  const running = progress != null;

  const run = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setProgress({ done: 0, total: types.size, type: null, found: 0 });
    try {
      const { rows, errors } = await extract({
        apiKey,
        center: origin,
        radiusM: radiusKm * 1000,
        types: [...types],
        signal: controller.signal,
        onProgress: setProgress,
      });
      onDone({ rows, errors, center: origin, radiusKm, types: [...types], at: Date.now() });
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(
          err.status === 403 || err.status === 400
            ? `O Google recusou a chave: ${err.message}`
            : `Falha na busca: ${err.message}`
        );
      }
      setProgress(null);
    }
  };

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <main className="setup">
      <section className="page-head setup-head">
        <span className="eyebrow">Nova busca</span>
        <h1>
          Encontre negócios <em>sem site</em> perto de você.
        </h1>
        <p className="lede">
          Três passos: sua chave do Google, o ponto de partida e o tipo de negócio. A extração roda direto no seu
          navegador.
        </p>
        {hasResults && (
          <button className="btn btn-link" onClick={onCancel}>
            <Icon name="left" size={14} /> Voltar aos resultados
          </button>
        )}
      </section>

      <div className="steps">
        <Step n={1} title="Chave da Google Places API" done={!!apiKey}>
          <ApiKeyField apiKey={apiKey} onChange={setApiKey} />
        </Step>

        <Step n={2} title="Ponto de partida e raio" done={!!origin}>
          <OriginPicker origin={origin} onChange={setOrigin} />
          <label className="radius">
            <span className="radius-head">
              <span>Raio da busca</span>
              <strong className="mono">{radiusKm} km</strong>
            </span>
            <input
              type="range"
              min={1}
              max={50}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              style={{ "--fill": `${((radiusKm - 1) / 49) * 100}%` }}
            />
            <span className="radius-scale mono"><span>1 km</span><span>50 km</span></span>
          </label>
        </Step>

        <Step
          n={3}
          title="Tipos de estabelecimento"
          done={types.size > 0}
          aside={
            <div className="step-aside">
              <span className="muted">{types.size} selecionados</span>
              {types.size > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setTypes(new Set())}>Limpar</button>
              )}
            </div>
          }
        >
          <div className="groups">
            {CATEGORY_GROUPS.map((group) => {
              const all = group.types.every(([t]) => types.has(t));
              return (
                <div key={group.label} className="group">
                  <div className="group-head">
                    <span>{group.label}</span>
                    <button className="btn btn-link btn-xs-text" onClick={() => toggleGroup(group, !all)}>
                      {all ? "Desmarcar" : "Marcar todos"}
                    </button>
                  </div>
                  <div className="chips">
                    {group.types.map(([type, label]) => (
                      <button
                        key={type}
                        className={`select-chip ${types.has(type) ? "on" : ""}`}
                        aria-pressed={types.has(type)}
                        onClick={() => toggle(type)}
                      >
                        {types.has(type) && <Icon name="check" size={13} />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Step>
      </div>

      <div className="runbar">
        {running ? (
          <div className="runbar-progress" role="status" aria-live="polite">
            <div className="runbar-text">
              <strong>
                {progress.type ? `Buscando ${TYPE_LABELS[progress.type] || progress.type}…` : "Finalizando…"}
              </strong>
              <span className="muted mono">
                {progress.done}/{progress.total} · {progress.found} locais
              </span>
            </div>
            <span className="meter meter-lg"><span style={{ width: `${pct}%` }} /></span>
            <button className="btn btn-ghost" onClick={() => abortRef.current?.abort()}>Cancelar</button>
          </div>
        ) : (
          <>
            <div className="runbar-text">
              <strong>
                {types.size} {types.size === 1 ? "categoria" : "categorias"} · raio de {radiusKm} km
              </strong>
              <span className="muted">
                {types.size} chamadas à API (até {types.size * 20} locais) ·{" "}
                <a className="link" href="https://developers.google.com/maps/billing-and-pricing/pricing" target="_blank" rel="noreferrer">
                  ver preços
                </a>
              </span>
            </div>
            <button className="btn btn-primary btn-lg" disabled={!ready} onClick={run}>
              <Icon name="search" /> Buscar locais
            </button>
          </>
        )}
        {error && <p className="runbar-error" role="alert">{error}</p>}
      </div>
    </main>
  );
}
