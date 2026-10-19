type Level = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY =
  /token|cookie|authorization|secret|password|^code$|verifier|nonce|state/i;
const JWT_LIKE = /eyJ[\w-]+\.[\w-]+\.[\w-]*/g;

/** Replaces values of sensitive keys and anything that looks like a JWT. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[depth]';
  if (typeof value === 'string')
    return value.replace(JWT_LIKE, '[redacted-jwt]');
  if (value instanceof Error) {
    return { name: value.name, message: redact(value.message, depth + 1) };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[redacted]' : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

function write(
  level: Level,
  msg: string,
  fields?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  });
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) =>
    write('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) =>
    write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) =>
    write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) =>
    write('error', msg, fields),
};
