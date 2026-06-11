# Find Places — prospecção de negócios sem site

App web que encontra estabelecimentos perto de um endereço usando a
**Google Places API (New)** e destaca quem **não tem site**: candidatos ideais
para quem vende sites. Tem um pipeline (Kanban) para acompanhar os leads.

Tudo roda no navegador: não há backend nem banco de dados.

## Como usar

1. **Chave da API:** cole a sua chave do Google (veja abaixo como criar).
2. **Ponto de partida:** digite um endereço ou use a localização do navegador,
   e escolha o raio (1–50 km).
3. **Tipos de estabelecimento:** marque as categorias (restaurantes, salões,
   oficinas…). Cada categoria é uma chamada à API e retorna até 20 locais.
4. **Buscar:** acompanhe o progresso; ao final você vê a lista com filtros
   (sem site / com site, categoria, nota), ordenação por distância e exportação
   em CSV.
5. **Pipeline:** clique em **Iniciar** num local para levá-lo ao Kanban
   (Fazendo site → Em contato → Reunião → Fechamento → Ganho/Perdido).

## Criando a chave do Google

1. No [Google Cloud Console](https://console.cloud.google.com/), crie/selecione
   um projeto e habilite a **Places API (New)**.
2. Em *APIs e Serviços → Credenciais*, crie uma **chave de API**.
3. Restrinja a chave: *Restrições de API* → só Places API (New); *Restrições de
   aplicativo* → referenciadores HTTP com o domínio onde o app roda.

> ⚠️ A Places API é paga (com cota grátis mensal). Confira os
> [preços](https://developers.google.com/maps/billing-and-pricing/pricing) antes
> de buscar muitas categorias.

## Rodando localmente

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test        # testes da extração
```

Deploy: o `vercel.json` na raiz já builda o `frontend/`.

## Privacidade

- A chave da API, o endereço, os resultados e os leads ficam só no
  `localStorage` do navegador de quem usa. A chave é enviada apenas ao Google.
- A busca de endereço usa o Nominatim (OpenStreetMap), sem chave.
- O repositório não contém dados de nenhuma busca.
