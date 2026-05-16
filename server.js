require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialise DB once; queue requests until ready (8s timeout so Vercel doesn't hang)
let ready = false;
let initError = null;
const initPromise = Promise.race([
  initDb(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('DB init timed out after 8s')), 8000)),
]).then(() => { ready = true; }).catch(err => { initError = err; ready = true; console.error('[init]', err.message); });

app.use(async (req, res, next) => {
  if (!ready) await initPromise;
  if (initError && req.path.startsWith('/api/')) {
    return res.status(503).json({ error: 'Database unavailable', detail: initError.message });
  }
  next();
});

app.use('/webhook', require('./routes/webhook'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/automations', require('./routes/automations'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/webhook', require('./routes/webhookConfig').router);

app.get('/api/stats', async (req, res) => {
  try {
    const { db } = require('./database');
    const [contacts, campaigns, automations, emails_sent, recent_contacts] = await Promise.all([
      db.prepare("SELECT COUNT(*) as n FROM contacts WHERE status='active'").get(),
      db.prepare('SELECT COUNT(*) as n FROM campaigns').get(),
      db.prepare("SELECT COUNT(*) as n FROM automations WHERE status='active'").get(),
      db.prepare("SELECT COUNT(*) as n FROM email_logs WHERE status='sent'").get(),
      db.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 5').all(),
    ]);
    res.json({
      contacts: contacts.n,
      campaigns: campaigns.n,
      automations: automations.n,
      emails_sent: emails_sent.n,
      recent_contacts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Local dev: start listening. Vercel imports this file and uses `module.exports`.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  initPromise.then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
      if (!process.env.VERCEL) {
        const { startScheduler } = require('./services/schedulerService');
        startScheduler();
      }
    });
  });
}

module.exports = app;
