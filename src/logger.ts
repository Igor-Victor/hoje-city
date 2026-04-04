import pino from 'pino';
import { isProd } from './config';

export const logger = pino({
  level: isProd ? 'info' : 'debug',
  transport: isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true } },
  redact: {
    paths: ['*.password', '*.passwordHash', '*.token', '*.email'],
    censor: '[REDACTED]',
  },
});
