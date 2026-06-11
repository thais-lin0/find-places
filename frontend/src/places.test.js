// Rodar com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { addPlaces, toRows } from "./places.js";

test("deduplica por id, junta tipos buscados e ordena sem site primeiro", () => {
  const byId = new Map();
  const a = { id: "a", displayName: { text: "A" }, websiteUri: "https://a.com", userRatingCount: 500 };
  const b = { id: "b", displayName: { text: "B" }, userRatingCount: 10 };
  const c = { id: "c", displayName: { text: "C" }, userRatingCount: 90, location: { latitude: -23.5, longitude: -46.6 } };

  assert.equal(addPlaces(byId, [a, b], "cafe"), 2);
  assert.equal(addPlaces(byId, [b, c], "bakery"), 1);

  const rows = toRows(byId);
  assert.deepEqual(rows.map((r) => r.id), ["c", "b", "a"]);
  assert.equal(rows[1].tipos_busca, "cafe; bakery");
  assert.equal(rows[2].tem_site, "sim");
  assert.equal(rows[0].tem_site, "nao");
  assert.equal(rows[0].lat, -23.5);
  assert.equal(rows[1].lat, "");
});
