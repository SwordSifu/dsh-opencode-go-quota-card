# dsh-opencode-go-quota-card

DeepSeek Harness (DSH) Web GUI 动态 Cordis 插件:在**会话输入框下方**显示一张 **OpenCode Go 套餐额度卡片**,展示 5 小时滚动 / 周 / 月三个窗口的用量,并**定期自动刷新**(默认每 5 分钟),支持手动刷新。

> A dynamic Cordis plugin for the DeepSeek Harness web GUI: a quota card for your OpenCode Go subscription (5h rolling / weekly / monthly windows), auto-refreshed every 5 minutes by default.

## 卡片效果

卡片渲染在 `conversation.composer.dock` 插槽(输入框下方、内置统计行同款位置):

```
┌─ OpenCode Go ─────────────────────────────────────────────────────┐
│ 5小时 ▓▓▓░░░░░░░ 1% · 2时   本周 ▓▓▓▓▓▓▓░░░ 26% · 2天   本月 ▓▓▓▓▓▓▓▓░░ 33% · 6天   12:34  [刷新] │
└───────────────────────────────────────────────────────────────────┘
```

- 进度条按用量百分比填充;≥60% 变黄,**≥85% 变红**
- 每个窗口右侧显示重置倒计时(如 `2时` / `2天`)
- 右上角为最近更新时间与「刷新」按钮

## 数据来源

调用 OpenCode Go 官方用量接口(未写入公开文档,Anthropic 兼容密钥认证):

```
GET https://opencode.ai/zen/go/v1/usage
Authorization: Bearer sk-opencode-…
```

响应示例:

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 1,  "resetsAt": "2026-08-15T10:54:57.430Z" },
    "weekly":  { "status": "ok", "percent": 26, "resetsAt": "2026-08-17T00:00:00.430Z" },
    "monthly": { "status": "ok", "percent": 33, "resetsAt": "2026-08-22T03:49:10.430Z" }
  }
}
```

## 安装

该插件以 **DSH 动态 Cordis 插件**方式运行(定义于当前会话,无需改配置文件、无需重启):

1. 在 DSH Web GUI 的会话中,让 Agent 用 `cordis_define` 注册插件:
   - `code.host` ← 粘贴 [`src/host.js`](src/host.js) 的内容
   - `code.client` ← 粘贴 [`src/client.js`](src/client.js) 的内容
2. 用 `cordis_run` 激活,并在运行卡片上批准(单勾即可)
3. 打开任意会话,输入框下方即出现额度卡片

> 说明:动态插件代码运行在 DSH Host 进程的受限沙箱中(无 `fetch`/`require`),因此 Host 端通过 `ctx.shell` 执行 `curl` 拉取数据(显式声明 `danger-full-access` 策略,仅访问这一个 URL);若 `curl` 失败会自动改用 `node -e`(Node 内置 fetch)重试。

## 配置

Host 端 `apply(ctx, config)` 接受以下可选项:

| 键 | 默认值 | 说明 |
| --- | --- | --- |
| `baseUrl` | `https://opencode.ai/zen/go/v1/usage` | 用量接口地址 |
| `timeoutMs` | `15000` | 请求超时(毫秒) |
| `refreshMs` | `300000` | 自动刷新间隔(毫秒) |

## API 密钥

- 优先通过 DSH 凭据服务读取 **`OPENCODE_GO_API_KEY`**(对应 `~/.dsh/.credentials.yaml` 或进程环境变量)
- 未配置时卡片显示「未配置 OPENCODE_GO_API_KEY」,不会崩溃
- 密钥只在 Host 进程内使用,**不会**出现在浏览器页面或本仓库中

## 错误处理

| 错误码 | 卡片文案 | 触发条件 |
| --- | --- | --- |
| `no-key` | 未配置 OPENCODE_GO_API_KEY | 凭据服务未解析到密钥 |
| `unauthorized` | 密钥无效 (401) | 接口返回 401/403 |
| `network` | 网络请求失败 | curl 与 node 均失败(附退出码与 stderr 详情) |
| `timeout` | 请求超时 | 超过 `timeoutMs` |
| `denied` | 执行被沙箱拒绝 | shell 执行被沙箱拦截 |
| `bad-json` / `bad-response` | 响应解析失败 / 接口无响应 | 响应异常 |

## License

[MIT](LICENSE)
