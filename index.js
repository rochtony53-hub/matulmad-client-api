require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Santé
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'matulmad-client-api', version: '1.0.0' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/order', require('./routes/order'));

app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));

const PORT = process.env.PORT || 4000;
const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO) {
  console.error('MONGO_URI manquant');
  process.exit(1);
}

mongoose.connect(MONGO)
  .then(() => {
    console.log('MongoDB connecté');
    app.listen(PORT, () => console.log('matulmad-client-api on :' + PORT));
  })
  .catch((e) => { console.error('Mongo error:', e.message); process.exit(1); });
