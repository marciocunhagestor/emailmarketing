const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { triggerAutomationsForContact } = require('../services/schedulerService');
const { readConfig } = require('./webhookConfig');

function resolveField(body, keys) {
  for (const key of keys.split(',').map(k => k.trim()).filter(Boolean)) {
    if (body[key] !== undefined && body[key] !== '') return body[key];
  }
  return null;
}

router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const cfg = readConfig();
    const fm = cfg.field_map || {};

    if (cfg.secret) {
      const sent = req.headers['x-webhook-secret'] || body._secret;
      if (sent !== cfg.secret) return res.status(401).json({ error: 'Secret inválido' });
    }

    const email        = resolveField(body, fm.email        || 'email');
    const name         = resolveField(body, fm.name         || 'name,nome');
    const phone        = resolveField(body, fm.phone        || 'phone,telefone,celular');
    const utm_source   = resolveField(body, fm.utm_source   || 'utm_source');
    const utm_medium   = resolveField(body, fm.utm_medium   || 'utm_medium');
    const utm_campaign = resolveField(body, fm.utm_campaign || 'utm_campaign');
    const utm_term     = resolveField(body, fm.utm_term     || 'utm_term');
    const utm_content  = resolveField(body, fm.utm_content  || 'utm_content');
    const source       = body.source || body._source || null;
    const list_id      = body.list_id || cfg.default_list_id || null;

    if (!email) return res.status(400).json({ error: 'Campo email não encontrado. Verifique o mapeamento de campos.' });

    const mappedKeys = new Set(['_secret', 'source', '_source', 'list_id']);
    Object.values(fm).forEach(v => v.split(',').forEach(k => mappedKeys.add(k.trim())));
    const customFields = {};
    for (const [k, v] of Object.entries(body)) {
      if (!mappedKeys.has(k)) customFields[k] = v;
    }

    const existing = await db.prepare('SELECT * FROM contacts WHERE email = ?').get(email);
    let contact;

    if (existing) {
      const merged = { ...JSON.parse(existing.custom_fields || '{}'), ...customFields };
      await db.prepare(`
        UPDATE contacts SET
          name=COALESCE(?,name), phone=COALESCE(?,phone),
          utm_source=COALESCE(?,utm_source), utm_medium=COALESCE(?,utm_medium),
          utm_campaign=COALESCE(?,utm_campaign), utm_term=COALESCE(?,utm_term),
          utm_content=COALESCE(?,utm_content),
          custom_fields=?, updated_at=CURRENT_TIMESTAMP
        WHERE email=?
      `).run(name, phone, utm_source, utm_medium, utm_campaign, utm_term, utm_content, JSON.stringify(merged), email);
      contact = await db.prepare('SELECT * FROM contacts WHERE email=?').get(email);
    } else {
      const r = await db.prepare(`
        INSERT INTO contacts (email,name,phone,source,utm_source,utm_medium,utm_campaign,utm_term,utm_content,custom_fields)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(email, name, phone, source, utm_source, utm_medium, utm_campaign, utm_term, utm_content, JSON.stringify(customFields));
      contact = await db.prepare('SELECT * FROM contacts WHERE id=?').get(r.lastInsertRowid);
    }

    if (list_id) {
      try { await db.prepare('INSERT OR IGNORE INTO list_contacts (list_id,contact_id) VALUES (?,?)').run(list_id, contact.id); } catch (_) {}
    }

    await db.prepare('INSERT INTO webhook_logs (payload,source,contact_id) VALUES (?,?,?)').run(JSON.stringify(body), source, contact.id);

    triggerAutomationsForContact(contact, 'webhook_form', { list_id: list_id ? parseInt(list_id) : null });

    res.json({ success: true, contact_id: contact.id, is_new: !existing });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
