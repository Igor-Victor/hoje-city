import './config'; // Validate env first
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import { engine } from 'express-handlebars';
import { config, isProd } from './config';
import { logger } from './logger';
import { apiRateLimit } from './middleware/rateLimit';
import publicRouter from './routes/public';
import adminRouter from './routes/admin';

const app = express();

// ── Security headers (A05) ────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // inline needed for small UI scripts
        styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })
);

app.disable('x-powered-by');

// ── HTTPS redirect in production ──────────────────────────────────────────────
if (isProd) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Template engine ───────────────────────────────────────────────────────────
app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    partialsDir: path.join(__dirname, 'views', 'partials'),
    helpers: {
      eq: (a: any, b: any) => a === b,
      ne: (a: any, b: any) => a !== b,
      and: (a: any, b: any) => a && b,
      or: (a: any, b: any) => a || b,
      not: (a: any) => !a,
      json: (v: any) => JSON.stringify(v),
      formatDate: (date: Date | string) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      },
      formatDateShort: (date: Date | string) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
      },
      categoryClass: (cat: string) => {
        const map: Record<string, string> = {
          MUSICA: 'cat-musica', TEATRO: 'cat-teatro', EXPO: 'cat-expo',
          RUA: 'cat-rua', STANDUP: 'cat-standup', FAMILIA: 'cat-familia',
        };
        return map[cat] ?? 'cat-outros';
      },
      checked: (val: boolean) => (val ? 'checked' : ''),
      selected: (a: string, b: string) => (a === b ? 'selected' : ''),
      multiply: (a: number, b: number) => a * b,
      add: (a: number, b: number) => a + b,
      subtract: (a: number, b: number) => a - b,
      gt: (a: number, b: number) => a > b,
      lt: (a: number, b: number) => a < b,
      range: (n: number) => Array.from({ length: n }, (_, i) => i + 1),
    },
  })
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// ── Global rate limit on API ──────────────────────────────────────────────────
app.use('/api/', apiRateLimit);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', publicRouter);
app.use('/admin', adminRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  const acceptsHtml = req.headers.accept?.includes('text/html');
  if (acceptsHtml) {
    res.status(404).render('public/404', { layout: 'main' });
  } else {
    res.status(404).json({ success: false, error: 'Não encontrado', code: 'NOT_FOUND' });
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  // Never expose stack traces in production (A05)
  const message = isProd ? 'Erro interno do servidor' : err.message;
  res.status(500).json({ success: false, error: message, code: 'INTERNAL_ERROR' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
  logger.info(`🌆 Hoje.city running on http://localhost:${config.PORT} [${config.NODE_ENV}]`);
});

export default app;
