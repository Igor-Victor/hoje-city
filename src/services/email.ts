import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../logger';

function createTransporter() {
  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    logger.warn('SMTP not configured — emails will be logged only');
    return null;
  }

  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });
}

export async function sendSubscribeConfirmation(email: string): Promise<void> {
  const transporter = createTransporter();

  const html = `
    <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #FAFAF8;">
      <h1 style="font-family: Georgia, serif; font-size: 28px; color: #1A1A18; margin-bottom: 8px;">
        Hoje<span style="font-style: italic;">.city</span>
      </h1>
      <p style="color: #6B6B66; font-size: 14px; margin-bottom: 24px;">BH · curado toda sexta</p>
      <p style="color: #1A1A18; font-size: 16px; line-height: 1.6;">
        Pronto! Todo mês você receberá a curadoria de eventos de Belo Horizonte direto no seu e-mail.
      </p>
      <p style="color: #1A1A18; font-size: 16px; line-height: 1.6;">
        Shows, teatro, exposições, rolês de rua e muito mais — tudo filtrado para você não perder o que vale.
      </p>
      <hr style="border: none; border-top: 0.5px solid rgba(0,0,0,0.08); margin: 32px 0;" />
      <p style="color: #9B9B96; font-size: 12px;">
        Você está recebendo este e-mail porque se cadastrou em hoje.city.
      </p>
    </div>
  `;

  if (!transporter) {
    logger.info({ email: email.substring(0, 3) + '***' }, 'Would send subscribe confirmation email');
    return;
  }

  await transporter.sendMail({
    from: config.EMAIL_FROM,
    to: email,
    subject: '✓ Você está na lista — Hoje.city',
    html,
    text: `Pronto! Todo mês você receberá a curadoria de eventos de BH. — hoje.city`,
  });
}
