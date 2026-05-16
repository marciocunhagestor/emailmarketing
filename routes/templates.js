const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', async (req, res) => {
  try { res.json(await db.prepare('SELECT * FROM email_templates ORDER BY created_at DESC').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const tpl = await db.prepare('SELECT * FROM email_templates WHERE id=?').get(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Template não encontrado' });
    res.json(tpl);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, subject, html_body, text_body } = req.body;
    if (!name || !subject || !html_body) return res.status(400).json({ error: 'name, subject e html_body são obrigatórios' });
    const r = await db.prepare('INSERT INTO email_templates (name,subject,html_body,text_body) VALUES (?,?,?,?)').run(name, subject, html_body, text_body||null);
    res.json({ id: r.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, subject, html_body, text_body } = req.body;
    await db.prepare('UPDATE email_templates SET name=COALESCE(?,name), subject=COALESCE(?,subject), html_body=COALESCE(?,html_body), text_body=COALESCE(?,text_body), updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(name||null, subject||null, html_body||null, text_body||null, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM email_templates WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
