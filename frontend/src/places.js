// Extração via Google Places API (New), direto do navegador com a chave do próprio usuário.

// Tipos da "Table A" da Places API (New), agrupados para a tela de seleção.
export const CATEGORY_GROUPS = [
  {
    label: "Alimentação",
    types: [
      ["restaurant", "Restaurantes"],
      ["pizza_restaurant", "Pizzarias"],
      ["cafe", "Cafeterias"],
      ["bakery", "Padarias"],
      ["bar", "Bares"],
      ["ice_cream_shop", "Sorveterias"],
      ["meal_takeaway", "Comida para viagem"],
      ["meal_delivery", "Delivery"],
    ],
  },
  {
    label: "Beleza e bem-estar",
    types: [
      ["beauty_salon", "Salões de beleza"],
      ["hair_care", "Cabeleireiros"],
      ["barber_shop", "Barbearias"],
      ["nail_salon", "Manicure"],
      ["spa", "Spas"],
      ["gym", "Academias"],
    ],
  },
  {
    label: "Saúde",
    types: [
      ["dentist", "Dentistas"],
      ["doctor", "Médicos"],
      ["physiotherapist", "Fisioterapeutas"],
      ["veterinary_care", "Veterinários"],
      ["pharmacy", "Farmácias"],
    ],
  },
  {
    label: "Comércio",
    types: [
      ["store", "Lojas em geral"],
      ["clothing_store", "Roupas"],
      ["shoe_store", "Calçados"],
      ["furniture_store", "Móveis"],
      ["home_goods_store", "Artigos para casa"],
      ["hardware_store", "Materiais de construção"],
      ["electronics_store", "Eletrônicos"],
      ["pet_store", "Pet shops"],
      ["florist", "Floriculturas"],
      ["book_store", "Livrarias"],
      ["jewelry_store", "Joalherias"],
      ["bicycle_store", "Bicicletarias"],
    ],
  },
  {
    label: "Automotivo",
    types: [
      ["car_repair", "Oficinas"],
      ["car_dealer", "Concessionárias"],
      ["car_wash", "Lava-rápidos"],
      ["gas_station", "Postos"],
    ],
  },
  {
    label: "Serviços",
    types: [
      ["real_estate_agency", "Imobiliárias"],
      ["lawyer", "Advogados"],
      ["accounting", "Contabilidade"],
      ["insurance_agency", "Seguros"],
      ["travel_agency", "Agências de viagem"],
      ["lodging", "Hospedagem"],
      ["laundry", "Lavanderias"],
      ["moving_company", "Mudanças"],
      ["painter", "Pintores"],
      ["plumber", "Encanadores"],
      ["electrician", "Eletricistas"],
      ["roofing_contractor", "Telhados"],
      ["locksmith", "Chaveiros"],
    ],
  },
];

export const TYPE_LABELS = Object.fromEntries(CATEGORY_GROUPS.flatMap((g) => g.types));

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.primaryTypeDisplayName",
  "places.location",
  "places.googleMapsUri",
  "places.businessStatus",
].join(",");

// shortcut: Nearby Search devolve no máximo 20 locais por categoria; para mais cobertura, trocar por Text Search paginado.
async function searchNearby({ apiKey, center, radiusM, type, signal }) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: [type],
      maxResultCount: 20,
      languageCode: "pt-BR",
      locationRestriction: {
        circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusM },
      },
    }),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      message = (await res.json()).error?.message || message;
    } catch {
      /* corpo não-JSON — mantém o status */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return (await res.json()).places || [];
}

// Converte o formato da API para as linhas usadas pelo app (mesmas colunas do CSV exportado).
export function toRows(byId) {
  const rows = [...byId.values()].map(({ place: p, searchTypes }) => {
    const website = p.websiteUri || "";
    return {
      id: p.id,
      nome: p.displayName?.text || "",
      categoria: p.primaryTypeDisplayName?.text || "",
      tipos_busca: [...searchTypes].join("; "),
      tipos: (p.types || []).join("; "),
      endereco: p.formattedAddress || "",
      telefone: p.nationalPhoneNumber || p.internationalPhoneNumber || "",
      site: website,
      tem_site: website ? "sim" : "nao",
      nota: p.rating ?? "",
      avaliacoes: p.userRatingCount ?? "",
      status: p.businessStatus || "",
      lat: p.location?.latitude ?? "",
      lng: p.location?.longitude ?? "",
      maps_url: p.googleMapsUri || "",
    };
  });
  // Sem site primeiro (oportunidades), depois por nº de avaliações.
  return rows.sort((a, b) => {
    if (a.tem_site !== b.tem_site) return a.tem_site === "nao" ? -1 : 1;
    return (Number(b.avaliacoes) || 0) - (Number(a.avaliacoes) || 0);
  });
}

export function addPlaces(byId, places, type) {
  let added = 0;
  for (const place of places) {
    const hit = byId.get(place.id);
    if (hit) hit.searchTypes.add(type);
    else {
      byId.set(place.id, { place, searchTypes: new Set([type]) });
      added++;
    }
  }
  return added;
}

// Roda uma busca por categoria, em sequência. onProgress recebe {done, total, type, found}.
export async function extract({ apiKey, center, radiusM, types, signal, onProgress }) {
  const byId = new Map();
  let errors = 0;
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    onProgress({ done: i, total: types.length, type, found: byId.size });
    try {
      addPlaces(byId, await searchNearby({ apiKey, center, radiusM, type, signal }), type);
    } catch (err) {
      if (err.name === "AbortError") throw err;
      // Chave inválida / API não habilitada: não adianta continuar gastando chamadas.
      if (err.status === 400 || err.status === 401 || err.status === 403) throw err;
      errors++;
    }
  }
  onProgress({ done: types.length, total: types.length, type: null, found: byId.size });
  return { rows: toRows(byId), errors };
}
