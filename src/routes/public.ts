import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { subscribeRateLimit } from '../middleware/rateLimit';
import { subscribe } from '../controllers/subscribers';
import { getPublishedEvents, getTodayEvents, getUpcomingEvents } from '../services/events';

const router = Router();

// ── Whitelist for query params (A03) ─────────────────────────────────────────
const VALID_CATEGORIES = ['todos', 'musica', 'teatro', 'expo', 'rua', 'standup', 'familia', 'gastronomia', 'esporte', 'gratuito'];

const querySchema = z.object({
  cat: z.string().refine((v) => VALID_CATEGORIES.includes(v.toLowerCase()), {
    message: 'Categoria inválida',
  }).optional(),
  cidade: z.string().max(50).regex(/^[a-z\-]+$/).optional(),
});

// ── Main page ─────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = querySchema.safeParse(req.query);
  const cat = parsed.success ? parsed.data.cat?.toLowerCase() : undefined;
  const city = (parsed.success ? parsed.data.cidade : undefined) ?? 'belo-horizonte';

  try {
    const [todayEvents, upcomingEvents] = await Promise.all([
      cat && cat !== 'todos'
        ? getPublishedEvents({ city, category: cat })
        : getTodayEvents(city),
      cat && cat !== 'todos'
        ? [] as any[]
        : getUpcomingEvents(city),
    ]);

    const todayItems = cat && cat !== 'todos' ? todayEvents.events : todayEvents;

    const now = new Date();
    const weekdayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

    const todayLabel = `${weekdayNames[now.getDay()]}, ${now.getDate()} de ${monthNames[now.getMonth()]}`;

    res.render('public/index', {
      layout: 'main',
      todayEvents: todayItems.map(formatEventForCard),
      upcomingEvents: (Array.isArray(upcomingEvents) ? upcomingEvents : []).map(formatEventForCard),
      activeCategory: cat || 'todos',
      todayLabel,
      city: 'BH',
      hasNoEvents: todayItems.length === 0,
      categories: getPublicCategories(cat || 'todos'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('public/error', { layout: 'main', error: 'Erro ao carregar eventos' });
  }
});

// ── Subscribe ─────────────────────────────────────────────────────────────────
router.post('/subscribe', subscribeRateLimit, subscribe);

// ── API: events ───────────────────────────────────────────────────────────────
router.get('/api/events', async (req: Request, res: Response): Promise<void> => {
  const { city, cat, date, page } = req.query as Record<string, string>;

  // Validate category
  if (cat && !VALID_CATEGORIES.includes(cat.toLowerCase())) {
    res.status(422).json({ success: false, error: 'Categoria inválida', code: 'VALIDATION_ERROR' });
    return;
  }

  try {
    const result = await getPublishedEvents({
      city: city || 'belo-horizonte',
      category: cat || undefined,
      date: date || undefined,
      page: page ? parseInt(page, 10) : 1,
    });

    res.json({
      success: true,
      data: result.events,
      pagination: { page: result.page, total: result.total },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
});

router.post('/api/subscribe', subscribeRateLimit, subscribe);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEventForCard(event: any) {
  const catSlug: Record<string, string> = {
    MUSICA: 'musica', TEATRO: 'teatro', EXPO: 'expo', RUA: 'rua',
    STANDUP: 'standup', FAMILIA: 'familia', GASTRONOMIA: 'gastronomia', ESPORTE: 'esporte',
  };
  const catLabel: Record<string, string> = {
    MUSICA: 'Música', TEATRO: 'Teatro', EXPO: 'Exposição', RUA: 'Rua',
    STANDUP: 'Stand Up', FAMILIA: 'Família', GASTRONOMIA: 'Gastronomia', ESPORTE: 'Esporte',
  };

  const hasLink = !!(event.ticketUrl || event.sourceUrl);
  const link = event.ticketUrl || event.sourceUrl || null;

  let endDateLabel = '';
  if (event.endDate) {
    const end = new Date(event.endDate);
    endDateLabel = `até ${end.getDate().toString().padStart(2, '0')}/${(end.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  return {
    ...event,
    categorySlug: catSlug[event.category] ?? 'outros',
    categoryLabel: catLabel[event.category] ?? event.category,
    hasLink,
    link,
    endDateLabel,
  };
}

function getPublicCategories(active: string) {
  const cats = [
    { slug: 'todos', label: 'Todos' },
    { slug: 'musica', label: 'Música' },
    { slug: 'teatro', label: 'Teatro' },
    { slug: 'expo', label: 'Exposições' },
    { slug: 'rua', label: 'Rua' },
    { slug: 'gratuito', label: 'Gratuito' },
    { slug: 'familia', label: 'Família' },
  ];
  return cats.map((c) => ({ ...c, isActive: c.slug === active }));
}

export default router;
