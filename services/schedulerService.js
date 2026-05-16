const { db } = require('../database');
const { sendToContact, sendCampaign } = require('./emailService');

async function processAutomationForContact(contact, automation) {
  const steps = await db.prepare(`
    SELECT s.*, t.subject, t.html_body, t.text_body
    FROM automation_steps s LEFT JOIN email_templates t ON t.id=s.template_id
    WHERE s.automation_id=? ORDER BY s.step_order
  `).all(automation.id);

  for (const step of steps) {
    const delayMs = (step.delay_minutes || 0) * 60 * 1000;
    setTimeout(async () => {
      try {
        if (step.action_type === 'send_email' && step.subject) {
          await sendToContact(contact, step, { automationId: automation.id, stepId: step.id });
        }
      } catch (_) {}
    }, delayMs);
  }
}

async function triggerAutomationsForContact(contact, triggerType, triggerData = {}) {
  try {
    const automations = await db.prepare(`SELECT * FROM automations WHERE trigger_type=? AND status='active'`).all(triggerType);
    for (const automation of automations) {
      const config = JSON.parse(automation.trigger_config || '{}');
      if (config.list_id && config.list_id !== triggerData.list_id) continue;
      processAutomationForContact(contact, automation);
    }
  } catch (_) {}
}

function startScheduler() {
  const cron = require('node-cron');
  cron.schedule('* * * * *', async () => {
    try {
      const campaigns = await db.prepare(`SELECT * FROM campaigns WHERE status='scheduled' AND scheduled_at <= CURRENT_TIMESTAMP`).all();
      for (const campaign of campaigns) {
        try { await sendCampaign(campaign.id); } catch (_) {}
      }
    } catch (_) {}
  });
  console.log('Scheduler iniciado');
}

module.exports = { startScheduler, triggerAutomationsForContact };
