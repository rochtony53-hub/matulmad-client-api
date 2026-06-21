const express = require('express');
const ClientOrder = require('../models/ClientOrder');
const auth = require('../middleware/auth');
const { coreCreateOrder, coreGetOrder } = require('../utils/coreApi');

const router = express.Router();
router.use(auth);

const PAYMENT_BASE = () => (process.env.PAYMENT_WEBVIEW_BASE || 'https://payment-webview.vercel.app').replace(/\/$/, '');

// POST /api/order  { type, operator, montant, numero, provider?, providerId? }
// → crée l'ordre dans le backend core, enregistre l'ordre client, renvoie l'URL WebView.
router.post('/', async (req, res) => {
  try {
    let { type, operator, montant, numero, provider, providerId } = req.body || {};
    type = (type || '').toLowerCase();
    operator = (operator || '').toLowerCase();
    montant = Number(montant);
    numero = (numero || '').replace(/[\s.\-]/g, '');

    if (!['depot', 'retrait'].includes(type)) return res.status(400).json({ error: 'Type invalide' });
    if (!['mvola', 'orange', 'airtel'].includes(operator)) return res.status(400).json({ error: 'Opérateur invalide' });
    if (!montant || montant < 1) return res.status(400).json({ error: 'Montant invalide' });
    if (!numero) return res.status(400).json({ error: 'Numéro requis' });

    // 1) Créer dans le core (alimente WebView + admin + auto-validation)
    const core = await coreCreateOrder({ operator, numero, montant, type, clientId: String(req.userId), provider: provider||'', providerId: providerId||'' });

    // 2) Enregistrer côté client
    const order = await ClientOrder.create({
      userId: req.userId, type, operator, montant, numero,
      provider: provider || '', providerId: providerId || '',
      coreOrderId: core.id, ussdCode: core.ussdCode || '', status: 'pending'
    });

    // 3) URL WebView (le backend client proxy le statut ; voir GET /:id/status)
    const webviewUrl = `${PAYMENT_BASE()}/?order=${core.id}&token=${encodeURIComponent(process.env.CORE_API_TOKEN||"")}&client=${order._id}`;

    return res.json({
      ok: true,
      orderId: order._id,
      coreOrderId: core.id,
      ussdCode: core.ussdCode,
      channel: core.channel,
      webviewUrl
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
});

// GET /api/order  → historique du client
router.get('/', async (req, res) => {
  try {
    const list = await ClientOrder.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50);
    return res.json({ data: list });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// GET /api/order/:id/status  → proxy du statut depuis le core (sync local)
router.get('/:id/status', async (req, res) => {
  try {
    const order = await ClientOrder.findOne({ _id: req.params.id, userId: req.userId });
    if (!order) return res.status(404).json({ error: 'Ordre introuvable' });
    if (order.coreOrderId) {
      try {
        const core = await coreGetOrder(order.coreOrderId);
        if (core && core.status && core.status !== order.status) {
          order.status = core.status; order.updatedAt = new Date(); await order.save();
        }
      } catch (_) { /* core indisponible : on renvoie le dernier statut connu */ }
    }
    return res.json({ status: order.status, montant: order.montant, type: order.type });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

module.exports = router;
