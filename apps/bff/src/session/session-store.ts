import session from 'express-session';

/**
 * Minimal persistence contract for BFF sessions. The dev build uses the in-memory
 * implementation; a Redis implementation only needs these four methods.
 */
export interface SessionStore {
  get(sid: string): Promise<session.SessionData | undefined>;
  set(sid: string, data: session.SessionData, ttlMs: number): Promise<void>;
  destroy(sid: string): Promise<void>;
  touch(sid: string, data: session.SessionData, ttlMs: number): Promise<void>;
}

function ttlOf(data: session.SessionData, fallbackMs: number): number {
  const maxAge = data.cookie?.maxAge;
  return typeof maxAge === 'number' && maxAge > 0 ? maxAge : fallbackMs;
}

/** Adapts a {@link SessionStore} to the callback API expected by express-session. */
export class ExpressSessionStoreAdapter extends session.Store {
  constructor(
    private readonly store: SessionStore,
    private readonly defaultTtlMs: number,
  ) {
    super();
  }

  override get(
    sid: string,
    callback: (err: unknown, data?: session.SessionData | null) => void,
  ): void {
    this.store.get(sid).then((data) => callback(null, data ?? null), callback);
  }

  override set(
    sid: string,
    data: session.SessionData,
    callback?: (err?: unknown) => void,
  ): void {
    this.store
      .set(sid, data, ttlOf(data, this.defaultTtlMs))
      .then(() => callback?.(), callback);
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.store.destroy(sid).then(() => callback?.(), callback);
  }

  override touch(
    sid: string,
    data: session.SessionData,
    callback?: () => void,
  ): void {
    this.store.touch(sid, data, ttlOf(data, this.defaultTtlMs)).then(
      () => callback?.(),
      () => callback?.(),
    );
  }
}
