import { useCallback, useEffect, useState } from "react";

// Estágios do funil (Kanban). Edite à vontade — a ordem aqui é a ordem das colunas.
export const STAGES = [
  { id: "fazendo_site", label: "Fazendo site", accent: "var(--blue)" },
  { id: "em_contato", label: "Em contato", accent: "var(--violet)" },
  { id: "reuniao", label: "Reunião", accent: "var(--amber)" },
  { id: "fechamento", label: "Fechamento", accent: "var(--orange)" },
  { id: "ganho", label: "Ganho", accent: "var(--green)" },
  { id: "perdido", label: "Perdido", accent: "var(--red)" },
];

export const FIRST_STAGE = STAGES[0].id;

const STORAGE_KEY = "crm-leads-v1";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Campos do local que guardamos junto ao lead (snapshot, não depende do CSV).
function snapshot(row) {
  return {
    id: row.id,
    nome: row.nome || "Local",
    categoria: row.categoria || "",
    endereco: row.endereco || "",
    telefone: row.telefone || "",
    site: row.site || "",
    tem_site: row.tem_site || "",
    maps_url: row.maps_url || "",
  };
}

export function useLeads() {
  const [leads, setLeads] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch {
      /* armazenamento cheio ou indisponível — ignora */
    }
  }, [leads]);

  // Conjunto de ids já no CRM, para a lista saber o que mostrar.
  const ids = new Set(leads.map((l) => l.id));

  const startLead = useCallback((row) => {
    setLeads((prev) => {
      if (prev.some((l) => l.id === row.id)) return prev;
      return [
        ...prev,
        { ...snapshot(row), stage: FIRST_STAGE, note: "", createdAt: Date.now() },
      ];
    });
  }, []);

  const moveLead = useCallback((id, stage) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
  }, []);

  const updateNote = useCallback((id, note) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, note } : l)));
  }, []);

  // Atualiza um campo livre do lead (ex.: contato/WhatsApp, link da demo).
  const updateField = useCallback((id, key, value) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  }, []);

  const removeLead = useCallback((id) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return { leads, ids, startLead, moveLead, updateNote, updateField, removeLead };
}
