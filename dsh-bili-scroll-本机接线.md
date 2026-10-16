# dsh-bili-scroll（刷B站）本机接线记录

日期：2026-10-16 ｜ 机器：LENOVO 21LF / QIAN\qianz（无管理员）｜ DSH 0.2.0-rc.2 / profile `desktop`

## 一、装的是什么、装在哪

| 项目 | 位置 / 值 |
|---|---|
| 插件包 | `C:\Users\qianz\.dsh\profiles\desktop\node_modules\dsh-bili-scroll`（**0.1.5**） |
| profile 依赖 | `package.json` → `"dsh-bili-scroll": "0.1.5"`，并列入 `dsh.profile.bundles` |
| 插件家目录 | `C:\Users\qianz\.dsh\bili-duty\` |
| Python venv | `C:\Users\qianz\.dsh\bili-duty\.venv`（Python **3.12.14**，52 个包，含 `bilibili-api-python` / `mcp` / `aiohttp` / `brotli` / `qrcode` / `PIL`） |
| uv | `C:\Users\qianz\.dsh\bili-duty\uv.exe`（0.13.1，32,095,024 B） |
| 设置页接口 | `http://127.0.0.1:19387/api/bili-duty/{status,config,install,login,run,report,open,verify,upgrade,update,check}` |

## 二、为什么装得这么费劲（三个真实卡点）

### 1. 桌面端只认 npm 上的**精确版本**，而且按**包名**查重
- 桌面 profile 由 Electron 应用自己的插件管理器独占，`dsh plugin --profile desktop` 只在「Desktop 完全退出、且由它的 carrier 调用」时才被接受 ⇒ **只能在「设置 → 插件」里装**。
- 只接受 `name@x.y.z` 形式的 npm 包；`github:owner/repo` 与本地 `link:` 路径一律被拒。
- **装过 0.1.1 之后再填 `dsh-bili-scroll@0.1.5`，会被红字拒绝**：「该插件已安装。如需升级，请卸载后重新安装」——它按包名查重，**不看版本号**。升级路径＝先卸载，再装精确版本，再重启 DSH。

### 2. `pnpm-workspace.yaml` 的同名规则重复 → 所有插件都装不动
- 宿主 pnpm 是 **11.7.0**（`C:\Users\qianz\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm`），策略 `minimumReleaseAge: 1440`（24 小时）。
- 报错原文：`[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 1 lockfile entries failed verification: dshmarket@1.66.28 was published at … within the minimumReleaseAge cutoff`。
- 根因：`C:\Users\qianz\.dsh\profiles\desktop\pnpm-workspace.yaml` 里 **`dshmarket` 被写成两行**（`- dshmarket@1.66.22 || 1.66.27` 与 `- dshmarket@1.66.28`），而 **pnpm 每个包名只认第一条规则** ⇒ 第二条永久失效；且只要 lockfile 里有这样一条，**之后每一次 add/remove 都会失败**。
- 修法（已执行，回滚备份 `C:\Users\qianz\boot-tune-backup\pnpm-workspace.desktop-20261016-1905.yaml`）：合并为一行 `- dshmarket@1.66.22 || 1.66.27 || 1.66.28`，并加 `- dsh-bili-scroll@0.1.4 || 0.1.5`（现位于 `pnpm-workspace.yaml:12` 与 `:13`）。

### 3. 唯一系统 Python 3.15 装不了这套依赖
- `C:\Users\qianz\AppData\Local\Programs\Python\Python315\python.exe` 是唯一在 PATH 上的 `python`，但 `brotli` / `pyyaml` **没有 cp315 的 win_amd64 wheel**，本机又**没装 Visual C++ Build Tools**（`cl.exe`/`link.exe` 不在 PATH、`vswhere` 不存在）⇒ `Failed building wheel for brotli` → `error: Microsoft Visual C++ 14.0 or greater is required`。
- 解法：用 **DSH 自带的 Python 3.12.14** 建 venv —— `C:\Users\qianz\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`（有 venv/ensurepip/pip，3.12 的 wheel 齐全）。
- **插件自带的「装主依赖」按钮会用 PATH 上的 `python`（＝3.15）建 venv，所以别点它**（除非要重建）。

## 三、本机做的两处补丁（都可回滚）

### 补丁 1：插件 index.js 加 venv 兜底
文件：`C:\Users\qianz\.dsh\profiles\desktop\node_modules\dsh-bili-scroll\index.js`，原备份 `index.js.dbg-bak`。
插在 `const cfg = normalize(readJson(cfgFile, {}), normalize(config, { ...DEFAULTS }))` 之后：

```js
  {
    const venvPyFallback = process.platform === 'win32'
      ? join(stateDir, '.venv', 'Scripts', 'python.exe')
      : join(stateDir, '.venv', 'bin', 'python')
    if (existsSync(venvPyFallback) && String(cfg.pythonPath || '') === 'python') cfg.pythonPath = venvPyFallback
  }
```

**为什么必须打这个补丁（本机实测结论）**：
- 插件的 `apply(ctx, config)` 收到的 `config` 是**已经被宿主用 schema 默认值填满的对象**（含 `pythonPath: 'python'`），而插件的 `normalize(config, DEFAULTS)` 把它当 base ⇒ 插件自己的 `config.json` 只能作为**兜底层**：`normalize(readJson(cfgFile,{}), <宿主材料化的默认值>)` —— 宿主的 'python' 永远赢。
- `@deepseek-ai/dsh-settings` 的 README 原文印证：**「此服务投影 Loader 配置，不维护独立的权威值」** ⇒ 表单值来自 loader 配置层，不是 `config.json`。
- 实测证据：把 `config.json` 的 `perDay` 改成 9、重启宿主后 `/api/bili-duty/status` 仍返回 `perDay:5`、`pythonPath:"python"`。
- 后果（未打补丁时）：`renderQrPng(cfg.pythonPath…)` 用 3.15 跑 `python -c "import qrcode; …"` ⇒ 3.15 **没有 qrcode** ⇒ duty.log 逐字 `出码：https://…（没画出 PNG —— venv 里大概还没有 qrcode）`；内置 MCP 也用 3.15 起 ⇒ `No module named bilibili_api`。

### 补丁 2：uv.exe 直接放进插件家目录
`ensureUv({ dir })` 会**先看 `dir/uv.exe` 在不在，在就直接用**（`uvfetch.mjs:83`）⇒ 不用等它自己下。它自己的下载器在本机全挂：`正在下载 uv —— GitHub 直连 → GitHub 直连 失败：fetch failed正在下载 uv —— GitHub 加速代理 gh-proxy.com`（插件的 `fetch` 不吃系统代理，GhProxy 也超时），而 stale 的 `.installing=true` 又让每次 `/install` 请求直接返回，形成死锁。
本机拿 uv 的正确姿势（走 dev-sidecar 代理 + 校 sha256，实测通过）：

```powershell
$u='https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip'
curl.exe -sSL --ssl-no-revoke --proxy http://127.0.0.1:31181 -o uv.zip $u
(Get-FileHash uv.zip -Algorithm SHA256).Hash.ToLower()   # 与 $u.sha256 比对
tar.exe -xf uv.zip -C <临时目录>                          # 只要 uv.exe
Copy-Item <临时目录>\uv.exe C:\Users\qianz\.dsh\bili-duty\uv.exe -Force
```

## 四、冷知识：`cordis.patch.yml` 的改动**不会**热重载这个插件
- 插件自己的注释说 profile 那一层 `cordis.patch.yml` 是热重载层；但本机实测：改它的 mtime、甚至给文件追加一行注释，插件的 `apply()` 都不会重跑（duty.log 无新增行，宿主进程启动时间不变）。
- 所以**改插件代码/挂载配置后必须完整重启 DSH**。
- 另：`config.json` 的写入时刻可以当作「插件真的跑过 apply」的证据（第一次 apply 必然写它）。

## 五、术语与「怎么算成功」
- 设置页显示「环境未装 / B站未登录」是插件自己的判据；`/api/bili-duty/status` 里 `venvReady` 表示 `.venv` 存在**且** `site-packages` 里有 `bilibili_api*`。
- 二维码：插件**先**从 `passport.bilibili.com/x/passport-login/web/qrcode/generate` 直接 HTTP 拿 URL + `qrcode_key`，**再**调 Python 画 PNG（这一步失败只影响图和后续 MCP，登录本身靠 HTTP 轮询）。
- 登录凭证落在插件家目录（Python 那边是 `Path(__file__).parent / "bili_credential.json"`，所以运行前脚本要从插件包拷到家目录）。
- 跑一轮 = 起一个 `dsh --profile headless <prompt>`，把 `duty.md` 交给它，报告写进 `bili-duty\out\<日期>.md`。

## 六、安全边界（上游 README 的红线，别替用户开）
- 每轮最多一条评论；同一视频只评一次；不透露隐私；不确定不编。
- 「**自动评论并 @ 你**」默认关，**AI 助手不要替用户打开**；「本地转写没字幕的视频」要下整套模型，也默认关。
