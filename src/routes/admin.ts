import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { loginRateLimit } from '../middleware/rateLimit';
import { loginAdmin, logoutAdmin, refreshAccessToken } from '../controllers/auth';
import {
  listAdminEvents,
  getAdminEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  togglePublish,
  renderEventForm,
} from '../controllers/events';
import { listSubscribers, exportSubscribers } from '../controllers/subscribers';
import { prisma } from '../db';

const router = Router();

// ── Auth routes ───────────────────────────────────────────────────────────────
router.get('/login', (req: Request, res: Response) => {
  if (req.cookies?.['access_token']) {
    res.redirect(302, '/admin/events');
    return;
  }
  res.render('admin/login', { layout: 'admin-bare' });
});

router.post('/login', loginRateLimit, loginAdmin);
router.post('/logout', requireAuth, logoutAdmin);
router.get('/logout', requireAuth, logoutAdmin);
router.post('/refresh', refreshAccessToken);

// ── Admin dashboard ───────────────────────────────────────────────────────────
router.get('/', requireAuth, (req: Request, res: Response) => {
  res.redirect(302, '/admin/events');
});

// ── Events CRUD ───────────────────────────────────────────────────────────────
router.get('/events', requireAuth, listAdminEvents);
router.get('/events/new', requireAuth, renderEventForm);
router.post('/events', requireAuth, createEvent);
router.get('/events/:id/edit', requireAuth, renderEventForm);
router.post('/events/:id', requireAuth, updateEvent);
router.post('/events/:id/delete', requireAuth, deleteEvent);
router.post('/events/:id/toggle-publish', requireAuth, togglePublish);

// ── Subscribers ───────────────────────────────────────────────────────────────
router.get('/subscribers', requireAuth, listSubscribers);
router.get('/subscribers/export.csv', requireAuth, exportSubscribers);

// ── API admin routes ──────────────────────────────────────────────────────────
router.post('/api/admin/login', loginRateLimit, loginAdmin);

router.get('/api/admin/events', requireAuth, listAdminEvents);
router.post('/api/admin/events', requireAuth, createEvent);
router.get('/api/admin/events/:id', requireAuth, getAdminEvent);
router.put('/api/admin/events/:id', requireAuth, updateEvent);
router.delete('/api/admin/events/:id', requireAuth, deleteEvent);

router.get('/api/admin/subscribers', requireAuth, listSubscribers);
router.get('/api/admin/subscribers/export.csv', requireAuth, exportSubscribers);

export default router;
