import { Request, Response } from 'express';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { prisma } from '../db';
import { logger } from '../logger';
import { getAllEventsAdmin, validateUrl, validateTicketUrl, slugToCategory } from '../services/events';
import { Category } from '@prisma/client';

const THIRTY_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
};

function sanitize(str: string): string {
  return sanitizeHtml(str, { allowedTags: [], allowedAttributes: {} }).trim();
}

const eventCreateSchema = z.object({
  title: z.string().min(3).max(120).transform(sanitize),
  description: z.string().max(2000).transform(sanitize).optional(),
  category: z.nativeEnum(Category),
  startDate: z.string().transform((v) => new Date(v)),
  endDate: z.string().transform((v) => new Date(v)).optional(),
  time: z.string().min(1).max(50).transform(sanitize),
  venue: z.string().min(1).max(120).transform(sanitize),
  address: z.string().max(200).transform(sanitize).optional(),
  neighborhood: z.string().max(100).transform(sanitize).optional(),
  city: z.string().default('belo-horizonte').transform(sanitize),
  price: z.string().min(1).max(100).transform(sanitize),
  isFree: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === 'on')]).default(false),
  ticketUrl: z.string().url().max(500).optional().or(z.literal('')),
  sourceUrl: z.string().url().max(500).optional().or(z.literal('')),
  isVerified: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === 'on')]).default(false),
  isFeatured: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === 'on')]).default(false),
  isPublished: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === 'on')]).default(false),
});

const eventUpdateSchema = eventCreateSchema.partial();

export async function listAdminEvents(req: Request, res: Response): Promise<void> {
  try {
    const { search, category, date, page } = req.query as Record<string, string>;
    const result = await getAllEventsAdmin({
      search: search ? sanitize(search) : undefined,
      category: category || undefined,
      date: date || undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: 20,
    });

    const acceptsHtml = req.headers.accept?.includes('text/html') && !req.path.startsWith('/api/');
    if (acceptsHtml) {
      res.render('admin/events', {
        layout: 'admin',
        events: result.events.map(formatEventForView),
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        search: search || '',
        category: category || '',
        date: date || '',
        categories: getCategoryOptions(),
      });
    } else {
      res.json({
        success: true,
        data: result.events,
        pagination: { page: result.page, total: result.total, totalPages: result.totalPages },
      });
    }
  } catch (err) {
    logger.error({ err }, 'listAdminEvents error');
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
}

export async function getAdminEvent(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      res.status(404).json({ success: false, error: 'Evento não encontrado', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true, data: event });
  } catch (err) {
    logger.error({ err, id }, 'getAdminEvent error');
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
}

export async function createEvent(req: Request, res: Response): Promise<void> {
  const parsed = eventCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const acceptsHtml = req.headers.accept?.includes('text/html') && !req.path.startsWith('/api/');
    if (acceptsHtml) {
      res.render('admin/event-form', {
        layout: 'admin',
        title: 'Novo Evento',
        event: req.body,
        errors: parsed.error.flatten().fieldErrors,
        categories: getCategoryOptions(),
        isNew: true,
      });
      return;
    }
    res.status(422).json({
      success: false,
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const data = parsed.data;

  // Validate startDate not too old (A04)
  if (data.startDate < THIRTY_DAYS_AGO()) {
    res.status(422).json({
      success: false,
      error: 'Data de início não pode ser mais de 30 dias no passado',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  // Validate ticket URL domain (A10 SSRF)
  if (data.ticketUrl && data.ticketUrl !== '') {
    if (!validateTicketUrl(data.ticketUrl)) {
      res.status(422).json({
        success: false,
        error: 'URL de ingresso não permitida. Use apenas plataformas conhecidas.',
        code: 'INVALID_TICKET_URL',
      });
      return;
    }
  }

  if (data.sourceUrl && data.sourceUrl !== '') {
    if (!validateUrl(data.sourceUrl)) {
      res.status(422).json({ success: false, error: 'URL da fonte inválida', code: 'VALIDATION_ERROR' });
      return;
    }
  }

  try {
    const event = await prisma.event.create({
      data: {
        ...data,
        ticketUrl: data.ticketUrl || null,
        sourceUrl: data.sourceUrl || null,
        endDate: data.endDate || null,
        createdBy: req.admin?.adminId,
      },
    });

    logger.info({ adminId: req.admin?.adminId, eventId: event.id, action: 'event_created' }, 'Event created');

    const acceptsHtml = req.headers.accept?.includes('text/html') && !req.path.startsWith('/api/');
    if (acceptsHtml) {
      res.redirect(302, '/admin/events');
    } else {
      res.status(201).json({ success: true, data: event });
    }
  } catch (err) {
    logger.error({ err }, 'createEvent error');
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
}

export async function updateEvent(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Evento não encontrado', code: 'NOT_FOUND' });
    return;
  }

  const parsed = eventUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      success: false,
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const data = parsed.data;

  if (data.ticketUrl && data.ticketUrl !== '') {
    if (!validateTicketUrl(data.ticketUrl)) {
      res.status(422).json({
        success: false,
        error: 'URL de ingresso não permitida',
        code: 'INVALID_TICKET_URL',
      });
      return;
    }
  }

  try {
    const event = await prisma.event.update({
      where: { id },
      data: {
        ...data,
        ticketUrl: data.ticketUrl !== undefined ? (data.ticketUrl || null) : undefined,
        sourceUrl: data.sourceUrl !== undefined ? (data.sourceUrl || null) : undefined,
      },
    });

    logger.info({ adminId: req.admin?.adminId, eventId: id, action: 'event_updated' }, 'Event updated');

    const acceptsHtml = req.headers.accept?.includes('text/html') && !req.path.startsWith('/api/');
    if (acceptsHtml) {
      res.redirect(302, '/admin/events');
    } else {
      res.json({ success: true, data: event });
    }
  } catch (err) {
    logger.error({ err, id }, 'updateEvent error');
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
}

export async function deleteEvent(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Evento não encontrado', code: 'NOT_FOUND' });
      return;
    }

    await prisma.event.delete({ where: { id } });
    logger.info({ adminId: req.admin?.adminId, eventId: id, action: 'event_deleted' }, 'Event deleted');

    const acceptsHtml = req.headers.accept?.includes('text/html') && !req.path.startsWith('/api/');
    if (acceptsHtml) {
      res.redirect(302, '/admin/events');
    } else {
      res.json({ success: true });
    }
  } catch (err) {
    logger.error({ err, id }, 'deleteEvent error');
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
}

export async function togglePublish(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      res.status(404).json({ success: false, error: 'Evento não encontrado', code: 'NOT_FOUND' });
      return;
    }
    const updated = await prisma.event.update({
      where: { id },
      data: { isPublished: !event.isPublished },
    });
    logger.info({ adminId: req.admin?.adminId, eventId: id, isPublished: updated.isPublished, action: 'event_toggled' }, 'Event publish toggled');
    res.json({ success: true, data: { isPublished: updated.isPublished } });
  } catch (err) {
    logger.error({ err, id }, 'togglePublish error');
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
}

export async function renderEventForm(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const event = id ? await prisma.event.findUnique({ where: { id } }) : null;
    if (id && !event) {
      res.status(404).render('admin/404', { layout: 'admin' });
      return;
    }
    res.render('admin/event-form', {
      layout: 'admin',
      title: event ? `Editar: ${event.title}` : 'Novo Evento',
      event: event ? formatEventForForm(event) : null,
      categories: getCategoryOptions(),
      isNew: !event,
    });
  } catch (err) {
    logger.error({ err }, 'renderEventForm error');
    res.status(500).render('admin/error', { layout: 'admin', error: 'Erro interno' });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCategoryOptions() {
  return [
    { value: 'MUSICA', label: 'Música' },
    { value: 'TEATRO', label: 'Teatro' },
    { value: 'EXPO', label: 'Exposição' },
    { value: 'RUA', label: 'Rua' },
    { value: 'STANDUP', label: 'Stand Up' },
    { value: 'FAMILIA', label: 'Família' },
    { value: 'GASTRONOMIA', label: 'Gastronomia' },
    { value: 'ESPORTE', label: 'Esporte' },
  ];
}

function formatEventForView(event: any) {
  return {
    ...event,
    startDateFormatted: new Date(event.startDate).toLocaleDateString('pt-BR'),
    categoryLabel: getCategoryLabel(event.category),
    statusLabel: event.isPublished ? (event.isFeatured ? 'Destaque' : 'Publicado') : 'Rascunho',
    statusClass: event.isPublished ? (event.isFeatured ? 'amber' : 'green') : 'gray',
  };
}

function formatEventForForm(event: any) {
  return {
    ...event,
    startDateInput: event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : '',
    endDateInput: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : '',
  };
}

function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    MUSICA: 'Música', TEATRO: 'Teatro', EXPO: 'Exposição', RUA: 'Rua',
    STANDUP: 'Stand Up', FAMILIA: 'Família', GASTRONOMIA: 'Gastronomia', ESPORTE: 'Esporte',
  };
  return map[cat] ?? cat;
}
