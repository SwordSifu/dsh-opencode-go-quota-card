// Client half of dsh-opencode-go-quota-card.
// 用法:把本文件内容粘贴到 cordis_define 的 code.client 中(动态插件)。
// 依赖注入:slots / timer。注册于 conversation.composer.dock 插槽(输入框下方的环境读数区)。

const REFRESH_MS = 5 * 60 * 1000;
const WINDOWS = [
  { key: 'rolling', label: '5小时' },
  { key: 'weekly', label: '本周' },
  { key: 'monthly', label: '本月' },
];

const CSS = `
.ogq-card { display: flex; align-items: center; gap: 12px; padding: 5px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 1.3; margin: 2px 0 6px; }
.ogq-title { font-weight: 600; white-space: nowrap; }
.ogq-win { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.ogq-label { color: var(--dsw-alias-label-secondary); }
.ogq-track { display: inline-block; width: 56px; height: 6px; border-radius: 3px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); overflow: hidden; }
.ogq-fill { display: block; height: 100%; border-radius: 3px; background: var(--dsw-alias-brand-primary); }
.ogq-fill-warn { background: var(--dsw-alias-state-warn-primary); }
.ogq-fill-error { background: var(--dsw-alias-state-error-primary); }
.ogq-pct { min-width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
.ogq-reset { color: var(--dsw-alias-label-secondary); }
.ogq-meta { color: var(--dsw-alias-label-secondary); }
.ogq-detail { color: var(--dsw-alias-label-secondary); font-size: 11px; max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ogq-btn { background: none; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 11px; padding: 2px 8px; font-family: inherit; }
.ogq-btn:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); }
.ogq-err { color: var(--dsw-alias-state-error-primary); }
`;

return {
  name: 'opencode-go-quota-card',
  inject: ['slots', 'timer'],
  apply(ctx) {
    ctx.effect(() => styles.insert(CSS));

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
      'bad-response': '接口无响应',
      'exception': '内部错误',
    };

    function QuotaCard() {
      const [snap, setSnap] = React.useState(null);
      React.useEffect(() => {
        let alive = true;
        const load = () => {
          host.call('ogQuota/status').then((s) => { if (alive) setSnap(s); }).catch(() => {});
        };
        load();
        const stop = ctx.interval(load, REFRESH_MS);
        return () => { alive = false; stop(); };
      }, []);

      const refreshNow = () => {
        host.call('ogQuota/refresh').then((s) => setSnap(s)).catch(() => {});
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
        body = React.createElement('span', { className: 'ogq-err' }, ERROR_TEXT[snap.error] || String(snap.error || '未知错误'));
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

    ctx.slots.inject('conversation.composer.dock', () => {
      return ctx.slots.register({ name: 'conversation.composer.dock', id: 'og-quota', order: 200, label: 'OpenCode Go' }, QuotaCard);
    });
  },
};
