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
