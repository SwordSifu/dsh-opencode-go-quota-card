// Host half of dsh-opencode-go-quota-card (file-based web plugin).
// Registers the "opencodeQuota" cordis service (a Typert Remote); the browser
// client calls usage() over the /api RPC carrier. Fetches OpenCode Go usage
// with the Node global fetch, caches the snapshot, and refreshes on an interval.

import z from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { credentialRef } from '@deepseek-ai/dsh-credentials';

const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1/usage';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_REFRESH_MS = 5 * 60 * 1000;
const KEY_REF = 'OPENCODE_GO_API_KEY';

export const Config = z.object({
  baseUrl: z.string().default(DEFAULT_BASE_URL),
  timeoutMs: z.number().default(DEFAULT_TIMEOUT_MS),
  refreshMs: z.number().default(DEFAULT_REFRESH_MS),
});

function pickWindow(w) {
  if (!w || typeof w !== 'object') return null;
  const p = typeof w.percent === 'number' ? w.percent : Number(w.percent);
  return {
    status: typeof w.status === 'string' ? w.status : null,
    percent: Number.isFinite(p) ? p : null,
    resetsAt: typeof w.resetsAt === 'string' ? w.resetsAt : null,
  };
}

function tail(s, n) {
  if (!s) return '';
  const t = String(s).replace(/\s+$/g, '');
  return t.length > n ? '…' + t.slice(-n) : t;
}

export class OpencodeQuotaGateway extends TypertRemoteService {
  static inject = ['credentials', 'timer'];
  static Config = Config;

  constructor(ctx, config) {
    super(ctx, 'opencodeQuota');
    this.config = config ?? {};
    this.snapshot = { state: 'loading', fetchedAt: null, error: null, detail: null, usage: null };
    this.inflight = null;
    const refreshMs = this.config.refreshMs ?? DEFAULT_REFRESH_MS;
    this.ctx.setInterval(() => { void this.refresh(); }, refreshMs);
    void this.refresh();
  }

  async resolveKey() {
    try {
      const resolved = await this.ctx.credentials.resolve(credentialRef(KEY_REF));
      if (resolved && typeof resolved.value === 'string' && resolved.value.length > 0) return resolved.value;
    } catch { /* fall through */ }
    return undefined;
  }

  async fetchUsage() {
    const apiKey = await this.resolveKey();
    if (!apiKey) return { error: 'no-key' };
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let res;
    try {
      res = await fetch(baseUrl, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      return { error: 'network', detail: tail(String(e && e.message || e), 200) };
    }
    if (res.status === 401 || res.status === 403) return { error: 'unauthorized' };
    if (!res.ok) return { error: 'http-' + res.status };
    let parsed = null;
    try { parsed = await res.json(); } catch { return { error: 'bad-json' }; }
    const usage = parsed && typeof parsed === 'object' && parsed.usage ? parsed.usage : parsed;
    if (!usage || typeof usage !== 'object') return { error: 'bad-json' };
    return {
      ok: true,
      usage: {
        rolling: pickWindow(usage.rolling),
        weekly: pickWindow(usage.weekly),
        monthly: pickWindow(usage.monthly),
      },
    };
  }

  refresh() {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      let next;
      try {
        const got = await this.fetchUsage();
        if (got.ok) next = { state: 'ok', fetchedAt: Date.now(), error: null, detail: null, usage: got.usage };
        else next = { state: 'error', fetchedAt: Date.now(), error: got.error, usage: null, detail: got.detail || null };
      } catch (e) {
        next = { state: 'error', fetchedAt: Date.now(), error: 'exception', usage: null, detail: tail(String(e && e.message || e), 200) };
      }
      this.snapshot = next;
      return this.snapshot;
    })();
    this.inflight.finally(() => { this.inflight = null; });
    return this.inflight;
  }

  async usage() {
    if (this.inflight) return this.inflight;
    const refreshMs = this.config.refreshMs ?? DEFAULT_REFRESH_MS;
    if (!this.snapshot.fetchedAt || Date.now() - this.snapshot.fetchedAt > refreshMs) return this.refresh();
    return this.snapshot;
  }
}

export default OpencodeQuotaGateway;
