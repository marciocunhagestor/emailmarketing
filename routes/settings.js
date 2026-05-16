const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { resetTransporter } = require('../services/emailService');

router.post('/smtp', (req, res) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL } = req.body;
  if (SMTP_HOST) process.env.SMTP_HOST = SMTP_HOST;
  if (SMTP_PORT) process.env.SMTP_PORT = SMTP_PORT;
  if (SMTP_SECURE !== undefined) process.env.SMTP_SECURE = SMTP_SECURE;
  if (SMTP_USER) process.env.SMTP_USER = SMTP_USER;
  if (SMTP_PASS) process.env.SMTP_PASS = SMTP_PASS;
  if (SMTP_FROM_NAME) process.env.SMTP_FROM_NAME = SMTP_FROM_NAME;
  if (SMTP_FROM_EMAIL) process.env.SMTP_FROM_EMAIL = SMTP_FROM_EMAIL;
  resetTransporter();
  res.json({ success: true });
});

router.post('/smtp/test', async (req, res) => {
  try {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.verify();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/smtp/send-test', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Informe o email de destino.' });
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return res.status(400).json({ error: 'Configure e salve as credenciais SMTP antes de enviar.' });
  }
  try {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const from = `"${process.env.SMTP_FROM_NAME || 'EmailFlow'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`;
    await t.sendMail({
      from,
      to,
      subject: '✅ Teste de email — EmailFlow',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <div style="background:#1a1a2e;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <div style="font-size:36px;margin-bottom:8px;">✉️</div>
            <div style="color:#fff;font-size:20px;font-weight:700;">EmailFlow</div>
          </div>
          <h2 style="color:#1a1a2e;margin:0 0 12px;">Configuração funcionando! ✅</h2>
          <p style="color:#555;line-height:1.7;margin:0 0 20px;">
            Se você está lendo este email, significa que as configurações de SMTP estão corretas e o sistema está pronto para enviar emails.
          </p>
          <div style="background:#f8f7f4;border-radius:8px;padding:16px;margin-bottom:24px;font-size:13px;color:#666;">
            <strong>Remetente:</strong> ${from}<br>
            <strong>Servidor:</strong> ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}<br>
            <strong>Segurança:</strong> ${process.env.SMTP_SECURE === 'true' ? 'SSL' : 'TLS/STARTTLS'}<br>
            <strong>Enviado em:</strong> ${new Date().toLocaleString('pt-BR')}
          </div>
          <p style="color:#aaa;font-size:12px;text-align:center;margin:0;">Este é um email de teste gerado automaticamente pelo EmailFlow.</p>
        </div>`,
      text: `EmailFlow — Teste de configuração SMTP\n\nSe você está lendo este email, as configurações estão corretas!\n\nRemetente: ${from}\nServidor: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}\nEnviado em: ${new Date().toLocaleString('pt-BR')}`,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
