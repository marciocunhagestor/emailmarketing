const nodemailer = require('nodemailer');
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

function resetTransporter() { transporter = null; }

function interpolate(template, contact) {
  const fields = {
    name: contact.name || '', email: contact.email || '', phone: contact.phone || '',
    utm_source: contact.utm_source || '', utm_campaign: contact.utm_campaign || '',
    ...JSON.parse(contact.custom_fields || '{}'),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => fields[key] ?? '');
}

async function sendEmail({ to, subject, html, text, contactId, campaignId, automationId, stepId }) {
  const trackingId = uuidv4();
  const from = `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`;
  const log = await db.prepare(`INSERT INTO email_logs (contact_id,campaign_id,automation_id,step_id,email,subject,status,tracking_id) VALUES (?,?,?,?,?,?,'pending',?)`).run(contactId||null, campaignId||null, automationId||null, stepId||null, to, subject, trackingId);

  try {
    await getTransporter().sendMail({ from, to, subject, html, text });
    await db.prepare(`UPDATE email_logs SET status='sent', sent_at=CURRENT_TIMESTAMP WHERE id=?`).run(log.lastInsertRowid);
    return { success: true, trackingId };
  } catch (err) {
    await db.prepare(`UPDATE email_logs SET status='error', error=? WHERE id=?`).run(err.message, log.lastInsertRowid);
    throw err;
  }
}

async function sendToContact(contact, template, options = {}) {
  return sendEmail({
    to: contact.email,
    subject: interpolate(template.subject, contact),
    html: interpolate(template.html_body, contact),
    text: template.text_body ? interpolate(template.text_body, contact) : undefined,
    contactId: contact.id,
    ...options,
  });
}

async function sendCampaign(campaignId) {
  const campaign = await db.prepare('SELECT * FROM campaigns WHERE id=?').get(campaignId);
  if (!campaign || campaign.status !== 'scheduled') throw new Error('Campanha não encontrada ou não está agendada');

  await db.prepare(`UPDATE campaigns SET status='sending' WHERE id=?`).run(campaignId);

  const contacts = await db.prepare(`SELECT c.* FROM contacts c JOIN list_contacts lc ON lc.contact_id=c.id WHERE lc.list_id=? AND c.status='active'`).all(campaign.list_id);

  let sent = 0;
  for (const contact of contacts) {
    try {
      await sendEmail({ to: contact.email, subject: interpolate(campaign.subject, contact), html: interpolate(campaign.html_body, contact), text: campaign.text_body ? interpolate(campaign.text_body, contact) : undefined, contactId: contact.id, campaignId });
      sent++;
    } catch (_) {}
  }

  await db.prepare(`UPDATE campaigns SET status='sent', sent_at=CURRENT_TIMESTAMP, total_sent=? WHERE id=?`).run(sent, campaignId);
  return { sent, total: contacts.length };
}

module.exports = { sendEmail, sendToContact, sendCampaign, resetTransporter };
