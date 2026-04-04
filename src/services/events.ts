import { Category, Prisma } from '@prisma/client';
import { prisma } from '../db';

export type EventFilters = {
  city?: string;
  category?: string;
  date?: string; // 'hoje' | 'semana' | ISO date
  page?: number;
  limit?: number;
};

const CATEGORY_MAP: Record<string, Category> = {
  musica: Category.MUSICA,
  teatro: Category.TEATRO,
  expo: Category.EXPO,
  rua: Category.RUA,
  standup: Category.STANDUP,
  familia: Category.FAMILIA,
  gastronomia: Category.GASTRONOMIA,
  esporte: Category.ESPORTE,
};

export function slugToCategory(slug: string): Category | undefined {
  return CATEGORY_MAP[slug.toLowerCase()];
}

export const ALLOWED_TICKET_DOMAINS = [
  'sympla.com.br',
  'eventim.com.br',
  'tickets.com',
  'ingresso.com',
  'sescmg.com.br',
  'eventbrite.com',
  'bilheteria.com.br',
];

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateTicketUrl(url: string): boolean {
  if (!validateUrl(url)) return false;
  // SSRF protection — allow any HTTPS URL but log domain
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  return ALLOWED_TICKET_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
}

function getDateRange(date: string): { gte: Date; lte: Date } {
  const now = new Date();
  if (date === 'hoje') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { gte: start, lte: end };
  }
  if (date === 'semana') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { gte: start, lte: end };
  }
  // ISO date string
  const d = new Date(date);
  if (!isNaN(d.getTime())) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    return { gte: start, lte: end };
  }
  // Default: from now
  return { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
}

export async function getPublishedEvents(filters: EventFilters = {}) {
  const { city = 'belo-horizonte', category, date, page = 1, limit = 50 } = filters;

  const where: Prisma.EventWhereInput = {
    isPublished: true,
    city,
  };

  if (category && category !== 'todos' && category !== 'gratuito') {
    const cat = slugToCategory(category);
    if (cat) where.category = cat;
  }

  if (category === 'gratuito') {
    where.isFree = true;
  }

  if (date) {
    const range = getDateRange(date);
    where.startDate = { gte: range.gte, lte: range.lte };
  }

  const skip = (page - 1) * limit;
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { startDate: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return { events, total, page, limit };
}

export async function getEventById(id: string) {
  return prisma.event.findUnique({ where: { id } });
}

export async function getTodayEvents(city = 'belo-horizonte') {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  return prisma.event.findMany({
    where: {
      isPublished: true,
      city,
      startDate: { gte: todayStart, lte: todayEnd },
    },
    orderBy: [{ isFeatured: 'desc' }, { startDate: 'asc' }],
  });
}

export async function getUpcomingEvents(city = 'belo-horizonte', days = 7) {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59);

  return prisma.event.findMany({
    where: {
      isPublished: true,
      city,
      startDate: { gt: todayEnd, lte: weekEnd },
    },
    orderBy: [{ startDate: 'asc' }, { isFeatured: 'desc' }],
  });
}

export async function getAllEventsAdmin(filters: {
  search?: string;
  category?: string;
  date?: string;
  page?: number;
  limit?: number;
} = {}) {
  const { search, category, date, page = 1, limit = 20 } = filters;

  const where: Prisma.EventWhereInput = {};

  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }

  if (category) {
    const cat = slugToCategory(category);
    if (cat) where.category = cat;
  }

  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      where.startDate = { gte: start, lte: end };
    }
  }

  const skip = (page - 1) * limit;
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return { events, total, page, limit, totalPages: Math.ceil(total / limit) };
}
