/**
 * Minimal logger.
 *
 * Deliberately narrow: callers pass short descriptive messages and small
 * metadata objects. Never pass API keys, full JD text, or raw provider
 * responses through here.
 */

type Meta = Record<string, string | number | boolean>;

function emit(level: 'info' | 'warn' | 'error', message: string, meta?: Meta): void {
  const line = meta
    ? `[${level}] ${message} ${JSON.stringify(meta)}`
    : `[${level}] ${message}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, meta?: Meta) => emit('info', message, meta),
  warn: (message: string, meta?: Meta) => emit('warn', message, meta),
  error: (message: string, meta?: Meta) => emit('error', message, meta),
};
