import type { Context } from 'hono';

export class HttpError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500 | 502 | 503,
    message: string,
    public readonly code: string = 'request_error'
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function errorResponse(c: Context, error: unknown) {
  if (error instanceof HttpError) {
    return c.json({ error: error.message, code: error.code }, error.status);
  }
  console.error('Unhandled API error:', error);
  const message = error instanceof Error ? error.message : 'Ralat dalaman pelayan.';
  return c.json({ error: message, code: 'internal_error' }, 500);
}

export function assert(
  condition: unknown,
  status: ConstructorParameters<typeof HttpError>[0],
  message: string,
  code?: string
): asserts condition {
  if (!condition) throw new HttpError(status, message, code);
}
