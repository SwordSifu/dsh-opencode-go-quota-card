# dsh-opencode-go-quota-card

DeepSeek Harness (DSH) Web GUI 插件:在**会话输入框下方**显示一张 **OpenCode Go 套餐额度卡片**,展示 5 小时滚动 / 周 / 月三个窗口的用量,并**定期自动刷新**(默认每 5 分钟),支持手动刷新。

> A DSH web plugin: a quota card for your OpenCode Go subscription (5h rolling / weekly / monthly windows), auto-refreshed every 5 minutes by default.

---

## TL;DR(给人类)

1. 把本仓库的 `index.js`、`client.js`、`typert.host.js`、`package.json` 放进 `~/.dsh/profiles/web/node_modules/dsh-opencode-go-quota-card/`
2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加注册行(见下方 [注册行](#step-2--注册插件行))
3. 重启 DSH Desktop(或 `dsh web`)
4. 打开任意会话,输入框下方出现额度卡片

---

## Agent 安装手册(给 AI 代理的逐步指令)

> 本手册写给自动化代理:按顺序执行,每步完成后先验证再继续。任何一步失败,先看文末[故障排查](#故障排查),不要跳过验证。

### 前置条件检查

1. DSH 已安装且使用过 web profile:`$DSH_HOME`(默认 `~/.dsh`)下存在 `profiles/web/` 目录。
   - Windows PowerShell:`Test-Path "$env:USERPROFILE\.dsh\profiles\web"` → 应为 `True`
   - macOS/Linux:`test -d "$HOME/.dsh/profiles/web" && echo yes` → 应为 `yes`
2. 目标文件 `~/.dsh/profiles/web/cordis.patch.yml` 存在且是合法 YAML 数组。
3. (可选但建议)用户已配置 OpenCode Go 密钥 `OPENCODE_GO_API_KEY`(位于 `~/.dsh/.credentials.yaml`);未配置时插件仍能运行,只是卡片显示"未配置 OPENCODE_GO_API_KEY"。

### Step 1 — 安装包文件

**方法 A(推荐,可控):手动复制**

把本仓库根目录的 4 个文件复制到 profile 的 node_modules 下:

```powershell
# Windows (PowerShell)
$src  = "<本仓库路径>"
$dest = "$env:USERPROFILE\.dsh\profiles\web\node_modules\dsh-opencode-go-quota-card"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item "$src\index.js", "$src\client.js", "$src\typert.host.js", "$src\package.json" -Destination $dest
```

```bash
# macOS / Linux
SRC="<本仓库路径>"
DEST="$HOME/.dsh/profiles/web/node_modules/dsh-opencode-go-quota-card"
mkdir -p "$DEST"
cp "$SRC/index.js" "$SRC/client.js" "$SRC/typert.host.js" "$SRC/package.json" "$DEST/"
```

**验证**:以下命令在 `profiles/web` 目录执行,应输出 `LOADED function`(Windows 用 DSH 自带的 node,如 `D:\...\resources\node\node.exe`):

```bash
node -e "import('dsh-opencode-go-quota-card').then(m => console.log('LOADED', typeof m.default)).catch(e => { console.error('IMPORT FAIL', e.message); process.exit(1) })"
```

- 输出 `LOADED function` → 继续
- 输出 `ERR_MODULE_NOT_FOUND` → 包没复制到位或路径错误,检查 Step 1
- 其他报错 → 见[故障排查](#故障排查)

**方法 B(替代):通过 dsh CLI**

```bash
dsh plugin --profile web add github:SwordSifu/dsh-opencode-go-quota-card
```

前置条件:`pnpm` 在 PATH 中。git 源安装若被 pnpm 的 allowBuilds 拦截,把 pnpm 提示的 key 加入 `profiles/web/pnpm-workspace.yaml` 的 `allowBuilds` 后重试。CLI 只负责安装包与同步 `dsh.profile.bundles`,**仍需**执行 Step 2 的注册行。

### Step 2 — 注册插件行

在 `~/.dsh/profiles/web/cordis.patch.yml` **末尾追加**(不要改动已有内容;该文件是顶层 YAML 数组):

```yaml
- insert:
    - id: opencode-go-quota-card
      name: dsh-opencode-go-quota-card
```

**验证**:用 YAML 解析器确认文件仍可解析,且最后一个顶层条目为上述 insert。例如:

```bash
node -e "const fs=require('fs'); import('yaml').then(y => { const doc = y.parse(fs.readFileSync(process.env.DSH_HOME + '/profiles/web/cordis.patch.yml', 'utf8')); console.log('YAML OK, entries:', doc.length); })"
```

(`$DSH_HOME` 默认 `~/.dsh`;若 `yaml` 包不可用,可用任意 YAML 工具。)

### Step 3 — 重启

完全退出并重新启动 DSH(Desktop 应用或 `dsh web` 进程)。**刷新页面不够**——client bundle 图在启动时构建,必须重启进程。

### Step 4 — 验证安装成功

重启后:

1. **GUI 验证**:打开任意会话,输入框下方(`conversation.composer.dock` 区域)出现 `OpenCode Go` 卡片,显示 5小时/本周/本月 三个进度条与百分比。
2. **Host 验证**:在 DSH 会话中询问 agent 执行 `cordis_inspect_query`(client Slots provider,`listSubTree` root=`conversation.composer.dock`),应能看到 `og-quota` 条目(registrant 为该插件包)。
3. **数据验证**:卡片显示真实百分比且每 5 分钟自动更新;点「刷新」按钮立即更新。
4. 卡片显示错误文案 → 对照[错误处理](#错误处理)表。

---

## 卡片效果

```
┌─ OpenCode Go ─────────────────────────────────────────────────────┐
│ 5小时 ▓▓▓░░░░░░░ 1% · 2时   本周 ▓▓▓▓▓▓▓░░░ 26% · 2天   本月 ▓▓▓▓▓▓▓▓░░ 33% · 6天   12:34  [刷新] │
└───────────────────────────────────────────────────────────────────┘
```

- 进度条按用量百分比填充;≥60% 变黄,**≥85% 变红**
- 每个窗口右侧显示重置倒计时;右上角为更新时间与「刷新」按钮

## 工作原理(便于排查)

| 文件 | 角色 |
| --- | --- |
| `index.js` | Host 端:注册 `opencodeQuota` Typert Remote 服务,用 Node 原生 `fetch` 拉取额度,缓存快照,`setInterval` 每 `refreshMs` 刷新 |
| `client.js` | Client 端:浏览器模块(`window.__ModuleLoader__.load` 格式),挂载 Remote,在 `conversation.composer.dock` 注册卡片,挂载后立即取数并每 5 分钟轮询 |
| `typert.host.js` | RPC 路由清单:声明 `opencodeQuota/usage`(取快照)与 `opencodeQuota/refresh`(强制刷新),结果走严格模式校验 |
| `package.json` | 声明 `dsh.client`(web 平台)与 `exports["./client"]`、`exports["./typert"]`,client bundle 由宿主按内容哈希直接服务,无需编译 |

数据链路:`client.js` →(api-gateway RPC)→ `index.js` →(fetch)→ `https://opencode.ai/zen/go/v1/usage`。

## 配置

在注册行的 `config:` 中覆盖(Host 端 zod `Config`):

| 键 | 默认值 | 说明 |
| --- | --- | --- |
| `baseUrl` | `https://opencode.ai/zen/go/v1/usage` | 用量接口地址 |
| `timeoutMs` | `15000` | 请求超时(毫秒) |
| `refreshMs` | `300000` | 自动刷新间隔(毫秒) |

```yaml
- insert:
    - id: opencode-go-quota-card
      name: dsh-opencode-go-quota-card
      config:
        refreshMs: 600000
```

## API 密钥

- 优先通过 DSH 凭据服务读取 **`OPENCODE_GO_API_KEY`**(`~/.dsh/.credentials.yaml` 或进程环境变量)
- 未配置时卡片显示「未配置 OPENCODE_GO_API_KEY」,不崩溃
- 密钥只在 Host 进程内使用,不进入浏览器页面或本仓库

## 错误处理

| 错误码 | 卡片文案 | 触发条件 |
| --- | --- | --- |
| `no-key` | 未配置 OPENCODE_GO_API_KEY | 凭据服务未解析到密钥 |
| `unauthorized` | 密钥无效 (401) | 接口返回 401/403 |
| `network` | 网络请求失败 | fetch 异常(附错误详情) |
| `http-*` | 接口返回异常 | 非 2xx 状态码 |
| `bad-json` | 响应解析失败 | 响应不是合法 JSON |
| `exception` | 内部错误 | 未预期异常(附详情) |

## 故障排查

| 现象 | 原因 | 修复 |
| --- | --- | --- |
| `import()` 报 `ERR_MODULE_NOT_FOUND` | 包未复制到 `profiles/web/node_modules/` 或文件名不对 | 重做 Step 1,确认 4 个文件都在目标目录 |
| 重启后卡片不出现 | ① 注册行缺失/拼写错误 ② 未真正重启 ③ client bundle 未加载 | 检查 cordis.patch.yml;完全退出再启动;在会话中用 `cordis_inspect_query` 查 `conversation.composer.dock` 是否有 `og-quota` 条目 |
| `cordis.patch.yml` 解析失败 | 追加时破坏了 YAML 结构 | 用 YAML 校验器检查;确保新增块是顶层数组项 |
| 卡片显示"未配置 OPENCODE_GO_API_KEY" | 凭据缺失 | 在 `~/.dsh/.credentials.yaml` 配置 `OPENCODE_GO_API_KEY`,或通过 GUI 的设置 → 模型页写入 |
| 卡片显示"密钥无效" | 密钥过期/错误 | 更换密钥 |
| 卸载后仍有残留 | 包文件或注册行未删净 | 见[卸载](#卸载) |

## 卸载

1. 删除 `cordis.patch.yml` 中的注册行(两行)
2. 删除 `profiles/web/node_modules/dsh-opencode-go-quota-card/` 目录
3. 重启 DSH

## 以动态插件方式运行(临时)

`src/host.js` 与 `src/client.js` 是**动态 Cordis 插件**版本(仅当前进程有效,重启消失,适合快速试用):在 DSH 会话中用 `cordis_define` 注册(`code.host` 粘贴 `src/host.js`、`code.client` 粘贴 `src/client.js`),再用 `cordis_run` 激活并在运行卡片上批准。

## License

[MIT](LICENSE)
