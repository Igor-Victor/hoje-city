import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { config, isProd } from '../config';
import { logger } from '../logger';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd || config.COOKIE_SECURE,
  sameSite: 'strict' as const,
  path: '/',
};

function signAccessToken(adminId: string, role: string): string {
  return jwt.sign({ adminId, role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

function signRefreshToken(adminId: string): string {
  return jwt.sign({ adminId, type: 'refresh' }, config.JWT_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export async function loginAdmin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const ip = req.ip ?? 'unknown';

  // Generic error to prevent user enumeration (A07)
  const genericError = 'E-mail ou senha incorretos';

  try {
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin) {
      logger.warn({ ip, action: 'login_fail', reason: 'email_not_found' }, 'Login failed');
      res.status(401).json({ success: false, error: genericError, code: 'INVALID_CREDENTIALS' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatch) {
      logger.warn({ ip, adminId: admin.id, action: 'login_fail', reason: 'wrong_password' }, 'Login failed');
      res.status(401).json({ success: false, error: genericError, code: 'INVALID_CREDENTIALS' });
      return;
    }

    const accessToken = signAccessToken(admin.id, admin.role);
    const refreshTokenValue = signRefreshToken(admin.id);

    // Store refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        adminId: admin.id,
        expiresAt,
      },
    });

    res.cookie('access_token', accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 1000, // 1h
    });

    res.cookie('refresh_token', refreshTokenValue, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    logger.info({ adminId: admin.id, action: 'login_success' }, 'Admin logged in');

    // Handle HTML form vs API
    const acceptsHtml = req.headers.accept?.includes('text/html');
    if (acceptsHtml && !req.path.startsWith('/api/')) {
      res.redirect(302, '/admin/events');
    } else {
      res.json({ success: true, data: { adminId: admin.id, role: admin.role } });
    }
  } catch (err) {
    logger.error({ err, ip }, 'Login error');
    res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
  }
}

export async function logoutAdmin(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

  if (refreshToken) {
    // Revoke refresh token
    try {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Ignore errors on revocation
    }
  }

  res.clearCookie('access_token', COOKIE_OPTIONS);
  res.clearCookie('refresh_token', COOKIE_OPTIONS);

  res.redirect(302, '/admin/login');
}

export async function refreshAccessToken(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.['refresh_token'] as string | undefined;

  if (!refreshToken) {
    res.status(401).json({ success: false, error: 'Refresh token ausente', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, config.JWT_SECRET) as { adminId: string; type: string };

    if (payload.type !== 'refresh') {
      res.status(401).json({ success: false, error: 'Token inválido', code: 'INVALID_TOKEN' });
      return;
    }

    // Check DB for revocation
    const storedToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      res.clearCookie('access_token', COOKIE_OPTIONS);
      res.clearCookie('refresh_token', COOKIE_OPTIONS);
      res.status(401).json({ success: false, error: 'Sessão expirada', code: 'SESSION_EXPIRED' });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } });
    if (!admin) {
      res.status(401).json({ success: false, error: 'Admin não encontrado', code: 'UNAUTHORIZED' });
      return;
    }

    const newAccessToken = signAccessToken(admin.id, admin.role);
    res.cookie('access_token', newAccessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 1000,
    });

    res.json({ success: true });
  } catch {
    res.clearCookie('access_token', COOKIE_OPTIONS);
    res.clearCookie('refresh_token', COOKIE_OPTIONS);
    res.status(401).json({ success: false, error: 'Token inválido', code: 'INVALID_TOKEN' });
  }
}
