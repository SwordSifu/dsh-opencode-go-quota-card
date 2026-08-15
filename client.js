// Client half of dsh-opencode-go-quota-card.
// Hand-written browser bundle in the lazy-CJS format the client module loader
// expects: it only REGISTERS the factory; the body runs at materialization.
// It mounts the opencodeQuota Remote and registers a composer-dock card that
// shows the OpenCode Go usage windows and refreshes periodically.

window.__ModuleLoader__.load({
  id: 'dsh-opencode-go-quota-card',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    const React = require('react');

    const REFRESH_MS = 5 * 60 * 1000;
    const WINDOWS = [
      { key: 'rolling', label: '5小时' },
      { key: 'weekly', label: '本周' },
      { key: 'monthly', label: '本月' },
    ];

    // Client-side Remote contribution. The result codec is a pass-through
    // parser: the Host already validates the business result against its own
    // zod schema before it crosses the wire, and this side only needs the
    // descriptor's strict shape to mount and call.
    const REMOTE_RESULT = {
      mode: 'strict',
      typeSymbol: 'dsh-opencode-go-quota-card#OpencodeQuotaResult',
      schema: { parse(value) { return value; } },
    };
    const REMOTE_BASE = {
      service: 'opencodeQuota',
      namespace: 'opencodeQuota',
      invocation: { kind: 'direct' },
      parameters: [],
      result: REMOTE_RESULT,
    };
    const TYPERT_REMOTE = {
      package: 'dsh-opencode-go-quota-card',
      descriptors: [
        { ...REMOTE_BASE, id: 'dsh-opencode-go-quota-card#opencodeQuota/usage', method: 'usage' },
        { ...REMOTE_BASE, id: 'dsh-opencode-go-quota-card#opencodeQuota/refresh', method: 'refresh' },
      ],
    };

    const CSS = [
      '.ogq-card{display:flex;align-items:center;gap:12px;padding:5px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;',
      'background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.3;margin:2px 0 6px}',
      '.ogq-title{font-weight:600;white-space:nowrap}',
      '.ogq-win{display:flex;align-items:center;gap:6px;white-space:nowrap}',
      '.ogq-label{color:var(--dsw-alias-label-secondary)}',
      '.ogq-track{display:inline-block;width:56px;height:6px;border-radius:3px;background:var(--dsw-alias-bg-layer-2);',
      'border:1px solid var(--dsw-alias-border-l1);overflow:hidden}',
      '.ogq-fill{display:block;height:100%;border-radius:3px;background:var(--dsw-alias-brand-primary)}',
      '.ogq-fill-warn{background:var(--dsw-alias-state-warn-primary)}',
      '.ogq-fill-error{background:var(--dsw-alias-state-error-primary)}',
      '.ogq-pct{min-width:34px;text-align:right;font-variant-numeric:tabular-nums}',
      '.ogq-reset{color:var(--dsw-alias-label-secondary)}',
      '.ogq-meta{color:var(--dsw-alias-label-secondary)}',
      '.ogq-detail{color:var(--dsw-alias-label-secondary);font-size:11px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ogq-btn{background:none;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-secondary);',
      'cursor:pointer;font-size:11px;padding:2px 8px;font-family:inherit}',
      '.ogq-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}',
      '.ogq-err{color:var(--dsw-alias-state-error-primary)}',
    ].join('');

    const CSS_TAG = 'dsh-opencode-go-quota-card/client.css';
    function ensureCss() {
      if (typeof document === 'undefined') return;
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']')) return;
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-opencode-go-quota-card';
      tag.dataset.pluginCss = CSS_TAG;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    function fmtTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, '0');
      return p(d.getHours()) + ':' + p(d.getMinutes());
    }

    function fmtReset(iso) {
      if (!iso) return '';
      const ms = new Date(iso).getTime() - Date.now();
      if (!Number.isFinite(ms) || ms <= 0) return '已重置';
      const m = Math.floor(ms / 60000);
      if (m < 60) return m + '分';
      const h = Math.floor(m / 60);
      if (h < 24) return h + '时' + (m % 60) + '分';
      const d = Math.floor(h / 24);
      return d + '天' + (h % 24) + '时';
    }

    const ERROR_TEXT = {
      'no-key': '未配置 OPENCODE_GO_API_KEY',
      'unauthorized': '密钥无效 (401)',
      'network': '网络请求失败',
      'timeout': '请求超时',
      'denied': '执行被沙箱拒绝',
      'bad-json': '响应解析失败',
      'http-': '接口返回异常',
      'exception': '内部错误',
    };

    function QuotaCard(props) {
      const query = props.query;
      const [snap, setSnap] = React.useState(null);
      React.useEffect(() => {
        let alive = true;
        const load = () => {
          Promise.resolve()
            .then(() => query())
            .then((s) => { if (alive) setSnap(s); })
            .catch(() => {});
        };
        load();
        const id = setInterval(load, REFRESH_MS);
        return () => { alive = false; clearInterval(id); };
      }, [query]);

      const refreshNow = () => {
        Promise.resolve()
          .then(() => query(true))
          .then((s) => setSnap(s))
          .catch(() => {});
      };

      const cells = [];
      if (snap && snap.state === 'ok' && snap.usage) {
        for (const w of WINDOWS) {
          const win = snap.usage[w.key];
          const pct = win && typeof win.percent === 'number' ? win.percent : null;
          const fillCls = pct === null ? 'ogq-fill' : pct >= 85 ? 'ogq-fill-error' : pct >= 60 ? 'ogq-fill-warn' : 'ogq-fill';
          cells.push(
            React.createElement('span', { key: w.key, className: 'ogq-win' },
              React.createElement('span', { className: 'ogq-label' }, w.label),
              React.createElement('span', { className: 'ogq-track' },
                React.createElement('span', { className: fillCls, style: { width: (pct === null ? 0 : Math.max(2, Math.min(100, Math.round(pct)))) + '%' } })
              ),
              React.createElement('span', { className: 'ogq-pct' }, pct === null ? '—' : Math.round(pct) + '%'),
              React.createElement('span', { className: 'ogq-reset' }, win && win.resetsAt ? fmtReset(win.resetsAt) : '')
            )
          );
        }
      }

      let body;
      let detail = null;
      if (!snap || snap.state === 'loading') {
        body = React.createElement('span', { className: 'ogq-meta' }, '加载中…');
      } else if (snap.state === 'error') {
        const key = snap.error && String(snap.error).startsWith('http-') ? 'http-' : (snap.error || 'exception');
        body = React.createElement('span', { className: 'ogq-err' }, ERROR_TEXT[key] || String(snap.error));
        if (snap.detail) detail = React.createElement('span', { className: 'ogq-detail' }, String(snap.detail));
      } else {
        body = cells;
      }

      return React.createElement('div', { className: 'ogq-card' },
        React.createElement('span', { className: 'ogq-title' }, 'OpenCode Go'),
        body,
        detail,
        React.createElement('span', { className: 'ogq-meta' }, snap && snap.fetchedAt ? fmtTime(snap.fetchedAt) : ''),
        React.createElement('button', { className: 'ogq-btn', onClick: refreshNow }, '刷新')
      );
    }

    function apply(ctx) {
      ensureCss();
      const mountReady = ctx.remote.$mount(TYPERT_REMOTE);

      // force=true asks the Host for a fresh fetch instead of a cached snapshot.
      const query = async (force) => {
        await mountReady;
        const api = ctx.get('remote.opencodeQuota');
        if (!api) throw new Error('opencodeQuota remote is unavailable');
        const result = force ? await api.refresh() : await api.usage();
        if (!result || result.ok === false) {
          const err = result && result.error;
          throw new Error((err && (err.message || String(err))) || 'remote failed');
        }
        return result.value;
      };

      ctx.effect(() => ctx.slots.register({
        name: 'conversation.composer.dock',
        id: 'og-quota',
        order: 200,
        label: 'OpenCode Go',
      }, (props) => React.createElement(QuotaCard, Object.assign({}, props, { query }))), 'opencode-go-quota-card: composer dock entry');
    }

    exports.apply = apply;
    exports.inject = ['slots', 'remote'];
    return module.exports;
  }
});
