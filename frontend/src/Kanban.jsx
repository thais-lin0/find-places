import { useState } from "react";
import Icon from "./Icon";
import { Avatar, waLink } from "./ui";
import { STAGES } from "./useLeads";

function LeadCard({ lead, onMove, onNote, onField, onRemove, onDragStart, dragging }) {
  const [editing, setEditing] = useState(false);
  const idx = STAGES.findIndex((s) => s.id === lead.stage);
  const prev = STAGES[idx - 1];
  const next = STAGES[idx + 1];
  const wa = waLink(lead.contato || lead.telefone);

  return (
    <article
      className={`lead-card ${dragging ? "is-dragging" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
    >
      <header className="lead-head">
        <Avatar name={lead.nome} seed={lead.categoria} size="sm" />
        <div className="lead-title">
          <strong>{lead.nome}</strong>
          {lead.categoria && <span>{lead.categoria}</span>}
        </div>
        <button
          className="btn btn-ghost btn-icon btn-xs lead-remove"
          title="Remover do pipeline"
          aria-label={`Remover ${lead.nome} do pipeline`}
          onClick={() => {
            if (confirm(`Remover "${lead.nome}" do pipeline?`)) onRemove(lead.id);
          }}
        >
          <Icon name="trash" size={14} />
        </button>
      </header>

      {lead.endereco && <p className="lead-addr">{lead.endereco}</p>}

      <div className="lead-links">
        {lead.telefone && (
          <a href={`tel:${lead.telefone}`} className="chip" title="Ligar">
            <Icon name="phone" size={13} /> {lead.telefone}
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="chip chip-wa" title="Abrir WhatsApp">
            <Icon name="chat" size={13} /> WhatsApp
          </a>
        )}
        {lead.tem_site === "sim" && lead.site && (
          <a href={lead.site} target="_blank" rel="noreferrer" className="chip" title="Site atual">
            <Icon name="globe" size={13} />
          </a>
        )}
        {lead.maps_url && (
          <a href={lead.maps_url} target="_blank" rel="noreferrer" className="chip" title="Google Maps">
            <Icon name="map" size={13} />
          </a>
        )}
      </div>

      <div className="lead-fields">
        <label className="field">
          <span className="field-label">Contato (WhatsApp)</span>
          <input
            className="input input-sm"
            type="tel"
            placeholder="ex: 11 91234-5678"
            value={lead.contato || ""}
            onChange={(e) => onField(lead.id, "contato", e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">
            Link da demo
            {lead.demo && (
              <a href={lead.demo} target="_blank" rel="noreferrer" className="link">
                abrir <Icon name="external" size={11} />
              </a>
            )}
          </span>
          <input
            className="input input-sm"
            type="url"
            placeholder="https://…"
            value={lead.demo || ""}
            onChange={(e) => onField(lead.id, "demo", e.target.value)}
          />
        </label>
      </div>

      {editing ? (
        <textarea
          className="input input-sm lead-note-input"
          autoFocus
          rows={3}
          placeholder="Anotações (próximo passo, contato, valor…)"
          value={lead.note}
          onChange={(e) => onNote(lead.id, e.target.value)}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <button className={`lead-note ${lead.note ? "has-note" : ""}`} onClick={() => setEditing(true)}>
          {lead.note || (
            <>
              <Icon name="note" size={13} /> Adicionar nota
            </>
          )}
        </button>
      )}

      <footer className="lead-actions">
        <button
          className="btn btn-ghost btn-sm"
          disabled={!prev}
          onClick={() => prev && onMove(lead.id, prev.id)}
          title={prev ? `Voltar para ${prev.label}` : ""}
        >
          <Icon name="left" size={14} />
        </button>
        <span className="lead-stage-hint">{next ? `Próximo: ${next.label}` : "Etapa final"}</span>
        <button
          className="btn btn-ghost btn-sm"
          disabled={!next}
          onClick={() => next && onMove(lead.id, next.id)}
          title={next ? `Avançar para ${next.label}` : ""}
        >
          <Icon name="right" size={14} />
        </button>
      </footer>
    </article>
  );
}

export default function Kanban({ leads, onMove, onNote, onField, onRemove, onGoToList }) {
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (stage) => {
    if (dragId) onMove(dragId, stage);
    setDragId(null);
    setOverStage(null);
  };

  if (leads.length === 0) {
    return (
      <div className="empty-state empty-state-lg">
        <span className="empty-icon">
          <Icon name="board" size={22} />
        </span>
        <strong>Seu pipeline está vazio</strong>
        <p>
          Encontre um local na Prospecção e clique em <b>Iniciar</b> para começar a acompanhar aqui.
        </p>
        <button className="btn btn-primary" onClick={onGoToList}>
          Ir para Prospecção
        </button>
      </div>
    );
  }

  return (
    <div className="kanban" onDragEnd={() => { setDragId(null); setOverStage(null); }}>
      {STAGES.map((stage) => {
        const cards = leads.filter((l) => l.stage === stage.id);
        return (
          <section
            key={stage.id}
            className={`kanban-col ${overStage === stage.id ? "drag-over" : ""}`}
            style={{ "--stage": stage.accent }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage.id);
            }}
            onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
            onDrop={() => onDrop(stage.id)}
          >
            <header className="kanban-col-head">
              <span className="dot" />
              <span className="kanban-col-title">{stage.label}</span>
              <span className="kanban-count">{cards.length}</span>
            </header>
            <div className="kanban-cards">
              {cards.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onMove={onMove}
                  onNote={onNote}
                  onField={onField}
                  onRemove={onRemove}
                  onDragStart={onDragStart}
                  dragging={dragId === lead.id}
                />
              ))}
              {cards.length === 0 && <div className="kanban-drop">Solte um card aqui</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
