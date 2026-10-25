# 教训库（LESSONS）

> 我（DSH 里的 agent）干过的错事、造成的后果、以及以后必须遵守的判据。
> **动手前先读这一篇**：任何修改 DSH 状态文件、批量删改、卸载/升级、动用户数据之前。
> 只追加、不删改历史条目；同一类错误第二次出现时，把「判据」升级成硬规则并标注 ⛔。

## 索引

| # | 日期 | 一句话 | 严重度 |
|---|---|---|---|
| 1 | 2026-10-25 | 手写 workspace.json 把 `updatedAt` 换成数字 → 整个工作区打不开 | ⛔ 灾难 |
| 2 | 2026-10-25 | 会话日志「手术」（删事件/单帧 zstd）→ 历史加载失败 | ⛔ 灾难 |
| 3 | 2026-10-25 | 并行批量 dshm_toggle → 超时与传输失败，结果不确定 | 高 |
| 4 | 2026-10-25 | 先停用插件再批量升级 → 升级把停用的又写回启用 | 高 |
| 5 | 2026-10-25 | 长时间批量操作不报进度 → 用户以为卡死、反复追问 | 中 |
| 6 | 2026-10-25 | 用 `node -e` 拼中文路径/多层转义 → 报错与静默错结果 | 中 |
| 7 | 2026-10-25 | 用 `printf` 生成 .cmd → `\t` 被解释成 TAB，命令损坏 | 中 |
| 8 | 2026-10-25 | 在 Git Bash 里跑 `schtasks /create` → `/create` 被当路径 | 中 |
| 9 | 2026-10-25 | PowerShell 脚本存成无 BOM UTF-8 → 中文乱码 | 低 |
| 10 | 2026-10-25 | 想当然以为 git 能推 GitHub → 13 个提交躺在本地 10 天没上去 | 高 |
| 11 | 2026-10-25 | 用 write 工具写 `.ps1`（无 BOM）→ PS 5.1 按 ANSI 解析中文，语法错误 13 处 | 中 |
| 12 | 2026-10-25 | 往会话日志注入事件被宿主裁掉 → 侧栏仍不显示（真正读的是 projcache） | 中 |
| 13 | 2026-10-25 | 自动升级死循环：跳过时写 state 冲掉 `lastUpdateDay`，每 5 分钟当「今天第一次」重跑 | 高 |
| 14 | 2026-10-25 | node 18+ 的 `spawnSync` 直接跑 `.cmd` 报 `EINVAL`（CVE-2024-27980 后不再允许） | 中 |

---

## 1. 手写 DSH 状态文件导致工作区崩溃（⛔ 灾难）

- **我干了什么**：写脚本改 `C:\Users\qianz\.dsh\storages\workspace.json`，把工作区的 `updatedAt` 从 ISO 字符串改成了 `Date.now()` 数字，想让界面刷新排序。
- **后果**：DSH 启动解码失败 → `active Service 'workspaceController' is unavailable`，整个工作区列表打不开；用户靠网页版 DeepSeek 协助、手工整段覆盖文件才恢复。
- **根因**：只做了 `JSON.parse` 层面的合法性判断，以为「JSON 合法 = 数据正确」，忽略了 DSH 用 schema 做字段类型校验。
- **判据（硬规则）**：
  1. 能走 GUI / `dshm_*` / 官方 API 的，**绝不**手写状态文件。
  2. 必须改时：先备份原文件；与同文件里**同类记录逐字段对齐类型**（同类记录是字符串，我就不能写数字）。
  3. 写完必须**回读校验**：字段 typeof、ISO 正则、关键数组一致性；任何一条不满足立即回滚备份。
  4. 时间字段一律 ISO-8601 字符串；**永不修改** `updatedAt`。

## 2. 会话日志「手术」导致历史加载失败（⛔ 灾难）

- **我干了什么**：为了让消失的 dsh4 会话重新出现，删掉了其中 9 条违规的 `developer/message` 事件、又把单帧 zstd 重封装成多帧。
- **后果**：界面出现「历史加载失败：corrupt session log ... released v2 row 500 has seq gap (expected 500, got 501)」；会话彻底不可读。
- **根因**：不知道 DSH 对日志的完整性校验规则（seq 必须从 0 连续），凭猜改动历史记录，删事件留下空洞。
- **正确做法（已验证可行的全部规则）**：
  - 新建空会话：多帧 zstd（第 1 帧只放 session 头）+ 事件 seq **从 0 连续** + 骨架 `permission/preset`(0) → `sandbox/mode`(1) → `approval/policy`(2) → `session/title`(3) + 把纯字符串 id 加进 `workspace.json` 的 `sessionIds`。脚本 `~\.dsh\tools\mksession-batch.mjs`。
  - 已损坏的历史会话**没有修复价值**：把目录移到备份区 + 从名册摘掉即可，别试图编辑日志。

## 3. 并行批量开关插件导致结果不明（高）

- **我干了什么**：一条消息里同时发 20 个 `dshm_toggle`。
- **后果**：多个调用 30s 超时、出现 `DeepSeek Messages transport failed`，我无法确认到底哪个生效，只能事后靠技能目录缩水去反推。
- **判据**：批量启停**串行**、每批 ≤5 个、逐个看回执（`已停用（即时生效）` / `需重启生效`）；任何「结果未知」必须复查再继续。

## 4. 先停用、再升级 = 停用被撤销（高）

- **我干了什么**：先停了 38 个插件，然后批量升级 28 个插件。
- **后果**：升级（pnpm add）重写 profile 的 `package.json`，把停用的包重新写回 `dsh.profile.bundles`，重启后 38 个停用全部复活。
- **判据**：顺序永远是**先升级、后停用**；或升级前后对 `dsh.profile.bundles` 做快照并还原（`autoupdate\update-agent.mjs` 里的 `snapshotBundles` / `restoreBundles` 已实现，写完回读校验，失败即回滚）。

## 5. 长时间不报进度被当成卡死（中）

- **我干了什么**：连续跑 10–16 分钟的 pnpm 升级/备份，期间没有任何输出。
- **后果**：用户连问三次「为什么停住了、也不消耗 token、任务到哪了」。
- **判据**：预计超过 2 分钟的操作，**先说要做什么、大概多久**；分批执行，每批结束报一句「第 N/M 批完成」；无法中途报进度的，就在开头说明「这一步中间不会有输出，属正常」。

## 6. `node -e` 拼中文路径与多层转义（中）

- **现象**：`Cannot read properties of undefined`、路径 `D:蓝鲸…`（少一个反斜杠）、`SyntaxError: Invalid or unexpected token`。
- **判据**：凡涉及中文路径、反斜杠、正则的脚本，**写成 .mjs/.ps1 文件再执行**，不用 `-e` 内联；正则里的 `\\\\` 一律在文件里写清楚。

## 7. `printf` 生成 .cmd 导致内容损坏（中）

- **现象**：`printf '...\\tools\\capture...'` 输出成 `\.dsh<TAB>ools\capture`，`\t` 被当作制表符。
- **判据**：给 Windows 用的 `.cmd` 用 write 工具写（ASCII 正文），再用 node 把换行转 CRLF；不用 printf/echo 拼含反斜杠的路径。

## 8. Git Bash 里跑 Windows 原生命令被路径转换（中）

- **现象**：`schtasks /create ...` 报 `无效参数/选项 - '.../bash-win32-x64/create'`；`cmd /c` 变成交互式 cmd。
- **判据**：注册计划任务、`cmd /c`、带 `/开关` 的 Windows 命令，一律走 PowerShell（`Register-ScheduledTask`、`& 'x.cmd'`），不要在 bash 里加斜杠参数。

## 9. PowerShell 脚本中文乱码（低）

- **现象**：PS 5.1 读无 BOM 的 UTF-8 脚本，中文全变乱码、甚至字符串判断失效。
- **判据**：`.ps1` 保存为 **UTF-8 带 BOM + CRLF**；改完必须重新补 BOM（`fs.writeFileSync(p,'\ufeff'+s.replace(/\r?\n/g,'\r\n'))`）。

## 10. 想当然以为 git 能推 GitHub，其实一直是坏的（高）

- **我干了什么**：给笔记库 `dsh-notes` 连续提交（交接卡、复盘、教训库），并在报告里写「已提交到仓库」，但从没验证过 `git push` 是否真的成功。
- **后果**：本地 `main` 领先远端 **13 个提交**，最近一次成功推送停在 2026-10-15。也就是这十天的文档全只在本地一份，硬盘坏就没了；我却一直以为有云端副本。
- **根因**：把 `git commit` 当成了「已保存到云端」。真实原因是本机 GitHub 推送一直是坏的——`schannel: next InitializeSecurityContext failed: CRYPT_E_NO_REVOCATION_CHECK (0x80092012)`（证书吊销列表在本机网络不可达），而 `http.schannelCheckRevoke=false` 在 git 2.56 下**已被忽略**，`http.sslVerify=false` 才有效；另外 PATH 里排第一的 `git.exe` 是 dsh-ops 自带的 ucrt64 版，行为与正式版不同。
- **判据（硬规则）**：
  1. 只要说了「已推送到远端」，必须当场验证：`git status -sb` 不显示 `ahead`，或 `gh api repos/<owner>/<repo>/commits` 能看到那条提交。
  2. 本机可用的推送方式（已验证）：正式版 git `C:\Program Files\Git\cmd\git.exe` + 该仓库本地 `git config http.sslVerify false`。
  3. 推不动的报错先看是不是 `CRYPT_E_NO_REVOCATION_CHECK`：那是网络层的吊销检查，不是账号权限问题，别去重置 token。
  4. （2026-10-25 补）根因是 **Steam++（Watt Toolkit）在中间解密 HTTPS**：github.com 的证书签发者被换成 `CN=SteamTools Certificate, O=BeyondDimension`，git 因此既过不了 openssl 校验（根证书不在 CA 包里）、也过不了 schannel 吊销检查。**备份与上云优先用 GitHub REST API（`Invoke-RestMethod` + `gh auth token`），完全不碰本机 git**；`~/.ssh`（规则 `secret.home.ssh`）与 `.pem`（规则 `secret.ext.pem`）两条修法被 cc-safety-net 拦，**不得绕过**。

## 11. 用 write 工具写 .ps1 忘了补 BOM（中）

- **我干了什么**：新写 `backup-dsh.ps1` 与 `restore-dsh.ps1` 时直接用 write 工具落盘（UTF-8 无 BOM），随即运行。
- **后果**：PowerShell 5.1 按 ANSI 解码，中文字符串里的全角括号被拆坏，`Parser]::ParseFile` 报 **13 处语法错误**（`Unexpected token 'backups\dsh'` 之类），脚本整体不可用；看起来像"代码写错了"，其实是编码问题。另有一处：把中文参数交给 `powershell.exe -File ... -Reason '手动测试'`，落到云端提交信息里变成 `????`。
- **判据**：
  1. 任何 `.ps1` 用 write 工具落盘后，**立刻补 BOM**：`[IO.File]::WriteAllBytes($p, [byte[]](0xEF,0xBB,0xBF) + [IO.File]::ReadAllBytes($p))`。
  2. 补完必须跑 `[System.Management.Automation.Language.Parser]::ParseFile($p,[ref]$null,[ref]$err)` 看 `$err.Count`，0 才算能跑。
  3. 跨进程传参避免中文（改用 ASCII 或写进文件）；GitHub 提交信息也保持 ASCII。

## 12. 往既有会话日志里注入事件，被 DSH 启动时裁掉（2026-10-25）

**我干了什么**：用 `seed-session-prompt.mjs` 往 9 个空会话的 `session.v4.jsonl.zstd` 里追加了一条 `user/message` 事件，想让它们「说过一句话」从而出现在侧栏。当天写盘成功、解压逐行校验也通过。

**后果**：重启后侧栏依旧没有这 9 个会话；再看日志文件，只剩 1 行 session 头（881 B），我追加的事件消失了（DSH 在 13:21 重写过该文件）。真正决定侧栏是否显示的不是会话日志，而是 `C:\Users\qianz\.dsh\storages\session_projcache\sessions\<id>.json` 里 `record.rows.sessionListMetadata.val` = `{blank:true, lastPromptAt:null}`。

**根因**：会话日志由宿主按自己的提交/释放机制管理，外部追加的事件不被视为「已提交」；而侧栏列表读的是投影缓存。

**判据**：①想判断一个会话为什么不显示，先看 projcache 的 `blank`/`lastPromptAt`，不要先动日志；②要动 projcache 就把两个 row 一起改——`sessionListMetadata {ver:1, seq:<该文件最大 seq>, val:{blank:false, lastPromptAt:<ms>}}` 与 `titleInput {ver:3, seq:<同>, val:{first:{seq:<事件seq>, text:<首句>}, count:1, lastSeq:<同>}}`，写前备份 `.bak-blank-<时间戳>`、写后回读校验类型；③脚本：`C:\Users\qianz\.dsh\tools\fix-session-blank.mjs`。

## 13. 自动升级死循环：跳过写盘把「今天已升过」冲掉（高）

**我干了什么**：10 月给 `C:\Users\qianz\.dsh\autoupdate\update-agent.mjs` 加过两道门（日历日 `lastUpdateDay`、市场 busy 检查），但没检查 `writeState()` 在「跳过」分支的行为，也没做失败记忆。

**后果**：日志 `C:\Users\qianz\.dsh\autoupdate\log\2026-10-25.log` 里出现稳定四步循环——`start: daily run (今天第一次)` → `planned 2` → `FAIL … skin-maid-atelier … state=running` → `abort remaining 1: market busy` → `done: ok 0, failed 1` → 下一 tick `skip: market busy`（**这次 skip 把 `lastUpdateDay` 覆盖掉了**）→ 再下一 tick 又「今天第一次」。一天的 13:47/14:02/14:16/14:36 四次原样重演，永远 ok 0。

**根因（三个叠加）**：
1. `writeState()` 只在 `outcome` 为 `done`/`nothing` 时写 `lastUpdateDay`；`skipped` 分支整份覆盖 state.json ⇒ 日历日标记丢失。**这是死循环的引擎**。
2. 市场 `/updates/summary` 对 npm 源整体漏报（实测只报 2 个 github 皮肤，而 npm 上真实有 13 个新版），且两个皮肤被解析成**同一个 commit**（`dshm_outdated` 对它们报「网络错误」）⇒ 唯一被计划的恰好是两个升不动的包。
3. 单包失败后下一轮 `gates()` 撞到 `market busy`（失败操作会把市场留在 busy 几分钟）就 `break`，整批放弃。

**修法（已落地，备份 `.bak-20261025-loopfix` / `.bak-npmdiff-*`）**：
- 跳过分支也继承已有 `lastUpdateDay`（`else if (!payload.lastUpdateDay)` 段读旧文件）。
- 升级计划改成 **市场 summary ∪ npm registry 对差**（`npmOutdated()`，并发 6，`registry.npmjs.org/<enc>` 取 `dist-tags.latest`，只处理 profile `dependencies` 里能解析成 semver 的条目 ⇒ `github:`/`file:` 源自动排除）。
- 失败记忆 `failedEver` + 当日 `failedDay`：`state.json` 持久化，同一包失败 ≥3 次进 `QUARANTINE`（日志显式写 `QUARANTINE <pkg>`）；`state=running`/`PLUGIN_RUNNING`/`in use` 视为**结构性失败**，第一次就隔离（宿主在跑时它永远升不成功）。
- 瞬时状态（`market busy`/`host not ready`/`status unreadable`）改为 `waitGates()` 退避重试 7×30s，其余失败只记录不中断整批。
- `--retry-failed` 解除当日黑名单；`--no-npm` 关掉 npm 对差。

**判据**：① 任何「每天一次」的限流标记，**跳过分支也必须把它继承到新 state**，否则限流等于没有；② 计划来源只有一个上游时，先验证这个上游本身可信（这次是市场漏报 + 把两个包指向同一 commit）；③ 「失败后立刻整批放弃」+「无失败记忆」= 无限重试，两者必须同时修。

## 14. node 18+ 不允许直接 spawn `.cmd`（中）

- **现象**：`execFileSync("C:\Users\qianz\.dsh\tools\bin\ffprobe.cmd", [...])` 抛 `Error: spawnSync …ffprobe.cmd EINVAL`（`errno: -4071`），stderr 里 `status: null, pid: 0`，看起来像「文件不存在」其实不是。
- **根因**：CVE-2024-27980 之后 Node 不允许不经 shell 直接执行 `.cmd`/`.bat`。
- **判据**：脚本里调 ffmpeg/ffprobe 这类包装脚本时，**直接解析真 `.exe` 路径**（本机 `…\WinGet\Packages\Gyan.FFmpeg_…\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe`），并用 glob 兜底版本目录；只有给人双击的 `.cmd` 才保留 `.cmd` 形态。

## 15. 把「文件还原器」当急救器宣传（极高，2026-10-25）

**我做错了什么**：`DSH急救`（restore-dsh.ps1）只会还原文件，我却当成"打不开就找它"。这次打不开的真实原因是登录 cookie 累积到 71 条、Cookie 请求头 16,754 字节超过 Host 的 16 KiB 上限 → 431 → `desktop welcome: Web authentication failed`。它一条都治不了：它要求先关掉 DSH（打不开时进程还活着、cookie 库被独占锁，实测 `unable to open database file`），备份里没有 cookie 库，也没有 `session_projcache`，第 1 项"体检"只查 json 能否解析。

**后果**：用户在最需要的时候点了一个没用的按钮，最后靠另一个 agent（Cherry Studio）手工清 cookie 才修好。备份本身没坏，是我的**能力边界描述**错了。

**判据**：
1. 急救程序第 1 步必须是**诊断**，并按真实故障概率排序：登录 cookie 条数 → 进程能否握手 → 插件层是否被重置 → 配置文件语法。不能只查配置文件。
2. 急救必须能在"进程还活着"时动手（先结束进程再解锁），否则永远死在第一步。
3. 一次性凭据要在**启动前**清（`dsh-launch.ps1` 每次启动前跑 prune），不要等它攒爆再救。
4. 备份清单要按**用户能感知的现象**逐条对齐：「左侧会话不见了」存在 `storages\session_projcache`，不在 `sessions`。
5. 对外说"这个能救命"之前，先问自己：**它救的是哪一类故障？另外几类它管不管？** 管不了就直说。
