const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', async (req, res) => {
  try {
    const { search, status, list_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (status)  { where += ' AND c.status = ?';                       params.push(status); }
    if (search)  { where += ' AND (c.email LIKE ? OR c.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (list_id) { where += ' AND lc.list_id = ?';                     params.push(list_id); }
    const join = list_id ? 'JOIN list_contacts lc ON lc.contact_id=c.id' : 'LEFT JOIN list_contacts lc ON lc.contact_id=c.id';

    const total = (await db.prepare(`SELECT COUNT(DISTINCT c.id) as n FROM contacts c ${join} ${where}`).get(...params)).n;
    const contacts = await db.prepare(`SELECT DISTINCT c.* FROM contacts c ${join} ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
    res.json({ contacts, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/lists/all', async (req, res) => {
  try {
    const lists = await db.prepare(`SELECT l.*, COUNT(lc.contact_id) as contact_count FROM lists l LEFT JOIN list_contacts lc ON lc.list_id=l.id GROUP BY l.id ORDER BY l.created_at DESC`).all();
    res.json(lists);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const contact = await db.prepare('SELECT * FROM contacts WHERE id=?').get(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });
    const logs = await db.prepare('SELECT * FROM email_logs WHERE contact_id=? ORDER BY sent_at DESC LIMIT 20').all(contact.id);
    res.json({ ...contact, logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { email, name, phone, source, utm_source, utm_medium, utm_campaign, utm_term, utm_content, tags, custom_fields } = req.body;
  if (!email) return res.status(400).json({ error: 'Email é obrigatório' });
  try {
    const r = await db.prepare(`
      INSERT INTO contacts (email,name,phone,source,utm_source,utm_medium,utm_campaign,utm_term,utm_content,tags,custom_fields)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(email, name||null, phone||null, source||null, utm_source||null, utm_medium||null, utm_campaign||null, utm_term||null, utm_content||null, JSON.stringify(tags||[]), JSON.stringify(custom_fields||{}));
    res.json({ id: r.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, phone, status, tags, custom_fields } = req.body;
    await db.prepare(`UPDATE contacts SET name=COALESCE(?,name), phone=COALESCE(?,phone), status=COALESCE(?,status), tags=COALESCE(?,tags), custom_fields=COALESCE(?,custom_fields), updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(name||null, phone||null, status||null, tags?JSON.stringify(tags):null, custom_fields?JSON.stringify(custom_fields):null, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/lists', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const r = await db.prepare('INSERT INTO lists (name,description) VALUES (?,?)').run(name, description||null);
    res.json({ id: r.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/lists/:list_id/contacts/:contact_id', async (req, res) => {
  try {
    await db.prepare('INSERT OR IGNORE INTO list_contacts (list_id,contact_id) VALUES (?,?)').run(req.params.list_id, req.params.contact_id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/lists/:list_id/contacts/:contact_id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM list_contacts WHERE list_id=? AND contact_id=?').run(req.params.list_id, req.params.contact_id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
