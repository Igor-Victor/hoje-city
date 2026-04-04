import { Request, Response } from 'express';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { prisma } from '../db';
import { logger } from '../logger';
import { sendSubscribeConfirmation } from '../services/email';

const subscribeSchema = z.object({
  email: z.string().email('E-mail inválido').max(254).transform((v) => v.toLowerCase().trim()),
  city: z.string().default('belo-horizonte').transform((v) =>
    sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} }).trim()
  ),
});

export async function subscribe(req: Request, res: Response): Promise<void> {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    const acceptsHtml = req.headers.accept?.includes('text/html');
    if (acceptsHtml) {
      res.status(422).render('public/index', {
        subscribeError: 'E-mail inválido. Verifique e tente novamente.',
      });
    } else {
      res.status(422).json({
        success: false,
        error: 'E-mail inválido',
        code: 'VALIDATION_ERROR',
      });
    }
    return;
  }

  const { email, city } = parsed.data;

  try {
    // Check for duplicate
    const existing = await prisma.subscriber.findUnique({ where: { email } });
    if (existing) {
      if (existing.isActive) {
        const acceptsHtml = req.headers.accept?.includes('text/html');
        if (acceptsHtml) {
          res.json({ success: true, duplicate: true, message: 'Esse e-mail já está na lista.' });
        } else {
          res.status(409).json({
            success: false,
            error: 'Esse e-mail já está na lista.',
            code: 'DUPLICATE_EMAIL',
          });
        }
        return;
      }
      // Reactivate
      await prisma.subscriber.update({ where: { email }, data: { isActive: true } });
    } else {
      await prisma.subscriber.create({ data: { email, city } });
    }

    logger.info({ subscriberId: 'new', city, action: 'subscriber_created' }, 'New subscriber');

    // Fire-and-forget email (don't block response)
    sendSubscribeConfirmation(email).catch((err) => {
      logger.warn({ err }, 'Failed to send subscribe confirmation email');
    });

    const acceptsHtml = req.headers.accept?.includes('text/html');
    if (acceptsHtml) {
      res.json({ success: true, message: '✓ E-mail cadastrado! Te vemos sexta.' });
    } else {
      res.status(201).json({ success: true, message: '✓ E-mail cadastrado! Te vemos sexta.' });
    }
  } catch (err) {
    logger.error({ err }, 'subscribe error');
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
}

export async function listSubscribers(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = 50;
    const skip = (page - 1) * limit;

    const [subscribers, total] = await Promise.all([
      prisma.subscriber.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, email: true, city: true, isActive: true, createdAt: true },
      }),
      prisma.subscriber.count(),
    ]);

    const acceptsHtml = req.headers.accept?.includes('text/html') && !req.path.startsWith('/api/');
    if (acceptsHtml) {
      res.render('admin/subscribers', {
        layout: 'admin',
        subscribers: subscribers.map((s) => ({
          ...s,
          emailMasked: maskEmail(s.email),
          createdAtFormatted: new Date(s.createdAt).toLocaleDateString('pt-BR'),
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      res.json({
        success: true,
        data: subscribers,
        pagination: { page, total, totalPages: Math.ceil(total / limit) },
      });
    }
  } catch (err) {
    logger.error({ err }, 'listSubscribers error');
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
}

export async function exportSubscribers(req: Request, res: Response): Promise<void> {
  try {
    const subscribers = await prisma.subscriber.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { email: true, city: true, createdAt: true },
    });

    const csv = [
      'email,cidade,cadastro',
      ...subscribers.map((s) =>
        `"${s.email}","${s.city}","${new Date(s.createdAt).toISOString()}"`
      ),
    ].join('\n');

    logger.info({ adminId: req.admin?.adminId, count: subscribers.length, action: 'export_subscribers' }, 'Subscribers exported');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
    res.send(csv);
  } catch (err) {
    logger.error({ err }, 'exportSubscribers error');
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const masked = local.substring(0, 2) + '***';
  return `${masked}@${domain}`;
}
