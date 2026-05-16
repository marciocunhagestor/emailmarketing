const { createClient } = require('@libsql/client');

const isVercel = !!process.env.VERCEL;
const defaultUrl = isVercel ? 'file:/tmp/emailmarketing.db' : 'file:emailmarketing.db';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || defaultUrl,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

function toObj(row, columns) {
  const obj = {};
  columns.forEach((col, i) => { obj[col] = row[i] ?? null; });
  return obj;
}

const db = {
  prepare(sql) {
    return {
      async run(...args) {
        const r = await client.execute({ sql, args });
        return { lastInsertRowid: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected };
      },
      async get(...args) {
        const r = await client.execute({ sql, args });
        if (!r.rows.length) return undefined;
        return toObj(r.rows[0], r.columns);
      },
      async all(...args) {
        const r = await client.execute({ sql, args });
        return r.rows.map(row => toObj(row, r.columns));
      },
    };
  },
};

async function initDb() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT, phone TEXT, source TEXT,
      utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT,
      custom_fields TEXT DEFAULT '{}',
      tags TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS list_contacts (
      list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (list_id, contact_id)
    )`,
    `CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, subject TEXT NOT NULL, html_body TEXT NOT NULL, text_body TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, subject TEXT NOT NULL, html_body TEXT NOT NULL, text_body TEXT,
      list_id INTEGER REFERENCES lists(id),
      status TEXT DEFAULT 'draft',
      scheduled_at DATETIME, sent_at DATETIME,
      total_sent INTEGER DEFAULT 0, total_opened INTEGER DEFAULT 0, total_clicked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, trigger_type TEXT NOT NULL,
      trigger_config TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS automation_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_id INTEGER REFERENCES automations(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL, action_type TEXT NOT NULL,
      delay_minutes INTEGER DEFAULT 0,
      template_id INTEGER REFERENCES email_templates(id),
      config TEXT DEFAULT '{}'
    )`,
    `CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER REFERENCES contacts(id),
      campaign_id INTEGER, automation_id INTEGER, step_id INTEGER,
      email TEXT NOT NULL, subject TEXT,
      status TEXT DEFAULT 'pending', error TEXT,
      sent_at DATETIME, opened_at DATETIME, tracking_id TEXT UNIQUE
    )`,
    `CREATE TABLE IF NOT EXISTS webhook_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payload TEXT, source TEXT, contact_id INTEGER,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of stmts) {
    await client.execute(sql);
  }
}

module.exports = { db, initDb };
