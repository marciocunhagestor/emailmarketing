const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', async (req, res) => {
  try {
    const automations = await db.prepare('SELECT * FROM automations ORDER BY created_at DESC').all();
    const result = await Promise.all(automations.map(async a => ({
      ...a,
      trigger_config: JSON.parse(a.trigger_config || '{}'),
      steps: await db.prepare(`SELECT s.*, t.name as template_name FROM automation_steps s LEFT JOIN email_templates t ON t.id=s.template_id WHERE s.automation_id=? ORDER BY s.step_order`).all(a.id),
    })));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const auto = await db.prepare('SELECT * FROM automations WHERE id=?').get(req.params.id);
    if (!auto) return res.status(404).json({ error: 'Automação não encontrada' });
    const steps = await db.prepare(`SELECT s.*, t.name as template_name FROM automation_steps s LEFT JOIN email_templates t ON t.id=s.template_id WHERE s.automation_id=? ORDER BY s.step_order`).all(auto.id);
    res.json({ ...auto, trigger_config: JSON.parse(auto.trigger_config || '{}'), steps });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, trigger_type, trigger_config, steps } = req.body;
    if (!name || !trigger_type) return res.status(400).json({ error: 'name e trigger_type são obrigatórios' });
    const r = await db.prepare('INSERT INTO automations (name,trigger_type,trigger_config) VALUES (?,?,?)').run(name, trigger_type, JSON.stringify(trigger_config || {}));
    const autoId = r.lastInsertRowid;
    if (Array.isArray(steps)) {
      for (const [i, step] of steps.entries()) {
        await db.prepare('INSERT INTO automation_steps (automation_id,step_order,action_type,delay_minutes,template_id,config) VALUES (?,?,?,?,?,?)').run(autoId, i + 1, step.action_type, step.delay_minutes || 0, step.template_id || null, JSON.stringify(step.config || {}));
      }
    }
    res.json({ id: autoId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, status, trigger_config, steps } = req.body;
    await db.prepare('UPDATE automations SET name=COALESCE(?,name), status=COALESCE(?,status), trigger_config=COALESCE(?,trigger_config) WHERE id=?')
      .run(name||null, status||null, trigger_config ? JSON.stringify(trigger_config) : null, req.params.id);
    if (Array.isArray(steps)) {
      await db.prepare('DELETE FROM automation_steps WHERE automation_id=?').run(req.params.id);
      for (const [i, step] of steps.entries()) {
        await db.prepare('INSERT INTO automation_steps (automation_id,step_order,action_type,delay_minutes,template_id,config) VALUES (?,?,?,?,?,?)').run(req.params.id, i + 1, step.action_type, step.delay_minutes || 0, step.template_id || null, JSON.stringify(step.config || {}));
      }
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.prepare('DELETE FROM automations WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
