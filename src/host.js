// Host half of dsh-opencode-go-quota-card.
// 用法:把本文件内容粘贴到 cordis_define 的 code.host 中(动态插件)。
// 依赖注入:credentials / shell / sandboxPolicy / timer。
// RPC(客户端调用):ogQuota/status(取快照,过期自动刷新)、ogQuota/refresh(强制刷新)。

const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1/usage';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_REFRESH_MS = 5 * 60 * 1000;
const KEY_REF = 'OPENCODE_GO_API_KEY';

return {
  name: 'opencode-go-quota-card',
  inject: ['credentials', 'shell', 'sandboxPolicy', 'timer'],
  apply(ctx, config) {
    const cfg = Object.assign(
      { baseUrl: DEFAULT_BASE_URL, timeoutMs: DEFAULT_TIMEOUT_MS, refreshMs: DEFAULT_REFRESH_MS },
      config && typeof config === 'object' ? config : {}
    );

    let snapshot = { state: 'loading', fetchedAt: null, error: null, usage: null };
    let inflight = null;

    async function resolveKey() {
      const creds = ctx.get('credentials');
      if (creds && typeof creds.resolve === 'function') {
        try {
          const resolved = await creds.resolve(KEY_REF);
          if (resolved && typeof resolved.value === 'string' && resolved.value.length > 0) return resolved.value;
        } catch (e) { /* fall through */ }
      }
      return undefined;
    }

    function pickWindow(w) {
      if (!w || typeof w !== 'object') return null;
      const p = typeof w.percent === 'number' ? w.percent : Number(w.percent);
      return {
        status: typeof w.status === 'string' ? w.status : null,
        percent: Number.isFinite(p) ? p : null,
        resetsAt: typeof w.resetsAt === 'string' ? w.resetsAt : null,
      };
    }

    function policyFor() {
      try {
        return { mode: 'danger-full-access', workspaceRoot: ctx.sandboxPolicy.workspaceRoot || '' };
      } catch (e) {
        return { mode: 'danger-full-access', workspaceRoot: '' };
      }
    }

    async function runShell(command) {
      const spec = ctx.shell.resolve({ command, timeoutMs: cfg.timeoutMs, sandboxPolicy: policyFor() });
      return ctx.shell.run(spec);
    }

    function tail(s, n) {
      if (!s) return '';
      const t = String(s).replace(/\s+$/g, '');
      return t.length > n ? '…' + t.slice(-n) : t;
    }

    function parseBody(text) {
      const m = String(text).match(/\n@@(\d{3})$/);
      const status = m ? Number(m[1]) : null;
      const bodyText = m ? String(text).slice(0, m.index) : String(text);
      if (status === 401 || status === 403) return { error: 'unauthorized' };
      if (status === null || status < 200 || status >= 300) return { error: status === null ? 'bad-response' : 'http-' + status };
      let parsed = null;
      try { parsed = JSON.parse(bodyText); } catch (e) { return { error: 'bad-json' }; }
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

    async function fetchUsage(apiKey) {
      const esc = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
      const attempts = [];

      // Attempt 1: curl
      const curlCmd = [
        'curl', '-sS', '-m', String(Math.max(5, Math.round(cfg.timeoutMs / 1000))),
        '-H', esc('Authorization: Bearer ' + apiKey),
        '-H', esc('Accept: application/json'),
        '-w', esc('\n@@%{http_code}'),
        esc(cfg.baseUrl),
      ].join(' ');
      try {
        const res = await runShell(curlCmd);
        if (res && res.sandbox && res.sandbox.denied) return { error: 'denied', detail: 'sandbox denied' };
        if (res && res.timedOut) return { error: 'timeout', detail: 'timeout after ' + cfg.timeoutMs + 'ms' };
        if (res && res.exitCode === 0) return parseBody((res.stdout && res.stdout.text) || '');
        attempts.push('curl exit=' + (res ? String(res.exitCode) : 'none') + (res && res.signal ? ' signal=' + String(res.signal) : '') + (res && res.stderr && res.stderr.text ? ' stderr=' + tail(res.stderr.text, 200) : ''));
      } catch (e) {
        attempts.push('curl threw: ' + tail(String(e && e.message || e), 160));
      }

      // Attempt 2: node (global fetch, bundled TLS)
      const script = "const s=process.argv[1];fetch(s,{headers:{Authorization:'Bearer '+process.argv[2],Accept:'application/json'},signal:AbortSignal.timeout(" + String(cfg.timeoutMs) + ")}).then(async r=>{process.stdout.write((await r.text())+'\\n@@'+r.status)}).catch(e=>{process.stderr.write('NODE-FETCH-ERR: '+String(e&&e.message||e));process.exit(1)})";
      const nodeCmd = ['node', '-e', '"' + script + '"', esc(cfg.baseUrl), esc(apiKey)].join(' ');
      try {
        const res = await runShell(nodeCmd);
        if (res && res.sandbox && res.sandbox.denied) return { error: 'denied', detail: attempts.join(' | ') + ' | node denied' };
        if (res && res.timedOut) return { error: 'timeout', detail: attempts.join(' | ') + ' | node timeout' };
        if (res && res.exitCode === 0) {
          const parsed = parseBody((res.stdout && res.stdout.text) || '');
          if (parsed.ok) return parsed;
          return { error: parsed.error, detail: attempts.join(' | ') };
        }
        attempts.push('node exit=' + (res ? String(res.exitCode) : 'none') + (res && res.stderr && res.stderr.text ? ' stderr=' + tail(res.stderr.text, 200) : ''));
      } catch (e) {
        attempts.push('node threw: ' + tail(String(e && e.message || e), 160));
      }

      return { error: 'network', detail: attempts.join(' | ') };
    }

    function refresh() {
      if (inflight) return inflight;
      inflight = (async () => {
        let next;
        try {
          const apiKey = await resolveKey();
          if (!apiKey) {
            next = { state: 'error', fetchedAt: Date.now(), error: 'no-key', usage: null, detail: 'credentials service returned nothing for ' + KEY_REF };
          } else {
            const got = await fetchUsage(apiKey);
            if (got.ok) next = { state: 'ok', fetchedAt: Date.now(), error: null, usage: got.usage };
            else next = { state: 'error', fetchedAt: Date.now(), error: got.error, usage: null, detail: got.detail || null };
          }
        } catch (e) {
          next = { state: 'error', fetchedAt: Date.now(), error: 'exception', usage: null, detail: tail(String(e && e.message || e), 200) };
        }
        snapshot = next;
        return snapshot;
      })();
      inflight.finally(() => { inflight = null; });
      return inflight;
    }

    ctx.effect(() => harness.handle('ogQuota/status', async () => {
      if (inflight) return inflight;
      if (!snapshot.fetchedAt || Date.now() - snapshot.fetchedAt > cfg.refreshMs) return refresh();
      return snapshot;
    }));
    ctx.effect(() => harness.handle('ogQuota/refresh', () => refresh()));

    void refresh();
    ctx.interval(() => { void refresh(); }, cfg.refreshMs);
  },
};
