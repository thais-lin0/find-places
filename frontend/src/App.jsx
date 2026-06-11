import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import Kanban from "./Kanban";
import Icon from "./Icon";
import { haversineKm } from "./OriginPicker";
import Setup from "./Setup";
import { Avatar, fmtInt, waLink } from "./ui";
import { useLeads } from "./useLeads";

const WEBSITE_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "no", label: "Sem site" },
  { id: "yes", label: "Com site" },
];

const DEFAULT_FILTERS = { search: "", websiteFilter: "no", category: "", minRating: 0 };

function downloadCsv(rows, filename) {
  // Remove campos internos (ex.: _dist) antes de exportar.
  const clean = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("_"))));
  const csv = Papa.unparse(clean);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const fmtDistance = (km) =>
  km == null ? "—" : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`;

// Rótulos amigáveis para o painel de detalhes.
const FIELD_LABELS = {
  id: "ID Google",
  nome: "Nome",
  categoria: "Categoria",
  tipos_busca: "Tipos buscados",
  tipos: "Todos os tipos",
  endereco: "Endereço",
  telefone: "Telefone",
  site: "Site",
  tem_site: "Tem site?",
  nota: "Nota",
  avaliacoes: "Nº de avaliações",
  status: "Status do negócio",
  lat: "Latitude",
  lng: "Longitude",
  maps_url: "Google Maps",
};

const STATUS_LABELS = {
  OPERATIONAL: "Em funcionamento",
  CLOSED_TEMPORARILY: "Fechado temporariamente",
  CLOSED_PERMANENTLY: "Fechado permanentemente",
};

function Kpi({ label, value, hint, tone, meter }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {meter != null && (
        <span className="meter" aria-hidden="true">
          <span style={{ width: `${meter}%` }} />
        </span>
      )}
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

function SitePill({ row, link }) {
  if (row.tem_site === "sim") {
    return link && row.site ? (
      <a href={row.site} target="_blank" rel="noreferrer" className="pill pill-neutral">
        <Icon name="globe" size={13} /> Tem site <Icon name="external" size={12} />
      </a>
    ) : (
      <span className="pill pill-neutral">Tem site</span>
    );
  }
  return (
    <span className="pill pill-opportunity">
      <Icon name="spark" size={13} /> Sem site
    </span>
  );
}

function DetailDrawer({ row, onClose, onStart, inCrm }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const wa = waLink(row.telefone);

  const renderValue = (key, value) => {
    if (value === undefined || value === null || value === "") return <span className="muted">—</span>;
    if (key === "site" || key === "maps_url") {
      return (
        <a href={value} target="_blank" rel="noreferrer" className="link">
          {value}
        </a>
      );
    }
    if (key === "tem_site") return value === "sim" ? "Sim" : "Não";
    if (key === "status") return STATUS_LABELS[value] || value;
    return String(value);
  };

  // Ordena as chaves: conhecidas primeiro (na ordem do mapa), depois extras.
  const known = Object.keys(FIELD_LABELS).filter((k) => k in row);
  const extra = Object.keys(row).filter((k) => !(k in FIELD_LABELS) && !k.startsWith("_"));

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <aside
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <Avatar name={row.nome} seed={row.categoria} size="lg" />
          <div className="sheet-title">
            <h2 id="sheet-title">{row.nome || "Local"}</h2>
            <p>{row.categoria}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </header>

        <div className="sheet-body">
          <SitePill row={row} link />

          <div className="metrics">
            <div>
              <span>Nota</span>
              <strong>
                <Icon name="star" size={15} className="icon-star" /> {row.nota || "—"}
              </strong>
            </div>
            <div>
              <span>Avaliações</span>
              <strong>{fmtInt(row.avaliacoes)}</strong>
            </div>
            <div>
              <span>Distância</span>
              <strong>{fmtDistance(row._dist)}</strong>
            </div>
          </div>

          <div className="quick-actions">
            {row.telefone && (
              <a className="action" href={`tel:${row.telefone}`}>
                <Icon name="phone" /> Ligar
              </a>
            )}
            {wa && (
              <a className="action" href={wa} target="_blank" rel="noreferrer">
                <Icon name="chat" /> WhatsApp
              </a>
            )}
            {row.maps_url && (
              <a className="action" href={row.maps_url} target="_blank" rel="noreferrer">
                <Icon name="map" /> Maps
              </a>
            )}
          </div>

          <dl className="facts">
            <div>
              <dt>Endereço</dt>
              <dd>{renderValue("endereco", row.endereco)}</dd>
            </div>
            <div>
              <dt>Telefone</dt>
              <dd>{renderValue("telefone", row.telefone)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{renderValue("status", row.status)}</dd>
            </div>
          </dl>

          <details className="raw">
            <summary>Todos os dados</summary>
            <dl className="facts facts-compact">
              {[...known, ...extra].map((key) => (
                <div key={key}>
                  <dt>{FIELD_LABELS[key] || key}</dt>
                  <dd>{renderValue(key, row[key])}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <footer className="sheet-foot">
          {inCrm ? (
            <div className="in-crm">
              <Icon name="check" /> Já está no pipeline
            </div>
          ) : (
            <button className="btn btn-primary btn-block" onClick={() => onStart(row)}>
              <Icon name="plus" /> Adicionar ao pipeline
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

// Resultado da última extração, salvo no navegador para sobreviver a um reload.
const RESULT_STORAGE = "search-result-v1";

function loadResult() {
  try {
    return JSON.parse(localStorage.getItem(RESULT_STORAGE)) || null;
  } catch {
    return null;
  }
}

function SearchSummary({ result, onNew }) {
  const date = new Date(result.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return (
    <section className="origin summary" aria-label="Busca atual">
      <div className="origin-head">
        <span className="origin-icon">
          <Icon name="pin" size={18} />
        </span>
        <div className="origin-text">
          <span className="eyebrow">Busca atual · {date}</span>
          <strong title={result.center.label}>{result.center.label}</strong>
        </div>
      </div>
      <div className="summary-meta">
        <span className="pill pill-neutral">raio {result.radiusKm} km</span>
        <span className="pill pill-neutral">{result.types.length} categorias</span>
        <button className="btn btn-secondary btn-sm summary-new" onClick={onNew}>
          <Icon name="search" size={14} /> Nova busca
        </button>
      </div>
      {result.errors > 0 && (
        <p className="origin-error">{result.errors} categorias falharam e ficaram de fora.</p>
      )}
    </section>
  );
}

export default function App() {
  const [result, setResult] = useState(loadResult);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState(() => (loadResult() ? "lista" : "setup"));
  const searchRef = useRef(null);

  const { leads, ids: leadIds, startLead, moveLead, updateNote, updateField, removeLead } = useLeads();

  const [search, setSearch] = useState(DEFAULT_FILTERS.search);
  const [websiteFilter, setWebsiteFilter] = useState(DEFAULT_FILTERS.websiteFilter);
  const [category, setCategory] = useState(DEFAULT_FILTERS.category);
  const [minRating, setMinRating] = useState(DEFAULT_FILTERS.minRating);
  const [sortBy, setSortBy] = useState("near");

  useEffect(() => {
    try {
      if (result) localStorage.setItem(RESULT_STORAGE, JSON.stringify(result));
    } catch {
      /* resultado grande demais ou storage bloqueado — fica só na memória */
    }
  }, [result]);

  const rows = result?.rows || [];
  const origin = result?.center;

  // "/" foca a busca, como em ferramentas tipo GitHub/Linear.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Distância calculada no navegador a partir do ponto de partida escolhido pelo usuário.
  const placed = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        _dist: origin ? haversineKm(origin.lat, origin.lng, Number(r.lat), Number(r.lng)) : null,
      })),
    [rows, origin]
  );

  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => r.categoria && set.add(r.categoria));
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = placed.filter((r) => {
      if (websiteFilter === "no" && r.tem_site !== "nao") return false;
      if (websiteFilter === "yes" && r.tem_site !== "sim") return false;
      if (category && r.categoria !== category) return false;
      if (minRating && (Number(r.nota) || 0) < minRating) return false;
      if (q) {
        const hay = `${r.nome} ${r.endereco} ${r.categoria} ${r.tipos}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dist = (r) => (r._dist == null ? Infinity : r._dist);
    list = [...list].sort((a, b) => {
      if (sortBy === "near") return dist(a) - dist(b);
      if (sortBy === "far") return dist(b) - dist(a);
      if (sortBy === "reviews") return (Number(b.avaliacoes) || 0) - (Number(a.avaliacoes) || 0);
      if (sortBy === "rating") return (Number(b.nota) || 0) - (Number(a.nota) || 0);
      if (sortBy === "name") return (a.nome || "").localeCompare(b.nome || "");
      return 0;
    });
    return list;
  }, [placed, search, websiteFilter, category, minRating, sortBy]);

  const totals = useMemo(() => {
    const without = rows.filter((r) => r.tem_site === "nao").length;
    return { total: rows.length, without, with: rows.length - without };
  }, [rows]);

  const filtersDirty =
    search !== DEFAULT_FILTERS.search ||
    websiteFilter !== DEFAULT_FILTERS.websiteFilter ||
    category !== DEFAULT_FILTERS.category ||
    minRating !== DEFAULT_FILTERS.minRating;

  const resetFilters = () => {
    setSearch(DEFAULT_FILTERS.search);
    setWebsiteFilter(DEFAULT_FILTERS.websiteFilter);
    setCategory(DEFAULT_FILTERS.category);
    setMinRating(DEFAULT_FILTERS.minRating);
  };

  const pct = totals.total ? Math.round((totals.without / totals.total) * 100) : 0;
  const selectedRow = selected && placed.find((r) => r.id === selected);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="pin" size={16} />
          </span>
          <span className="brand-name">Find Places</span>
        </div>

        <nav className="nav" aria-label="Seções">
          <button className={view === "lista" ? "active" : ""} onClick={() => setView("lista")}>
            <Icon name="list" /> Prospecção
          </button>
          <button className={view === "crm" ? "active" : ""} onClick={() => setView("crm")}>
            <Icon name="board" /> Pipeline
            {leads.length > 0 && <span className="nav-count">{leads.length}</span>}
          </button>
        </nav>

        <div className="topbar-end">
          {view === "lista" && result && (
            <button
              className="btn btn-secondary"
              disabled={!filtered.length}
              onClick={() => downloadCsv(filtered, `locais-${websiteFilter}.csv`)}
            >
              <Icon name="download" /> <span className="hide-sm">Exportar</span>
              <span className="btn-badge">{filtered.length}</span>
            </button>
          )}
        </div>
      </header>

      {view === "setup" && (
        <Setup
          hasResults={!!result}
          onCancel={() => setView("lista")}
          onDone={(r) => {
            setResult(r);
            setSelected(null);
            setSortBy("near");
            setView("lista");
          }}
        />
      )}

      {view === "lista" && !result && (
        <main>
          <div className="empty-state empty-state-lg page-gap">
            <span className="empty-icon"><Icon name="search" size={22} /></span>
            <strong>Nenhuma busca ainda</strong>
            <p>Defina seu endereço e os tipos de negócio para começar.</p>
            <button className="btn btn-primary" onClick={() => setView("setup")}>Configurar busca</button>
          </div>
        </main>
      )}

      {view === "lista" && result && (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">Prospecção via Google Places</span>
              <h1>
                {totals.without.toLocaleString("pt-BR")} negócios <em>sem site</em>
                <br /> esperando pela sua proposta.
              </h1>
              <p className="lede">
                Filtre, priorize pelos mais próximos e mais avaliados, e leve os melhores leads para o
                pipeline.
              </p>
            </div>
            <SearchSummary result={result} onNew={() => setView("setup")} />
          </section>

          <section className="kpis">
            <Kpi label="Locais mapeados" value={fmtInt(totals.total)} />
            <Kpi
              label="Sem site"
              value={fmtInt(totals.without)}
              tone="accent"
              meter={pct}
              hint={`${pct}% da base — suas oportunidades`}
            />
            <Kpi label="Com site" value={fmtInt(totals.with)} />
            <Kpi label="No pipeline" value={leads.length} hint={leads.length ? "acompanhe em Pipeline" : "nenhum lead ainda"} />
          </section>

          <section className="toolbar" aria-label="Filtros">
            <label className="search">
              <Icon name="search" />
              <input
                ref={searchRef}
                type="search"
                placeholder="Buscar por nome, endereço, categoria…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>/</kbd>
            </label>

            <div className="segmented" role="group" aria-label="Filtrar por site">
              {WEBSITE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={websiteFilter === f.id ? "active" : ""}
                  aria-pressed={websiteFilter === f.id}
                  onClick={() => setWebsiteFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select className="select" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} aria-label="Nota mínima">
              <option value={0}>Qualquer nota</option>
              <option value={3}>★ 3+</option>
              <option value={4}>★ 4+</option>
              <option value={4.5}>★ 4.5+</option>
            </select>

            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Ordenar">
              <option value="near">Mais perto primeiro</option>
              <option value="far">Mais longe primeiro</option>
              <option value="reviews">Mais avaliados</option>
              <option value="rating">Melhor nota</option>
              <option value="name">Nome (A–Z)</option>
            </select>
          </section>

          <div className="results-bar">
            <span>
              Exibindo <strong>{filtered.length.toLocaleString("pt-BR")}</strong> de{" "}
              {fmtInt(totals.total)} locais
            </span>
            {filtersDirty && (
              <button className="btn btn-link" onClick={resetFilters}>
                Limpar filtros
              </button>
            )}
          </div>

          <div className="table-card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Local</th>
                    <th>Categoria</th>
                    <th className="num">Distância</th>
                    <th className="num">Nota</th>
                    <th>Site</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                      <tr
                        key={r.id}
                        tabIndex={0}
                        onClick={() => setSelected(r.id)}
                        onKeyDown={(e) => e.key === "Enter" && setSelected(r.id)}
                      >
                        <td className="col-place">
                          <div className="place">
                            <Avatar name={r.nome} seed={r.categoria} />
                            <div className="place-text">
                              <div className="place-name">{r.nome}</div>
                              <div className="place-addr">{r.endereco}</div>
                            </div>
                          </div>
                        </td>
                        <td className="col-cat">
                          <span className="cat">{r.categoria || "—"}</span>
                        </td>
                        <td className="num col-dist mono">{fmtDistance(r._dist)}</td>
                        <td className="num col-rating">
                          <span className="rating">
                            <Icon name="star" size={13} className="icon-star" /> {r.nota || "—"}
                          </span>
                          <span className="reviews">{fmtInt(r.avaliacoes)} aval.</span>
                        </td>
                        <td className="col-site">
                          <SitePill row={r} />
                        </td>
                        <td className="col-actions">
                          <a
                            href={r.maps_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-icon"
                            title="Abrir no Google Maps"
                            aria-label={`Abrir ${r.nome} no Google Maps`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Icon name="map" />
                          </a>
                          {leadIds.has(r.id) ? (
                            <span className="pill pill-success">
                              <Icon name="check" size={13} /> No pipeline
                            </span>
                          ) : (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                startLead(r);
                              }}
                            >
                              <Icon name="plus" size={14} /> Iniciar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <strong>Nenhum local com esses filtros.</strong>
                          <button className="btn btn-link" onClick={resetFilters}>
                            Limpar filtros
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
        </main>
      )}

      {view === "crm" && (
        <main>
          <section className="page-head">
            <span className="eyebrow">Pipeline</span>
            <h1>
              {leads.length} {leads.length === 1 ? "lead" : "leads"} <em>em andamento</em>
            </h1>
            <p className="lede">Arraste os cards entre as etapas. Tudo fica salvo neste navegador.</p>
          </section>
          <Kanban
            leads={leads}
            onMove={moveLead}
            onNote={updateNote}
            onField={updateField}
            onRemove={removeLead}
            onGoToList={() => setView("lista")}
          />
        </main>
      )}

      {selectedRow && (
        <DetailDrawer
          row={selectedRow}
          onClose={() => setSelected(null)}
          onStart={(r) => startLead(r)}
          inCrm={leadIds.has(selectedRow.id)}
        />
      )}
    </div>
  );
}
