import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../logger';

export interface AdminPayload {
  adminId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.['access_token'] as string | undefined;

  if (!token) {
    // For API routes return 401, for HTML routes redirect
    if (req.path.startsWith('/api/')) {
      res.status(401).json({ success: false, error: 'Não autenticado', code: 'UNAUTHORIZED' });
    } else {
      res.redirect(302, '/admin/login');
    }
    return;
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as AdminPayload;
    req.admin = payload;
    next();
  } catch (err) {
    logger.warn({ err }, 'Invalid JWT token');
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    if (req.path.startsWith('/api/')) {
      res.status(401).json({ success: false, error: 'Token inválido', code: 'INVALID_TOKEN' });
    } else {
      res.redirect(302, '/admin/login');
    }
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ success: false, error: 'Não autenticado', code: 'UNAUTHORIZED' });
      return;
    }
    if (req.admin.role !== role && req.admin.role !== 'SUPER_ADMIN') {
      res.status(403).json({ success: false, error: 'Acesso negado', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
