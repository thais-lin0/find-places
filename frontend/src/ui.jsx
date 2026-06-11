// Peças visuais compartilhadas entre a lista e o Kanban.

// Monta link de WhatsApp a partir de um telefone (só dígitos; assume Brasil se faltar DDI).
export function waLink(phone) {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
}

export const fmtInt = (n) => (n === "" || n == null ? "—" : Number(n).toLocaleString("pt-BR"));

// Avatar com iniciais; a cor vem da categoria, então locais parecidos ficam com o mesmo tom.
export function Avatar({ name, seed, size = "md" }) {
  const initials = (name || "?")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  let hue = 0;
  for (const ch of seed || name || "") hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className={`avatar avatar-${size}`} style={{ "--h": hue }} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}
