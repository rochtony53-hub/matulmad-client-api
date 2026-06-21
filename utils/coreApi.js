// Pont vers le backend "core" (celui qui alimente le WebView + admin + auto-validation).
// Configuré via variables d'environnement :
//   CORE_API_BASE   ex: https://sms-gateway-admin-backend-vw8p.onrender.com
//   CORE_API_TOKEN  JWT admin/service du backend core (pour créer/lire les ordres)

const BASE = () => (process.env.CORE_API_BASE || '').replace(/\/$/, '');
const TOKEN = () => process.env.CORE_API_TOKEN || '';

async function coreCreateOrder({ operator, numero, montant, type, clientId, provider, providerId }) {
  if (!BASE() || !TOKEN()) throw new Error('CORE_API_BASE / CORE_API_TOKEN non configurés');
  const r = await fetch(BASE() + '/api/retrait', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN() },
    body: JSON.stringify({ operator, numero, montant, type, clientId, provider, providerId })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ('core ' + r.status));
  return data; // { ok, id, ussdCode, channel }
}

async function coreGetOrder(id) {
  if (!BASE() || !TOKEN()) throw new Error('CORE_API_BASE / CORE_API_TOKEN non configurés');
  const r = await fetch(BASE() + '/api/retrait/' + id, {
    headers: { 'Authorization': 'Bearer ' + TOKEN() }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ('core ' + r.status));
  return data;
}

module.exports = { coreCreateOrder, coreGetOrder, BASE, TOKEN };
