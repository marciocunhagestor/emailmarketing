const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { sendCampaign } = require('../services/emailService');

router.get('/', async (req, res) => {
  try {
    const campaigns = await db.prepare(`SELECT c.*, l.name as list_name FROM campaigns c LEFT JOIN lists l ON l.id=c.list_id ORDER BY c.created_at DESC`).all();
    res.json(campaigns);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const campaign = await db.prepare(`SELECT c.*, l.name as list_name FROM campaigns c LEFT JOIN lists l ON l.id=c.list_id WHERE c.id=?`).get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    const logs = await db.prepare('SELECT * FROM email_logs WHERE campaign_id=? ORDER BY sent_at DESC LIMIT 50').all(campaign.id);
    res.json({ ...campaign, logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, subject, html_body, text_body, list_id, scheduled_at } = req.body;
    if (!name || !subject || !html_body) return res.status(400).json({ error: 'name, subject e html_body são obrigatórios' });
    const status = scheduled_at ? 'scheduled' : 'draft';
    const r = await db.prepare(`INSERT INTO campaigns (name,subject,html_body,text_body,list_id,status,scheduled_at) VALUES (?,?,?,?,?,?,?)`).run(name, subject, html_body, text_body||null, list_id||null, status, scheduled_at||null);
    res.json({ id: r.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const camp = await db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id);
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (camp.status === 'sent') return res.status(400).json({ error: 'Não é possível editar campanha enviada' });
    const { name, subject, html_body, text_body, list_id, scheduled_at, status } = req.body;
    await db.prepare(`UPDATE campaigns SET name=COALESCE(?,name), subject=COALESCE(?,subject), html_body=COALESCE(?,html_body), text_body=COALESCE(?,text_body), list_id=COALESCE(?,list_id), scheduled_at=?, status=COALESCE(?,status) WHERE id=?`)
      .run(name||null, subject||null, html_body||null, text_body||null, list_id||null, scheduled_at||null, status||null, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/send', async (req, res) => {
  try {
    const camp = await db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id);
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (camp.status === 'sent') return res.status(400).json({ error: 'Campanha já foi enviada' });
    if (!camp.list_id) return res.status(400).json({ error: 'Selecione uma lista antes de enviar' });
    await db.prepare(`UPDATE campaigns SET status='scheduled', scheduled_at=CURRENT_TIMESTAMP WHERE id=?`).run(camp.id);
    const result = await sendCampaign(camp.id);
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const camp = await db.prepare('SELECT status FROM campaigns WHERE id=?').get(req.params.id);
    if (camp?.status === 'sent') return res.status(400).json({ error: 'Não é possível remover campanha enviada' });
    await db.prepare('DELETE FROM campaigns WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
