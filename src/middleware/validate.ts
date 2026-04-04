import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Content-Type check for POST/PUT
    const method = req.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const ct = req.headers['content-type'] ?? '';
      if (!ct.includes('application/json') && !ct.includes('application/x-www-form-urlencoded') && !ct.includes('multipart/form-data')) {
        res.status(415).json({ success: false, error: 'Content-Type não suportado', code: 'UNSUPPORTED_MEDIA_TYPE' });
        return;
      }
    }

    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      res.status(422).json({
        success: false,
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      res.status(422).json({
        success: false,
        error: 'Parâmetros inválidos',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
      return;
    }
    req.query = result.data as any;
    next();
  };
}
