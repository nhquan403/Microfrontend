import type session from 'express-session';
import type { SessionStore } from './session-store';

interface Entry {
  data: string;
  expiresAt: number;
}

/**
 * Development-only store. Sessions are lost on restart and not shared between
 * instances; use a Redis-backed {@link SessionStore} in production.
 */
export class MemorySessionStore implements SessionStore {
  private readonly entries = new Map<string, Entry>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(
    sweepIntervalMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {
    this.sweeper = setInterval(() => this.sweep(), sweepIntervalMs);
    this.sweeper.unref();
  }

  async get(sid: string): Promise<session.SessionData | undefined> {
    const entry = this.entries.get(sid);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(sid);
      return undefined;
    }
    return JSON.parse(entry.data) as session.SessionData;
  }

  async set(
    sid: string,
    data: session.SessionData,
    ttlMs: number,
  ): Promise<void> {
    this.entries.set(sid, {
      data: JSON.stringify(data),
      expiresAt: this.now() + ttlMs,
    });
  }

  async destroy(sid: string): Promise<void> {
    this.entries.delete(sid);
  }

  async touch(
    sid: string,
    _data: session.SessionData,
    ttlMs: number,
  ): Promise<void> {
    const entry = this.entries.get(sid);
    if (entry) entry.expiresAt = this.now() + ttlMs;
  }

  size(): number {
    return this.entries.size;
  }

  close(): void {
    clearInterval(this.sweeper);
  }

  private sweep(): void {
    const now = this.now();
    for (const [sid, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(sid);
    }
  }
}
