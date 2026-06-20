const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const SECRET = () => process.env.JWT_SECRET || 'dev_secret_change_me';
const sign = (u) => jwt.sign(
  { id: u._id, role: u.role || 'client' },
  SECRET(),
  { expiresIn: '30d' }
);

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
const cleanPhone = (v) => (v || '').replace(/[\s.\-]/g, '');

function publicUser(u) {
  return {
    id: u._id, name: u.name, email: u.email || null, phone: u.phone || null,
    wallets: u.wallets, providers: u.providers, lang: u.lang, role: u.role
  };
}

// POST /api/auth/register  { name, email?, phone?, password }
router.post('/register', async (req, res) => {
  try {
    let { name, email, phone, password, lang } = req.body || {};
    if (!password || password.length < 6)
      return res.status(400).json({ error: 'Mot de passe trop court (min 6)' });
    email = (email || '').toLowerCase().trim() || undefined;
    phone = cleanPhone(phone) || undefined;
    if (!email && !phone) return res.status(400).json({ error: 'Email ou téléphone requis' });
    if (email && !isEmail(email)) return res.status(400).json({ error: 'Email invalide' });

    // Unicité
    const exists = await User.findOne({ $or: [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : [])
    ] });
    if (exists) return res.status(409).json({ error: 'Compte déjà existant' });

    const passwordHash = await bcrypt.hash(password, 10);
    const u = await User.create({ name: name || '', email, phone, passwordHash, lang: lang === 'mg' ? 'mg' : 'fr' });
    return res.json({ ok: true, token: sign(u), user: publicUser(u) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login  { identifier (email|phone), password }
router.post('/login', async (req, res) => {
  try {
    let { identifier, email, phone, password } = req.body || {};
    const id = identifier || email || phone;
    if (!id || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

    const query = isEmail(id)
      ? { email: id.toLowerCase().trim() }
      : { phone: cleanPhone(id) };
    const u = await User.findOne(query);
    if (!u) return res.status(401).json({ error: 'Identifiants incorrects' });
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Identifiants incorrects' });
    if (!u.active) return res.status(403).json({ error: 'Compte désactivé' });
    return res.json({ ok: true, token: sign(u), user: publicUser(u) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const u = await User.findById(req.userId);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
    return res.json({ user: publicUser(u) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// PATCH /api/auth/me  { name?, lang? }
router.patch('/me', auth, async (req, res) => {
  try {
    const { name, lang } = req.body || {};
    const upd = { updatedAt: new Date() };
    if (typeof name === 'string') upd.name = name;
    if (lang === 'fr' || lang === 'mg') upd.lang = lang;
    const u = await User.findByIdAndUpdate(req.userId, upd, { new: true });
    return res.json({ ok: true, user: publicUser(u) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
