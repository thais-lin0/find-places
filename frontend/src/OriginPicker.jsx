import { useEffect, useState } from "react";
import Icon from "./Icon";

// Ponto de partida das distâncias. Fica só no navegador de quem usa — nunca vai pro CSV/repo.
const STORAGE_KEY = "origin-v1";

// Distância em km entre dois pontos (Haversine).
export function haversineKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useOrigin() {
  const [origin, setOrigin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (origin) localStorage.setItem(STORAGE_KEY, JSON.stringify(origin));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* armazenamento indisponível — vale só para esta sessão */
    }
  }, [origin]);

  return [origin, setOrigin];
}

// Geocodifica via Nominatim (OpenStreetMap): gratuito e sem API key, então nada sensível no frontend.
async function geocode(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", "accept-language": "pt-BR" });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao buscar endereço (HTTP ${res.status})`);
  const [hit] = await res.json();
  if (!hit) throw new Error("Endereço não encontrado. Tente incluir cidade e estado.");
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    label: hit.display_name.split(",").slice(0, 3).join(",").trim(),
  };
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocalização indisponível neste navegador."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, label: "Minha localização atual" }),
      () => reject(new Error("Não foi possível obter sua localização. Verifique a permissão do navegador.")),
      { timeout: 10000 }
    );
  });
}

export default function OriginPicker({ origin, onChange }) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const showForm = editing || !origin;

  const run = async (resolver) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await resolver());
      setEditing(false);
      setQuery("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`origin ${showForm ? "is-editing" : ""}`} aria-label="Ponto de partida">
      <div className="origin-head">
        <span className="origin-icon">
          <Icon name="pin" size={18} />
        </span>
        <div className="origin-text">
          <span className="eyebrow">Ponto de partida</span>
          {origin && !editing ? (
            <strong title={origin.label}>{origin.label}</strong>
          ) : (
            <strong>De onde calcular as distâncias?</strong>
          )}
        </div>
        {origin && !editing && (
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Alterar
          </button>
        )}
      </div>

      {showForm && (
        <form
          className="origin-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) run(() => geocode(query.trim()));
          }}
        >
          <input
            className="input"
            placeholder="Rua, número, bairro, cidade…"
            value={query}
            autoFocus={editing}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Endereço de partida"
          />
          <button className="btn btn-primary" disabled={busy || !query.trim()}>
            {busy ? "Buscando…" : "Definir"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            title="Usar minha localização"
            aria-label="Usar minha localização"
            disabled={busy}
            onClick={() => run(currentPosition)}
          >
            <Icon name="target" />
          </button>
          {editing && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          )}
        </form>
      )}

      {error && <p className="origin-error" role="alert">{error}</p>}
      {showForm && (
        <p className="origin-note">
          Salvo só neste navegador. A busca do endereço usa o OpenStreetMap.
        </p>
      )}
    </section>
  );
}
