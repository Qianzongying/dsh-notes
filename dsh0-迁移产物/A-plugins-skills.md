# A — 插件 / 技能 / 环境 / 工具链 / 配置 归档

> 来源：`D:\蓝鲸deepseek工作区\_migrate\extract\session-22f22a78-fec7-40e9-9635-7a1b6be3b38b.txt`（12200 行）与 `session-11685a2a-587f-4dc7-a8a7-9cfd1bf1188a.txt`（5422 行）。
> 排除项：瓦罗兰特（Valorant）英语交流 PPT、英语外教课程、医学题目/临床统计业务数据等，均属业务内容，本文不收录；仅当它们暴露了环境/工具链事实时才保留该事实。
> 未确认处均显式标注「未确认」。所有路径、版本号、命令、报错原文按原样抄录。

---

## 0. 环境基线（先记住这一节）

| 项 | 值 |
|---|---|
| DSH_HOME | `C:\Users\qianz\.dsh` |
| DSH_PROFILE | `desktop` |
| DSH_PROFILE_DIR | `C:\Users\qianz\.dsh\profiles\desktop` |
| DSH_WEB_URL | `http://127.0.0.1:19387` |
| DSH_SHELL | `1` |
| 宿主 | `D:\Deepseek\DeepSeek Harness.exe`（244481512 B），资源在 `D:\Deepseek\resources` |
| app.asar | `D:\Deepseek\resources\app.asar`，121348951 B（**单文件，不是目录**） |
| DSH 宿主版本 | `@deepseek-ai/dsh-desktop 0.2.0-rc.2`；dsh host `0.2.0-rc.2` |
| dsh-market 版本 | 1.66.21（后又出现 1.66.22） |
| node（宿主内） | v24.18.1；系统 node 后来为 v24.20.0 / v24.21.0；`C:\Program Files\nodejs\node.exe` |
| pnpm | 11.7.0（`D:\Deepseek\resources\runtime\pnpm\bin\pnpm.cjs` 与 `C:\Users\qianz\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs` 都是 11.7.0） |
| profile storeDir | `C:\Users\qianz\AppData\Local\pnpm\store\v11`（20354 files） |
| nodeLinker | `hoisted` |
| profile node_modules 规模 | **42,766 个文件 / 约 470 MB**；冷 stat 一遍约 13.5 秒 |
| 日志目录 | `C:\Users\qianz\AppData\Roaming\@deepseek-ai\dsh-desktop\logs\` |
| DSH 首页目录 | `.agent-presets` `attachments` `cache` `code-server` `dog` `dsh-im-connect` `dsh-market` `dsh-runtimes` `llm-deepseek` `logs` `profiles` `sessions` `speech-to-text` `storages` `skills` `skills-manager`（另有 `.anonymous-user-id`、`.credentials.yaml`） |

**关键结论：desktop profile 不能用 dsh CLI 管理。**
`dsh --profile desktop --dump-config` 直接报：

```
error: profile "desktop" is managed exclusively by the Electron application
```
（附带的 PowerShell 报错原文）
```
dsh.cmd : error: profile "desktop" is managed exclusively by the Electron application
所在位置 行:12 字符: 1
+ & "D:\Deepseek\resources\runtime\cli\bin\dsh.cmd" --profile desktop - ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (error: profile ...ron application:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
[exit code: 1]
```
→ 所以 `dsh plugin --profile desktop add ...` 这条路对 desktop 封死；只能走 App 界面，或直接改 profile 目录里的 `package.json` + 手动跑 pnpm。`dsh plugin --profile <name> ...` 对 web / headless / tui 等非 desktop profile 仍然可用。

`dsh.cmd` 的真实内容（5 行）：
```
@echo off
setlocal DisableDelayedExpansion
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\..\..\DeepSeek Harness.exe" --expose-internals "%~dp0..\..\..\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js" %*
exit /b %errorlevel%
```

---

## 1. 插件（DSH plugin）清单

### 1.1 profile 的注册结构（三个文件共同决定「装了什么 / 生效什么」）

- `C:\Users\qianz\.dsh\profiles\desktop\package.json` — `dependencies` 是「装了哪些包」，`dsh.profile.bundles` 是「哪些会被挂载」。
- `C:\Users\qianz\.dsh\profiles\desktop\cordis.patch.yml` — 用户的补丁层，按 id 定向覆盖 / 禁用 / insert。**只有在 bundles 里 + 没有 `disabled: true`，插件才真正生效。**
- `C:\Users\qianz\.dsh\profiles\desktop\cordis.yml` — 空入口列表：
  > `# dsh profile root — an empty entry list. The tree is composed as patches:` / `# each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any` / `# --patch overlays. Edit cordis.patch.yml, not this file.` / `[]`
- `C:\Users\qianz\.dsh\profiles\desktop\pnpm-workspace.yaml` — `packages: [.]`、`nodeLinker: hoisted`、`autoInstallPeers: false`、`minimumReleaseAgeExclude:`（长白名单）、`allowBuilds:`。

**教训（血泪）：`node_modules` 里有 ≠ 生效。** @vectorize-io/hindsight-coding-agents 就躺在 `node_modules` 里但既不在 bundles、还被 `disabled: true` 显式关掉。

**教训 2：装完必须重启 DSH。** 见第 6 节 `office-tools` / `dsh-pdf` / `paper-reader` / `code-server-app` 一组——装完当下工具**没有**进工作集，工具集只有重启后才从 95 涨到 113。

### 1.2 插件全表（按最后一次实测的 dependencies 清单）

> 下面「版本」以文件尾部的最终实测为准（`session-...b38b.txt` 第 11593 行起）；带 ★ 的是被明确判为「需处理/已禁用」。

| 包名 | 版本 | 作用（用户视角） | 状态 |
|---|---|---|---|
| `@ggboy123/dsh-paper-reader` | 1.4.1 | 论文伴读：`search_paper` `transcribe_pdf` `study_progress` `study_update` `list_papers` | 已装；装时工具未生效，需重启 |
| `@linxin666/dsh-client-ui-skill-explorer` | 0.4.6 | 「技能中心」：按来源浏览、启用/停用（改 SKILL.md 的 `disable-model-invocation`）、新建技能、删除进回收站 | ★ 已禁用（`ui-skill-explorer: disabled: true`） |
| `@linxin666/dsh-remote-web-ui` | 0.4.6 | 手机扫码配对进同一个 Web GUI；一次性 token + 可撤销设备会话 | 生效 |
| `@liustack/modlens` | 3.26.6 | 给纯文本模型外挂视觉，注册 `modlens_read_image`；引擎 `antigravity-cli`(默认)/`gemini-api`/`openai`/`anthropic`/`claude-cli` | ★ 已禁用（默认引擎未安装 + 无配置文件） |
| `@liustack/modsearch` | 5.10.6 | 自带 `web_search` / `x_search` / `read_page`，引擎 Firecrawl/Tavily/Exa/Grok | ★ 已禁用（与 free-search 抢同一插槽） |
| `@michengai/dsh-agency-agents` | 1.0.19 | 331 个可召唤专家：`summon_expert` `list_experts` `summon_expert_team` 等 | ★ 已禁用（用户决定，保留安装） |
| `@michengai/dsh-archive-manager` | 1.0.19 | 会话归档/恢复/收藏/删除 + 会话日志损坏诊断（`dsham_*`） | 生效 |
| `@michengai/dsh-codex-ui` | 1.1.37 → 1.1.40 | 左侧导航改造：Codex 风格侧栏、工作区会话树、全局搜索、轮次导航、未读提醒 | 生效 |
| `@michengai/dsh-im-connect` | 0.1.76 → 0.1.77 | 微信/飞书等 IM 接入本机 DSH（有安全提示：外部消息可触发 agent） | 曾处于「半装状态」，后进 dependencies |
| `@michengai/dsh-skills-manager` | 1.1.19 → 1.1.21 → 1.1.22 | 技能管家：统一管理本机/项目技能、从 GitHub 安装、导入 ZIP/文件夹、备份回退、回收站；内置 **ClawHub + skills.sh** 双源目录 | 生效（首次安装曾失败，见 6.1） |
| `@tt-a1i/archify-dsh` | 1.0.0 | `archify` 技能包：架构/流程/时序图，可导出 PNG/SVG/HTML | 生效（零 token 成本） |
| `@vectorize-io/hindsight-coding-agents` | 0.8.1 | Hindsight 官方适配包：把 Hindsight 长期记忆接到 40 个编程 CLI；注册 `hindsight_memory` `hindsight_reflect` `hindsight_knowledge` `hindsight_ingest_document` `hindsight_diagnose` `hindsight_search_knowledge_pages` `hindsight_read_knowledge_page` `hindsight_list_knowledge_pages` `hindsight_knowledge_refresh` `hindsight_capture_initiative` 等约 10 个工具 | ★ 已禁用，且**不在 bundles**；配置在 `~/.hindsight/coding-agent.json`（该文件不存在） |
| `@wxg-prc-cpg/browser-skill-dsh-plugin` | 0.3.2 → **0.3.3** | 腾讯 BrowserSkill：通过注入的 `bsk_*` / `browser_*` 工具操作用户已登录的 Chromium | 生效（已配置 `bskPath`） |
| `@zhtx2026/dsh-pdf` | 0.1.1 | PDF 三工具：`pdf_info` `pdf_extract_text` `pdf_render_page`；pdfjs + 自研系统字体渲染双引擎 | 已装 + 已进 bundles；需重启才生效 |
| `billion-context` | 0.1.197 | 上下文压缩引擎（`compress`/`decompress`/`search_context`/`acp_*`） | 生效（**必须留**） |
| `deep-read-summarize` | （版本未记录） | 书籍/论文/视频/网页深读总结 | 生效（零 token 成本） |
| `dsh-better-sidebar` | 0.26.0 | 右侧栏工作台：文件树、编辑器、改动、任务、侧边对话；对外提供 `ctx.betterSidebar` | 生效 |
| `dsh-code-server-app` | 0.3.72 | 内置 VS Code Server（常驻 `127.0.0.1:8090`） | 已装；建议按需禁用省一个进程 |
| `dsh-context` | 0.70.0 → 0.71.0 | 上下文洞察面板：组成、事件/消息列表、7 天用量图、热力图、Fleet 视图；命令 `/context` | 生效（零 token 成本） |
| `dsh-cost-meter` | 1.8.26 | 会话费用/预算/官方余额/Coding Plan 额度/历史记录；峰谷计价提醒 | 生效（账本 `C:\Users\qianz\.dsh\storages\cost-meter\ledger.json`） |
| `dsh-free-search` | 0.8.10 | 联网搜索，注册进 `ctx.web` 搜索接缝，24 引擎（含知乎全网+站内）；命令 `/free-search-engine` | 生效（**当前唯一生效的搜索 provider**） |
| `dsh-image-gen` | 0.9.1 | 生图（6 个工具，约 1,200 tokens 常驻） | 生效；判为「半留」 |
| `dsh-mnemon` | 0.5.29 | 可组合记忆框架：运行时记忆（USER.md / MEMORY.md 每回合注入）+ 项目档案 + 记忆空间（9 个 Provider） | 生效（17 个工具，约 3,400 tokens） |
| `dsh-office-tools` | 1.0.6 | `word_create/read/update`、`excel_create/read/update`、`ppt_create/read` 共 8 个工具 | 已装；与 office-* 技能重复 |
| `dsh-plugin-wallpaper-engine` | 1.3.3 | 壁纸 | ★ 已禁用（agent 承认「用户没让我动它」） |
| `dsh-smart-charts` | 8.4.1 | 32 种 ECharts 图表（纯技能，0 token） | 生效（首次安装失败，见 6.4） |
| `dsh-univer-office` | 0.3.7 | Univer 办公套件内联预览 + 悬浮 Worktree；14 个工具、242 文件/220 MB | 生效（判为重复，约 3,000 tokens） |
| `dsh-vision-router` | 3.0.3 | 给纯文本模型装眼睛；14 个深看工具；开关「👁 识图」 | 生效（本会话 `enabled: false`） |
| `dsh-whale-widget` | 0.4.2 | 右下角余额小鲸鱼（纯装饰） | 生效（零 token） |
| `dshmarket` | ^1.66.21（1.66.22） | 可视化插件市场（用户主力入口） | 生效 |
| `lunheng-article-pipeline` | 19.6.0 | 论衡：9 角色多 Agent 深度长文流水线；叠加 4 行（包入口 + `tool-subagent-retrieval/-strong/-audit`） | ★ 已禁用（peer 范围不含宿主） |
| `openwrite` 系列 | 0.2.21 | 写小说：**90 个 `novel_*` 工具 ≈ 18,000 tokens** | ★ 4 行全禁用 |
| `dsh-openwrite` / `dsh-plugin-marketplace` 0.5.3 / `studio-panel` / `openwrite-bridge` / `openwrite-dog` | — | 见 cords 禁用清单 | ★ 已禁用 |

内置、卸不掉的 4 个：`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、`@deepseek-ai/dsh-experimental-auto-review`、`@deepseek-ai/dsh-experimental-voice-input-bundle`。

### 1.3 最终 `cordis.patch.yml` 禁用清单（权威版本，YAML 解析校验通过）

`disabled: true` 共 **15 行**（条目数 23~24，`plugin-marketplace` 有重复 id）：

```
modsearch / modlens / agency-agents / hindsight / ui-skill-explorer /
plugin-marketplace / openwrite-bundle / openwrite-bridge / studio-panel /
openwrite-dog / wallpaper-engine / agency-agents-remote /
lunheng-article-pipeline / tool-subagent-retrieval / tool-subagent-strong / tool-subagent-audit
```

仍在生效的行（8 个核心 id）：`agent-default-model`、`ui-settings-account`、`ui-chat`、`ui-settings`、`plugin-marketplace`、`vision-router`、`browserskill`、`web`。

### 1.4 功能重复 / 冲突的组，以及推荐取舍

| 重复组 | 成员 | 机制 | 取舍 |
|---|---|---|---|
| 联网搜索 | `dsh-free-search` vs `@liustack/modsearch` | **同一个插槽**：两者都调 `ctx.web.registerSearchProvider`（`dsh-free-search\lib\index.js:3767`、`modsearch\dsh\index.js:143`），只有一个生效 | 留 free-search（免 key、引擎多、有知乎）；只有要 X 搜索才反过来 |
| 视觉识图 | `dsh-vision-router` vs `@liustack/modlens` | 都是「给纯文本模型装眼睛」 | 留 vision-router（已配置）；modlens 默认引擎缺失 |
| 插件市场 | `dshmarket` vs `dsh-plugin-marketplace` | 都是逛/装插件 | 留 dshmarket（成熟），marketplace 已禁用 |
| 技能管理 | `@michengai/dsh-skills-manager` vs `@linxin666/dsh-client-ui-skill-explorer` | 都是技能管理 | 留 skills-manager（能装 GitHub 技能、能导别家技能）；explorer 已禁用 |
| 长期记忆 | `dsh-mnemon` vs `@vectorize-io/hindsight-coding-agents` | mnemon 自带 `dsh-mnemon-provider-hindsight@0.5.6`，**同一个 Hindsight 后端两条路** | 以 mnemon 为主；hindsight 单独插件已禁用 |
| Office | `dsh-office-tools`(8 工具) vs `office-docx/pptx/xlsx`(技能) vs `dsh-univer-office`(14 工具) | 重启后两套并存，模型可能随机选 | 留技能（免费） |
| PDF | `@zhtx2026/dsh-pdf`(3) + `@ggboy123/dsh-paper-reader`(5) + `pdf` 技能 | **三条路** | 建议留 `pdf` 技能 + paper-reader |

### 1.5 各插件的真实 token 常驻成本（实测/估算）

- **95 个工具的 JSON Schema ≈ 57,000 字符 ≈ 17,000 tokens ＝ 每次调用的 ~14%**（这是最大单项）。重启装完 4 个新插件后工具数 **95 → 113，每次多背 ~3,000 tokens**。
- 系统提示（含 mnemon 记忆协议、专家团说明、论衡横幅）≈ 20,000 字符 ≈ 6,000 tokens ≈ 5%。
- **26 个 skills 的描述目录只有 ~7,000 字符 ≈ 2,200 tokens ≈ 1.8%** —— 反直觉结论：**技能几乎不费 token，费钱的是带工具的插件**。
- 单体大头：`dsh-openwrite` 90 个 `novel_*` ≈ 18,000；`lunheng` 4 ≈ 1,500；`dsh-mnemon` 17 ≈ 3,400；`dsh-univer-office` 14 ≈ 3,000；`agency-agents` ≈ 2,500。
- **零 token 成本**（纯 UI 面板，不注册工具）：dsh-context、dsh-cost-meter、dsh-whale-widget、wallpaper-engine、remote-web-ui、codex-ui、archive-manager、dshmarket、archify、dsh-smart-charts、deep-read-summarize、better-sidebar。

### 1.6 peer 依赖 / 版本不兼容导致的硬失败

**A. `dsh-skills-manager` 的 peer 声明（装之前核对过，全部命中）**
```
"react": "^18.2.0",
"react-dom": "^18.2.0",
"@deepseek-ai/cordis": ">=4.0.1 <5.0.0",
"@deepseek-ai/dsh-skill": "0.1.2-rc.1 || 0.1.5-rc.1 || 0.1.5-rc.2 || 0.1.5-rc.3 || 0.1.7-rc.1 || 0.1.7-rc.2 || 0.2.0-rc.1 || 0.2.0-rc.2 || 0.2.1-alpha.2",
（同样范围的 dsh-tools / dsh-session / dsh-web-app / dsh-client-locale）
```
宿主实测：`dsh-skill/dsh-tools/dsh-session/dsh-web-app/dsh-client-locale/dsh-host-webserver/dsh-client-ui-slots` 全是 `0.2.0-rc.2`，`cordis 4.0.4` → **兼容通过**。`engines` 要 node `^22.19.0 || >=24.0.0`，宿主 v24.18.1。

**B. `browser-skill-dsh-plugin` 的 DSH 版本支持声明**
> `The plugin declares support for DSH ^0.1.5-rc.3 || ^0.2.0-rc.1.` / `DSH 0.2 checks these peer requirements before loading the plugin; versions outside this range are not declared compatible.`

**C. `lunheng-article-pipeline` — peer 自相矛盾（最高风险）**
要求 `>=0.1.2-rc.1 <0.2.0`，实跑 `0.2.0-rc.2` → **装了、加载了、面板也在，但官方版本范围不包含你**。这是最容易在下次 DSH 更新时炸的东西，因此被禁用。

**D. `dsh-background-by-model` 0.8.2 — 版本不匹配的原始提示**
> `dsh-background-by-model 0.8.2 声明需要 DSH >=0.2.1-alpha.2 ∩ >=0.1.7-rc.2，而你现在运行的是 0.2.0-rc.2。装上去很可能用不了。 已停止，没有安装任何东西。 如果你确定这个版本号不准（例如桌面端自带的 DSH 不报告版本），仍可继续安装。 可以装 0.8.1：它声明兼容当前 DSH。`

**E. `dsh-pdf-edit` 的 peer（市场缓存里抓到的）**：`@deepseek-ai/dsh-tools: 0.1.1-rc.2`。

**F. `dsh-paper-reader` / `dsh-office-tools` / `dsh-pdf` / `dsh-code-server-app` 的工具在装完当下没进工作集** —— 不是 peer 问题，是**没重启**。

### 1.7 插件的安装 / 禁用 / 启用方法（三条真实跑通的路径）

**路径 1 — 市场 GUI（推荐给新手）**
`dshmarket` → 逛/搜 → 安装。风险：宿主的 10 分钟沉默看门狗会误杀已成功的安装（见 6.1）。

**路径 2 — 手动 pnpm 装进 profile（确定性，绕开看门狗）**
```powershell
$node = "D:\Deepseek\resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
$pnpm = "D:\Deepseek\resources\runtime\pnpm\bin\pnpm.cjs"   # 正好是 11.7.0
Set-Location C:\Users\qianz\.dsh\profiles\desktop
& $node $pnpm add "@michengai/dsh-skills-manager@1.1.19"
```
装完再把包名加进 `package.json` 的 `dsh.profile.bundles`，然后**重启应用**。
曾经真正跑通的一条（带 `--reporter=append-only`）：
```powershell
$node = "C:\Users\qianz\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
$pnpmCjs = "D:\Deepseek\resources\runtime\pnpm\bin\pnpm.cjs"
& $node $pnpmCjs add "@wxg-prc-cpg/browser-skill-dsh-plugin@0.3.3" --reporter=append-only
# workdir: C:\Users\qianz\.dsh\profiles\desktop
```
`@zhtx2026/dsh-pdf` 也是这么装的，输出 `+ @zhtx2026/dsh-pdf 0.1.1` / `Done in 8.4s using pnpm v11.7.0` / 退出码 0。

**路径 3 — 直接编辑 `cordis.patch.yml`**
- 禁用：新增一行
  ```yaml
  - id: modsearch
    disabled: true
  ```
- 启用某个已禁用的：**删掉那行 `disabled: true`**（注释里就写着这句）。
- 插入新行必须用 `- insert:` 列表形式（lunheng 的 patch 注释原文）：
  > `- insert: - id: X`：新增一行（不覆盖任何东西；DSH 真正推荐的 patch 模式）
  > 普通行按 id-targeted patch existing row；新增行必须用 `- insert:` 形式
- `name:` 必须是**已发布的包名**（loader 按包名 import）；YAML 中前导 `@` 必须加引号。
- ⚠️ **这个文件会被 GUI 的插件管理器重写**，手写行有被覆盖的风险（实测发生过）。
- ⚠️ **改动必须在 DSH 启动前完成，或改完立刻重启**（见 6.6）。

---

## 2. 技能（skill）清单

### 2.1 技能发现机制（读 `dsh-skill-filesystem` 源码得到）

- 提供者：`@deepseek-ai/dsh-skill-filesystem`，发现 **project / custom / user** 三类根目录，用 chokidar **watch**，所以**新增/改名/删除技能不需要重启**。
- 技能形态：目录包（含 `SKILL.md`）或扁平 `<name>.md`。
- frontmatter 校验（源码行号）：
  - `dsh-skill-filesystem\lib\index.js:672` `skill file ${path} ignored: invalid YAML frontmatter`
  - `:676` `skill file ${path} ignored: missing YAML frontmatter`
  - `:682` `skill file ${path} ignored: frontmatter requires name and description`
  - `:853` `const disableModelInvocation = frontmatterBoolean(data, "disable-model-invocation");`
- 相关内置包：`dsh-skill`、`dsh-skill-badge`、`dsh-skill-filesystem`、`dsh-skill-office`、`dsh-tool-skill`、`dsh-client-ui-skill`、`dsh-agent-instructions`、`dsh-system-prompt`。

**技能目录（实测）**
| 根 | 路径 | 内容 |
|---|---|---|
| 项目技能 | `D:\蓝鲸deepseek工作区\.dsh\skills\` | `academic-pptx-skill`（后也复制到用户目录） |
| 用户技能 | `C:\Users\qianz\.dsh\skills\` | `academic-pptx-skill`、`chinese-copywriting-guidelines`、`skill-creator`、`skill-vetter`、`github`、`video-frames`、`pdf` 等 |
| 内置 office 技能 | `D:\Deepseek\resources\runtime\office-skills\` | `office-docx\SKILL.md`(6132 B)、`office-pptx\SKILL.md`(6884 B)、`office-xlsx\SKILL.md`(9310 B)、`scripts\check_office.py`(13217 B) |
| skills-manager 状态 | `C:\Users\qianz\.dsh\skills-manager\repositories.json`（安装登记表，可备份为 `.bak-*`） | |

### 2.2 技能清单

| 技能名 | 来源 | 用途 | 备注 |
|---|---|---|---|
| `academic-pptx-skill` | GitHub `Gabberflast/academic-pptx-skill`（zip: `https://codeload.github.com/Gabberflast/academic-pptx-skill/zip/refs/heads/main`，206903 B） | 学术演示的内容与结构规范：action title、situation→complication→resolution、ghost deck test、引用规范 | 6 文件 239,669 B：`SKILL.md` 8280 / `slide_patterns.md` 20206 / `content_guidelines.md` 12160 / `README.md` 3612 / `LICENSE` 1068 / `Academic_Presentation_Best_Practices_...pdf` 194343。SKILL.md 内 `name: academic-pptx` |
| `chinese-copywriting-guidelines` | ClawHub `dizhu/chinese-copywriting-guidelines` | 中文排版规范：中英间空格、全角/半角标点、专名大小写 | 2219 字符，零依赖 |
| `skill-creator` | ClawHub `chindden/skill-creator` | 教怎么写一个好技能（结构、何时写脚本、描述如何被正确触发） | 17701 字符，零依赖 |
| `skill-vetter` | ClawHub `spclaudehome/skill-vetter`（**下载 277,191 / 安装 12,247 / 星 1,305**） | 装技能前的安全审查清单：来源、下载量、更新频率、可疑操作 | 3,925 字符单文件。原文档举例用 `curl \| jq`，但本机没有 jq（可用 `gh api --jq` 替代） |
| `github` | ClawHub `steipete/github` | 用 `gh` 处理 issue/PR/CI | 200,772 下载 / 671 星 / **1,113 字符**（极小）。由 agent 手动装到用户目录并登记 |
| `video-frames` | ClawHub `steipete/video-frames` | 用 ffmpeg 抽帧/短片 | 需 ffmpeg（后来已装） |
| `pdf` | 内置/已有 | PDF 全面处理 | 已存在 `C:\Users\qianz\.dsh\skills\pdf` |
| `office-docx` / `office-pptx` / `office-xlsx` | DSH 内置（`D:\Deepseek\resources\runtime\office-skills`） | Word/PPT/Excel 的读写与检查；**只用 bundled LibreOffice** | — |
| `browser-skill` | 随 `@wxg-prc-cpg/browser-skill-dsh-plugin` 打包（`skill/SKILL.md` 4322 B） | 用插件注入的 `browser_*` 工具操作用户已登录的 Chromium | 参考文档 `references/`：debugging 7282 / help-and-recovery 3071 / interaction-details 1125 / screenshots-and-canvas 974 / tabs-and-profiles 1495 |
| `hindsight-coding-agent` | 随 hindsight 插件打包（`skill/SKILL.md` **82037 B**） | 讲 Hindsight 记忆怎么用 | ⚠️ **DSH 只扫自己的技能根目录，不会去读 `node_modules` 插件的 `skills` 字段** → 这个 82KB 技能不在技能目录里，未生效 |
| `deep-read-summarize` | 插件 `deep-read-summarize` | 书/论文/视频/网页深读总结 | 零 token 成本 |
| 内置面板另有 | — | `univer` 系列、`archify`、`smart-charts`、`skill-vetter`、`skill-creator`、`diagnose-windows-sandbox-acl` 等 | 见会话技能目录 |

### 2.3 ClawHub 生态与真实 API（可复现）

- 站点：`https://clawhub.ai`。**第三方社区技能市场，服务于 OpenClaw / Clawdbot 生态，不是 DeepSeek 官方源，没有任何审核。**
- 榜单接口：`https://clawhub.ai/api/v1/skills?limit=100&sort=downloads`（agent 用它拉了下载量前 50 / 前 100）。
- 搜索接口：`https://clawhub.ai/api/v1/search?q=<kw>&limit=25` → 顶层字段只有 `results`；条目字段含 `canonicalUrl, displayName, downloads, featured, icon, id, install, links, metrics, native, official, ownerHandle, publisher, score, slug, source, sourceIdentity, summary, trust, updatedAt, version, owner`。
- **详情接口不存在**：`https://clawhub.ai/api/v1/skills/<owner>/<slug>` 与 `.../<slug>/detail` 全部 **HTTP 404**。
- **下载直链**（skills-manager 内部用的 catalogUrls 形式，agent 实测可用）来自 `clawhub-catalog.js`；直接的 `https://clawhub.ai/api/v1/download?slug=pdf&owner=anthropics` 与 `.../share/pdf?owner=anthropics` 都是 **404**。
- `dsh-skills-manager` 内置**两套目录**：
  - `lib/clawhub-catalog.js`（6700 B）→ ClawHub，服务端路由 `GET /api/dsh-skills-manager/clawhub/list|search`（`index.js:402/410`），`import { listClawHub, searchClawHub } from "./clawhub-catalog.js"`（`index.js:29`）
  - `lib/skills-sh-catalog.js` → skills.sh：`const SEARCH_URL = "https://skills.sh/api/search";`（`MAX_QUERY_LENGTH = 100`、`MAX_RESPONSE_BYTES = 1 << 20`、`MAX_RESULTS = 100`）
  - 下载限额（`lib/catalog-skill.js`）：`MAX_TEXT_BYTES = 1 << 20`、**`MAX_ARCHIVE_BYTES = 8 << 20`（8 MB）**、`MAX_FILES = 100`
- skills.sh 的技能 id 形如 `skills-sh:anthropics/skills/pdf`，canonical `https://www.skills.sh/anthropics/skills/pdf`。`anthropics/pdf` 下载 **206,521**。

### 2.4 安装技能的方式

**GUI（推荐）**：设置 → 技能 → 技能仓库 → 顶部切到 **ClawHub** → 搜索 → 查看详情（= 完整 SKILL.md 预览）→ 安装 → 范围选 **用户目录** → 装完在「全局技能」用开关控制启停。

**命令行/脚本（agent 实测跑通的路径）**：下载 zip → 解压到 `C:\Users\qianz\.dsh\skills\<name>\` → 写 `_meta.json` → 登记进 `C:\Users\qianz\.dsh\skills-manager\repositories.json`（脚本 `clawhub-install.mjs`；操作前先备份 repositories.json）。`_meta.json` 形如：
```json
{ "slug": "skill-vetter", ... }
```
技能 zip 头部魔数确认为 `504b0304`（PK..）。

**项目技能 → 用户技能**：直接 `Copy-Item` 整目录，随后逐文件 SHA256 校验（academic-pptx-skill 6 个文件哈希全部一致）。同名技能在项目/用户目录各一份不冲突（`dsh-skill-filesystem` 有去重与 `BUNDLED_SKILL_RANK` 优先级逻辑）。

### 2.5 ClawHub 技能的安全结论（重要）

- 技能是**纯文本指令，装完 AI 就会照着执行**；恶意技能可以指示 AI 读文件、发数据。
- 客观证据：ClawHub 下载榜**第 2 名就是 `skill-vetter`（安全审查）**，**第 7 名是 `skillscan`（安全门禁）** —— 这个生态自己在做安全扫描。
- 安装 = 从 clawhub.ai 下载 **ZIP（最大 8 MB）**解压进技能目录，**包里可以带脚本**。
- 规矩：**装之前一定点「查看详情」把正文读一遍**；看到要执行命令、访问网络、读取文档目录，就别装。

### 2.6 明确「别装」的技能类别（会与已有能力打架）

| ClawHub 上的 | 你已经有的 |
|---|---|
| `word-docx` / `excel-xlsx` / `powerpoint-pptx` / `slides` | office-docx/pptx/xlsx + univer ×9 |
| `tavily` / `brave-search` / `baidu-search` / `multi-search-engine` | dsh-free-search（24 引擎）+ 内置 web_search |
| `agent-browser` / `browser-use` / `playwright-mcp` | browser-skill 插件 |
| `self-improving-agent` / `ontology` / `elite-longterm-memory` / `agent-memory` / `memory-setup` | dsh-mnemon + hindsight |
| 各类图片生成 | 无对应 API Key |

**陷阱（看着好但会失败）**
- `pskoett/self-improving-agent`（**下载 485,000，全站第 1**）——正文写着 `This version of the skill is built for OpenClaw only — for other agents, see the original multi-agent version...` → **不是给 DSH 写的**。教训：**下载量高 ≠ 适合你**。
- `shanjiaming/writing-style-iterator` —— 要求文件操作 + **git**（当时没 git）。
- `ivangdavila/chinese`（29159 字符）—— 依赖一整套 `~/Clawic/data/chinese/config.yaml` OpenClaw 数据目录体系。
- PDF 类全部装不了：`steipete/nano-pdf`(123k) 要 `uv`；`awspace/pdf`(51k) 要 `pip install pytesseract pdf2image` 且**许可证 Proprietary**；`thcjp/pdf` 在推付费版。
- 中文技能整体数据冷门（`gongyu0918-debug/chinese-official-writing` 9,684 下载/70 安装/1 星；`lmtea1981/word-cn-format` 3,040/84/1）—— 对比 skill-vetter 的 12,247 安装/1,305 星，基本是作者自传，质量与安全均不确定。要写公文，DSH 插件市场里的 **`gongwen-skill`（2.15.0，GB/T 9704 国标格式）**比这些靠谱。

### 2.7 自建技能的注意点（从 lunheng 的 patch 注释学到的）

> 组合包的 patch 必须**插入一行 `name` = 本包包名**，「插件行按包名而不是相对源码路径引用这个包，这样 Node 的模块解析才能找到已安装的代码」。**patch 里的行才是会被 import 的东西**；`package.json#main` 不会因为「包被列进 profile 的 bundles」就自动执行。
（lunheng v18.0.0 曾漏补这一行 → 入口从不被 import → 技能不注册。）

---

## 3. 环境与工具链事实

### 3.1 可执行文件路径与版本

| 工具 | 路径 | 版本 |
|---|---|---|
| 宿主 exe | `D:\Deepseek\DeepSeek Harness.exe` | — |
| dsh CLI | `D:\Deepseek\resources\runtime\cli\bin\dsh.cmd` | host 0.2.0-rc.2 |
| 宿主内 node | `D:\Deepseek\resources\runtime\primary-runtime\dependencies\node\bin\node.exe` | v24.18.1 / v24.21.0（两处记录） |
| 系统 node | `C:\Program Files\nodejs\node.exe` | v24.20.0 |
| pnpm | `D:\Deepseek\resources\runtime\pnpm\bin\pnpm.cjs` | 11.7.0 |
| pnpm（备） | `C:\Users\qianz\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs` | 11.7.0 |
| bsk CLI | `C:\Users\qianz\.local\bin\bsk.exe` | 0.3.3 |
| Python（用户级） | `C:\Users\qianz\AppData\Local\Programs\Python\Python315\python.exe` | 3.15 |
| Python（DSH 自带） | `C:\Users\qianz\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe` | 3.12 |
| Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` | 155.0.8059.40 |
| Edge | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` | 155.0.4283.45 |
| winget | `C:\Users\qianz\AppData\Local\Microsoft\WindowsApps\winget.exe` | v1.29.380 |
| Tesseract 语言包 | `C:\Users\qianz\tessdata`（`chi_sim` / `eng` / `osd`） | — |

**PATH 现状（实测，早期）**：`git`、`npm`、`npx`、`node`、`pip`、`ffmpeg`、`gh`、`uv`、`bsk`、`antigravity`、`dsh`、`pnpm` **全部 MISSING**；只有 `python` / `python3`（WindowsApps 垫片）、`curl`、`tar`（`C:\WINDOWS\system32\tar.exe`）、`winget` 在。后来陆续补齐。

**关键教训：DSH 自带的 node/pnpm 不在 PATH 上。** 任何由插件 `prepare`/`postinstall` 脚本发起的 `pnpm install` 或 `node` 调用都会以
`'pnpm' is not recognized…` / `'node' is not recognized…`
失败。修法：在 `C:\Users\qianz\.local\bin` 放 `node.cmd` / `npx.cmd` / `pnpm.cmd` 垫片（`@echo off` + 绝对路径转发），使子进程能找到工具。这三个垫片在 git/gh/node 正式装好后被删掉（会遮挡真家伙，且 `npx.cmd` 本身就是坏的）。

### 3.2 网络可达性（实测）

| 主机 | 结果 |
|---|---|
| `registry.npmjs.org` | OK 200 (736ms) |
| `registry.npmmirror.com` | OK 200 (80ms) |
| `api.github.com` | OK 200 (1320ms) |
| `github.com` | OK 200 (3726ms) |
| `raw.githubusercontent.com` | FAIL 500 |
| `valorant-api.com` | OK 200 |
| `images.unsplash.com` | OK 200 |
| `i.imgur.com` | OK 200 (3828ms) |
| `duckduckgo.com` / `www.bing.com` | OK 200 |
| `images.pexels.com` | FAIL 404 |
| `cdn.pixabay.com` | FAIL 403 |
| `commons.wikimedia.org` / `upload.wikimedia.org` | **不可达（超时）** |
| `en.wikipedia.org` | 400 |
| `codeload.github.com` | 可用（下 zip 成功） |

其他：机器上**没有任何 `.npmrc`**（`$prof\.npmrc`、`$USERPROFILE\.npmrc`、`.dsh\.npmrc`、`app.asar.unpacked\dsh\.npmrc` 全 absent）。机器 UTC+08:00（Asia/Shanghai），日志时间戳是 UTC，**本地时间 = UTC+8**。

### 3.3 权限/沙箱相关

- PowerShell **执行策略全为 Undefined**，但 `.\script.ps1` 仍被拒：
  ```
  . : 无法加载文件 C:\Users\qianz\AppData\Local\Temp\bsk-install.ps1，因为在此系统上禁止运行脚本。有关详细信息，请参阅 https:/go.microsoft.com/fwlink/?LinkID=135170 中的 about_Execution_Policies。
      + CategoryInfo          : SecurityError: (:) []，PSSecurityException
      + FullyQualifiedErrorId : UnauthorizedAccess
  [exit code: 1]
  ```
  修法：`Invoke-Expression (Get-Content $out -Raw)`（绕过脚本文件策略）。LanguageMode 是 `FullLanguage`。
- 命令沙箱**禁止进程脱离 Job Object**，所以 `bsk daemon` 的分离启动失败（见 6.3）。
- `glob` 在 `D:\` 根扫描会因 `$RECYCLE.BIN` / `System Volume Information` 报 `os error 5 拒绝访问`。
- **`D:\Deepseek\resources\app.asar` 是单文件**：用 pwsh/fs 直接读会 `os error 3 系统找不到指定的路径`；必须用 `& "D:\Deepseek\DeepSeek Harness.exe" --expose-internals <script.js>` 或 `$env:ELECTRON_RUN_AS_NODE=1` 由 Electron 读 asar。

---

## 4. 命令与配置

### 4.1 真正跑通的关键命令（原样）

```powershell
# 读 profile 依赖与 bundles（Node 读 UTF-8，PowerShell 5.1 会读乱中文）
$node = "C:\Users\qianz\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
& $node -e "const fs=require('fs'),path=require('path');const prof=process.env.DSH_PROFILE_DIR;const pkg=JSON.parse(fs.readFileSync(path.join(prof,'package.json'),'utf8'));console.log(Object.keys(pkg.dependencies).length, pkg.dsh.profile.bundles.length)"

# 装插件进 profile
$node = "C:\Users\qianz\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
$pnpmCjs = "D:\Deepseek\resources\runtime\pnpm\bin\pnpm.cjs"
& $node $pnpmCjs add "@wxg-prc-cpg/browser-skill-dsh-plugin@0.3.3" --reporter=append-only
# workdir = C:\Users\qianz\.dsh\profiles\desktop

# 读 pnpm 全局配置（minimumReleaseAge 来源）
pnpm config list

# 校验 patch YAML（不要用 python -c "import yaml"，本机缺 pyyaml）
& "C:\Program Files\nodejs\node.exe" C:\Users\qianz\AppData\Local\Temp\validate-patch.cjs
```

```powershell
# 装 bsk CLI（官方安装器，校验 SHA256）
$url = "https://raw.githubusercontent.com/Tencent/BrowserSkill/main/install.ps1"
$out = "$env:TEMP\bsk-install.ps1"
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
Invoke-Expression (Get-Content $out -Raw)
# 输出：latest version is 0.3.3 / checksum OK / installed bsk to C:\Users\qianz\.local\bin\bsk.exe / placed C:\Users\qianz\.local\bin first in user PATH / added /c/Users/qianz/.local/bin to ~/.bashrc / bsk 0.3.3
```

```powershell
# bsk 守护进程必须在持久前台任务里启动（沙箱禁止 Job Object breakaway）
$env:BSK_HOME = "C:\Users\qianz\.bsk"
$env:PATH = "C:\Users\qianz\.local\bin;" + $env:PATH
& "C:\Users\qianz\.local\bin\bsk.exe" daemon start --foreground   # run_in_background=true
# 之后独立进程验证（要设 BSK_AUTO_START=0）
$env:BSK_AUTO_START = "0"
& "C:\Users\qianz\.local\bin\bsk.exe" status --json
```

```powershell
# 装统计包：Python 3.15 太新，必须强制只用预编译 wheel
$py = "C:\Users\qianz\AppData\Local\Programs\Python\Python315\python.exe"
& $py -m pip install --only-binary=:all: --upgrade scipy matplotlib statsmodels lifelines
```

### 4.2 写过的配置文件及原因

**`cordis.patch.yml`（profile 补丁层）** 关键行：
```yaml
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: deepseek-account
    model: deepseek-flash
    reasoningEffort: high
- id: ui-chat
  name: "@deepseek-ai/dsh-client-ui-chat"
  config:
    transcriptView: compact
    performanceUsage: compact
- id: browserskill
  name: "@wxg-prc-cpg/browser-skill-dsh-plugin"
  config:
    # Absolute path on purpose: the running DSH app was launched before
    # ~/.local/bin was added to the user PATH, so a bare `bsk` may not resolve.
    bskPath: 'C:\Users\qianz\.local\bin\bsk.exe'
```
**以及一段不能删的修复注释（187–190 行附近）**：
```yaml
# Repair for a dangling web provider. The @liustack/modsearch bundle layer
# patches this row with `searchProvider: modsearch`; disabling the modsearch
# row (above) does not remove that config patch, so nothing registers the
# provider and every web_search fails with
#   configured web provider "modsearch" is not registered
# Restating the dsh-base defaults makes a disabled plugin degrade to the
# official provider instead of breaking search. dsh-free-search then takes
# the search seam over at runtime.
```

**browser-skill 插件的配置项（README 原文，可整体覆盖）**
```yaml
- id: browserskill
  config:
    bskPath: bsk
    defaultTimeoutMs: 120000
    maxSessions: 5
    observationEnabled: true
    thumbnailIntervalMs: 1500
    idleIntervalMs: 8000
    lazyTools: true
```
> `Change bskPath to the full path of your CLI binary if it is not on dsh's PATH.`
> `A patch replaces the entry's entire config object, so keep all overrides you need together in that object.`

**`pnpm-workspace.yaml`**：`packages: [.]`、`nodeLinker: hoisted`、`autoInstallPeers: false`、`minimumReleaseAgeExclude:`（逐条列 `dsh-context@0.70.0`、`billion-context@0.1.197`、`@michengai/dsh-archive-manager@1.0.19`、`@michengai/dsh-im-connect@0.1.76`、`@michengai/dsh-agency-agents@1.0.19`、`dshmarket@1.66.22`、`dsh-mnemon-provider-hindsight@0.5.6`、`dsh-mnemon-provider-openviking@0.5.8`、`dsh-mnemon-source-memory-spaces@0.5.19`、`dsh-mnemon@0.5.29`、`dsh-cost-meter@1.8.26`、`dsh-plugin-marketplace@0.5.3`、`lunheng-article-pipeline@19.6.0`、`dsh-free-search@0.8.10`、`@michengai/dsh-codex-ui@1.1.38`、`@michengai/dsh-skills-manager@1.1.21`、`dsh-context@0.71.0`……）。这是 pnpm「新版本冷却期」的白名单机制。

**⚠️ 已知脏配置**：`pnpm-workspace.yaml` 的 `allowBuilds:` 下面写着 `protobufjs: set this to true or false` —— 这是**pnpm 的提示文案被当成值写进配置了**，不是布尔值。建议改成 `true`/`false` 或删掉（`.modules.yaml` 已把它列进 `ignoredBuilds`）。全局 pnpm 配置里 `allowBuilds` 是 `{ "protobufjs": true, "cloudflared": true }`。

---

## 5. 失败与坑（原因 + 原始报错 + 解决）

### 5.1 `@michengai/dsh-skills-manager` 安装失败 —— 宿主的 10 分钟沉默看门狗（**最有价值的坑**）

**症状**：市场点击安装 → 失败回报，日志（`C:\Users\qianz\.dsh\profiles\desktop\.dsh-market\log.ndjson`）：
```json
{"at":"2026-10-14T16:36:47.336Z","level":"error","event":"install","detail":"dsh-better-sidebar@0.26.0 exit=1 err=try again later or check the network这台宿主（官方桌面端）自己执行安装，不接受市场附加的 pnpm 参数（--config.fetchTimeout=600000），所以这一步没有自动重试。 / This host (the official desktop app) runs the install itself and takes no pnpm options from the market (--config.fetchTimeout=600000), so that automatic retry could not be attempted."}
```

**真凶**（日志里被挤成一坨的两行）：
```
Done in 7s using pnpm v11.7.0                              ← pnpm 自己报告：7 秒装完了
dsh: pnpm printed nothing for 600000ms and was terminated  ← 之后 10 分钟没有输出，被宿主杀掉
```
时间线吻合：`01:51:04` 开始 → `02:01:14` 报错 = **610 秒**。宿主随后**把这次本来成功的安装整个丢弃**。

**看门狗在宿主侧**：`D:\Deepseek\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-plugin-manager\lib\index.js:604`
```js
const notice = `dsh: pnpm printed nothing for ${String(options.idleTimeoutMs)}ms and was terminated\n`;
```
（同句也在 `lib\types\operations.js:431`）相关行：`:553` `armIdle()`（每个 stdout/stderr 分片重置计时器）、`:547` `child.kill()`、`:615` `if (exitCode === 0 && !control.stalled)` —— **一旦触发 stall，后面的安装校验不跑，成功结果也当失败扔掉**。

**排除法证明不是包/网络的问题**：包存在（latest 1.1.19，共 67 版本，2026-10-13 发布）；依赖树**只有 `fflate@0.8.3`**（纯 JS，无 install/postinstall），`optionalDependencies` 为空；peer 全命中；registry 736ms/80ms。市场自己的「指名凶手」分支（`dshmarket\src\pnpm-compat.ts:218`，靠抓 `node_modules/<包名> postinstall` 定位）这次**没抓到**，所以只输出通用的「网络卡住了」——而该插件根本没有安装脚本，这条建议是误导。最强证据：**同一份日志里后面装的同类插件全部成功**（`@michengai/dsh-codex-ui@1.1.37`、`@michengai/dsh-archive-manager@1.0.19`、`dsh-whale-widget@0.4.2`，结局都是 `the host's own replay activated it; adopted instead of mounting a second copy` + `exit=0 hot=true`）。

**解决**：① 回市场重试并**让它自己跑满 10 分钟**别取消；② 或走手动 pnpm 路径（见 4.1）。**另注：16:46 那次对 `dsh-better-sidebar` 的取消是纯亏的**——这台宿主不接受市场附加的 pnpm 参数，也不做自动重试。

### 5.2 `dsh-smart-charts`（git 依赖）安装失败

**报错 1（allowBuilds 白名单）**：
```
[ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED] Failed to prepare git-hosted package fetched from "https://github.com/hherosoul/dsh-smart-charts.git": The git-hosted package "dsh-smart-charts@8.4.1" needs to execute build scripts but is not in the "allowBuilds" allowlist.
```
**坑中坑**：`allowBuilds: dsh-smart-charts: true`（裸包名）**匹配不上**；pnpm 要求**带 git 地址的完整规格**：
```
dsh-smart-charts@git+https://github.com/hherosoul/dsh-smart-charts.git#0595787f346e53c81d617ce3f86888ebbd58b5d8: true
```
**报错 2（放行后）**：
```
[ERR_PNPM_PREPARE_PACKAGE] Failed to prepare git-hosted package fetched from "https://github.com/hherosoul/dsh-smart-charts.git": dsh-smart-charts@8.4.1 pnpm-install: `pnpm install`
```
**根因**：该包的 `prepare` 脚本要跑 `pnpm install`，而 **DSH 私有的 node/pnpm 运行时从来不在 PATH 上** → `'pnpm' is not recognized…` 然后 `'node' is not recognized…`。
**解决**：在 `C:\Users\qianz\.local\bin` 造 `node.cmd` / `npx.cmd` / `pnpm.cmd` 垫片，构建通过（`✔ Build complete in 1328ms`），`smart-charts` 技能出现。后来真工具装好后垫片被删除（`npx.cmd` 本身是坏的，会遮挡真家伙）。**结论：缺的是两个命令行工具，不是 registry。**

### 5.3 `bsk daemon` 起不来（沙箱限制）

**报错原文**：
```
FAIL  daemon running                   automatic daemon startup failed: cannot start an independent Windows daemon; the host may prohibit Job Object breakaway; use `bsk daemon start --foreground` in a persistent host task or start from an independent terminal: 拒绝访问。 (os error 5) — hint: Do not retry detached startup in this host. Run `bsk daemon start --foreground` in a persistent host task that outlives client commands, or run `bsk daemon start` from an independent terminal. Use the same BSK_HOME and OS user as the clients. Then set BSK_AUTO_START=0 for client commands and verify `bsk status --json` in a separate invocation.
FAIL  protocol compatible              daemon status unavailable — hint: start the daemon first
```
**解决**：用受管后台任务 `bsk daemon start --foreground`（成功，pid 21532，ws `127.0.0.1:52800`，sock `\\.\pipe\bsk-daemon-43c0fc588da2062b`，protocol 1.3）。之后 `bsk doctor` 只剩一项 FAIL：
```
FAIL  extension connected              0 browsers connected — hint: install the extension from https://chromewebstore.google.com/detail/hhcmgoofomhgciiibhipgmgkgnoenaoi (Chrome) or https://microsoftedge.microsoft.com/addons/detail/browserskill/emacgiaaaiojkkpkddmmdfhmokgmnikg
```
Edge 加载项的 crx id = `emacgiaaaiojkkpkddmmdfhmokgmnikg`，商店版本 0.3.3（与 CLI 一致）；Chrome 商店报告版本 `1.0`（**未确认**是否为准）。默认浏览器 = **Edge**（`MSEdgeHTM`）。

### 5.4 `raw.githubusercontent.com` 返回 500 → 下 zip 走 `codeload`

`web_fetch https://api.github.com/repos/.../git/trees/main` 报 `URL hostname "api.github.com" resolves to a non-public IP address`；`raw.githubusercontent.com` 内部返回 500。可行替代：`https://codeload.github.com/<owner>/<repo>/zip/refs/heads/main`（206903 B 成功）。

### 5.5 PowerShell 侧的通病

- **PowerShell 5.1 会把中文 manifest 读乱**（`瀹夎academic...`），还会因包解析失败导致描述串行 → **改用 Node 读 UTF-8**。
- `Get-Content` 读取含 BOM 的 JS 时：`SyntaxError: Unexpected token '﻿', "﻿const fs="... is not valid JSON` → Node 脚本不要用 here-string 写文件后直接 require。
- `SkipCertificateCheck` 在旧版 PS 不存在：`找不到与参数名称"SkipCertificateCheck"匹配的参数`。
- `import yaml` 失败：`ModuleNotFoundError: No module named 'yaml'`；`import lifelines.api` 也不存在（应为 `lifelines.utils`）。**校验 YAML 用 Node 的 yaml 包，不要用 python。**
- pip 装 pandas 触发源码编译：`..\meson.build:2:0: ERROR: Could not find C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe` → 必须 `--only-binary=:all:`。

### 5.6 `cordis.patch.yml` 被 GUI 重写 —— 手写行会丢

实测：DSH 主进程 `02:23:05` 启动，补丁文件 `02:24:04` 被改 → **末尾那次改动根本没被加载**，注释留下了、4 行 `disabled: true` 没了。铁证是技能表里**仍然列着 `lunheng-article-pipeline` 和 `lunheng-commands`**。
**教训**：① 改完补丁**必须重启 DSH**；② **别在刚启动的时候切插件开关**（见 5.7）；③ 这个文件会被 GUI 的插件管理器重写，重要手写行有丢失风险，改完要复核。

### 5.7 桌面端启动崩溃：`INACTIVE_EFFECT`

**日志**：`C:\Users\qianz\AppData\Roaming\@deepseek-ai\dsh-desktop\logs\crash-2026-10-15T18-06-33-611Z-main.log`（＝北京时间 10-16 02:06:33）
```
phase: startup
DesktopHostFatalError: cannot create effect on inactive context
--- host diagnostic ---
CordisError: cannot create effect on inactive context
    at Fiber.assertActive (…/@deepseek-ai/cordis/lib/index.js:1133:9)
    at Proxy.plugin      (…/@deepseek-ai/cordis/lib/index.js:1622:18)
    at Object.apply [as callback] (…/@deepseek-ai/dsh-desktop-host/lib/index.js:80:12)
    at async Fiber._reload (…/@deepseek-ai/cordis/lib/index.js:1356:5) { code: 'INACTIVE_EFFECT' }
```
**含义**：启动阶段 Cordis 做插件热重载，要重新执行内置 `desktop-office` 插件的 `apply`，但 fiber 已销毁 → 抛错 → Host 当致命错误退出。窗口/托盘图标是 Electron 主进程建的，所以**图标正常出现、界面永远不来**。另有一份更早的 `host.log`：10-15 00:38 `dsh desktop host exited with 1073807364`。
**背景开销**（让它更慢）：33 个 bundle 全量加载；node_modules 42,766 文件/470 MB，冷 stat 13.5 秒；启动后立刻拉起 billion-context 的 preload 进程与 dsh-code-server-app 的 VS Code server（`127.0.0.1:8090`）。
**缓解**：① 重启 DSH；② 给 Defender 加排除（**需管理员，agent 做不了**）：
```powershell
Add-MpPreference -ExclusionPath "C:\Users\qianz\.dsh"
Add-MpPreference -ExclusionPath "D:\Deepseek"
```
③ 别在刚启动时切插件开关，一次改完→重启；④ 可选禁掉 `dsh-code-server-app`；⑤ 卡死用任务管理器结束 `DeepSeek Harness.exe`；⑥ 跑的是 rc 版（0.2.0-rc.2），该缺陷大概率在 0.2.1 正式版修掉。

### 5.8 未解决 / 待定

- **hindsight 单独插件**：既不在 bundles 又被 `disabled: true`，且 `C:\Users\qianz\.hindsight\coding-agent.json` 不存在 → **两头都没接**。要用得补两件事（加 bundles + 删 disabled + 写配置），并且**必须自备 Hindsight 服务端**。
- **`mnemon-native` Provider** 需要 `npm install --global @mnemon-dev/mnemon`，未执行。
- **图像生成插件缺 API Key**。
- `@linxin666/dsh-client-ui-skill-explorer`、`@liustack/modlens`、`@vectorize-io/hindsight-coding-agents`、`@zhtx2026/dsh-pdf`、`dsh-plugin-marketplace` 这 5 个包**在 bundles 里但不在 node_modules** 的完整性检查报告中出现过（同一次检查里 dsh-pdf 随后被装入，故该报告应视为安装过程中的中间态，**未确认**为持续缺失）。

---

## 6. 用户偏好 / 习惯

- **语言**：全程中文交流，产出默认中文。
- **身份/背景**：自称「AI 新手」，是**医学生（大三）**，有 7 项用途：医学知识解答、英语学习、AI 学习、电脑维护、医学文献检索、基础医学实验、临床统计与随访。
- **成本/token 敏感**：主动关心「防止崩溃」「怎么又有插件」「为什么变慢」「怎么占 token」，会要求逐项列出 token 代价；对「每次调用多背 N tokens」这类账敏感。会话实测全局平均 **每次调用 100,924 tokens，93.4% 是缓存读取，输出只占输入 1.32%**（706 次调用 / 34 个会话）。
- **行为模式**：喜欢在 GUI 里自己动手（多次选择「我先回市场自己重试一次」「你自己在界面装」），但也会要 agent「帮我操作」。
- **交付偏好**：喜欢**带数字的对照表**、明确「留哪个/关哪个」的结论、以及「已做/待做」的分条清单；不喜欢空泛解释。
- **风险态度**：接受「关闭但保留安装」（`disabled: true` 而不卸载）这种可逆做法。
- **客户端**：也在**微信里用 DSH**（有 IM 会话「如何正确使用你」，60 次调用 / 50,957 tokens）。
- **多次明确要求**：装 git/gh、装 PDF 能力、把 academic-pptx-skill 也装到用户目录（全局可用）。
- **agent 自己的工作习惯（值得沿用的教训）**：改配置前**先备份**（`profile-backup-YYYYMMDD-HHMMSS` 目录，含 package.json / pnpm-lock.yaml / pnpm-workspace.yaml / cordis.patch.yml）；每步**独立验证**；不臆测、读源码取证；误改他人配置（wallpaper-engine）时主动 diff 备份并报告。
