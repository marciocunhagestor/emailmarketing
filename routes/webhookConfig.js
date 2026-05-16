const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db } = require('../database');

const CONFIG_FILE = path.join(__dirname, '..', 'webhook-config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {
      field_map: { email: 'email', name: 'nome,name', phone: 'telefone,phone,celular', utm_source: 'utm_source', utm_medium: 'utm_medium', utm_campaign: 'utm_campaign', utm_term: 'utm_term', utm_content: 'utm_content' },
      default_list_id: null,
      secret: '',
    };
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

router.get('/config', (req, res) => res.json(readConfig()));

router.post('/config', (req, res) => {
  writeConfig({ ...readConfig(), ...req.body });
  res.json({ success: true });
});

router.get('/logs', async (req, res) => {
  try {
    const logs = await db.prepare(`
      SELECT w.*, c.email as contact_email, c.name as contact_name
      FROM webhook_logs w LEFT JOIN contacts c ON c.id=w.contact_id
      ORDER BY w.processed_at DESC LIMIT 50
    `).all();
    res.json(logs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { router, readConfig };
