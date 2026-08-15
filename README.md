# dsh-opencode-go-quota-card

DeepSeek Harness (DSH) Web GUI 插件:在**会话输入框下方**显示一张 **OpenCode Go 套餐额度卡片**,展示 5 小时滚动 / 周 / 月三个窗口的用量,并**定期自动刷新**(默认每 5 分钟),支持手动刷新。

> A DSH web plugin: a quota card for your OpenCode Go subscription (5h rolling / weekly / monthly windows), auto-refreshed every 5 minutes by default.

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

## 安装(常驻,推荐)

该插件是 **DSH web profile 文件式插件**:安装后随 DSH 启动加载,**重启不丢失**。

1. 把本包安装进 web profile:

   ```sh
   dsh plugin --profile web add github:SwordSifu/dsh-opencode-go-quota-card
   ```

   或手动复制:将本仓库(`index.js`、`client.js`、`typert.host.js`、`package.json`)放入
   `$DSH_HOME/profiles/web/node_modules/dsh-opencode-go-quota-card/`。

2. 在 `$DSH_HOME/profiles/web/cordis.patch.yml` 追加注册行:

   ```yaml
   - insert:
       - id: opencode-go-quota-card
         name: dsh-opencode-go-quota-card
   ```

3. 重启 `dsh web`(或 DSH Desktop),打开任意会话,输入框下方即出现额度卡片。

## 以动态插件方式运行(临时)

`src/host.js` 与 `src/client.js` 是**动态 Cordis 插件**版本(仅当前进程有效,重启消失,
适合快速试用):在会话中用 `cordis_define` 注册,`code.host` 粘贴 `src/host.js`、
`code.client` 粘贴 `src/client.js`,再用 `cordis_run` 激活并在运行卡片上批准。

## 配置

Host 端 `OpencodeQuotaGateway` 的 `Config`(zod 模式,可在 patch 行的 `config:` 中覆盖):

| 键 | 默认值 | 说明 |
| --- | --- | --- |
| `baseUrl` | `https://opencode.ai/zen/go/v1/usage` | 用量接口地址 |
| `timeoutMs` | `15000` | 请求超时(毫秒) |
| `refreshMs` | `300000` | 自动刷新间隔(毫秒) |

例如:

```yaml
- insert:
    - id: opencode-go-quota-card
      name: dsh-opencode-go-quota-card
      config:
        refreshMs: 600000
```

## API 密钥

- 优先通过 DSH 凭据服务读取 **`OPENCODE_GO_API_KEY`**(对应 `~/.dsh/.credentials.yaml` 或进程环境变量)
- 未配置时卡片显示「未配置 OPENCODE_GO_API_KEY」,不会崩溃
- 密钥只在 Host 进程内使用,**不会**出现在浏览器页面或本仓库中

## 错误处理

| 错误码 | 卡片文案 | 触发条件 |
| --- | --- | --- |
| `no-key` | 未配置 OPENCODE_GO_API_KEY | 凭据服务未解析到密钥 |
| `unauthorized` | 密钥无效 (401) | 接口返回 401/403 |
| `network` | 网络请求失败 | fetch 异常(附错误详情) |
| `http-*` | 接口返回异常 | 非 2xx 状态码 |
| `bad-json` | 响应解析失败 | 响应不是合法 JSON |
| `exception` | 内部错误 | 未预期异常(附详情) |

## License

[MIT](LICENSE)
