# B 机（LENOVO 21LF / QIAN\qianz）· 环境事实与 DSH 使用经验

> 来源：`D:\蓝鲸deepseek工作区\_migrate\extract\` 下的会话抽取文本（9 个大文件 + 32 个子代理片段）。
> 规则：只保留「机器环境 / DSH 机制与经验 / 插件技能排障 / 用户偏好」；路径、版本、命令、报错原文、URL 逐字保留；原文没写的标「未确认」。
> 已排除：英语外教课程（51Talk 课件解析）与医学题目（胸腔积液语颤）等业务数据，仅在 §6 各留一行。

---

## 1. 本机硬件 / 系统事实

### 1.1 主机与系统基线（实测于 2026-10-15）

| 项目 | 实测值 |
|---|---|
| 操作系统 | `Microsoft Windows 11 家庭版 中文版 10.0.26300 (Build 26300)`，DisplayVersion **26H2**，UBR **9711**（预览版通道） |
| 制造商 / 型号 | **LENOVO / 21LF** |
| 安装时间 | `02/01/2025 21:13:33` |
| 内存 | **27.8 GB**（`TotalRAM_GB = 27.8`）；内存压缩仅 893 MB |
| 系统盘 | `SAMSUNG MZAL81T0HDLB-00BL2`，SSD / NVMe / 954GB / HealthStatus Healthy |
| 分区 | `C: Windows-SSD` 500GB（剩 122GB，24%）；`D: Data` 451.6GB（剩 112.7GB，25%） |
| 快速启动 | `HiberbootEnabled = 1`（已开启，不必再关） |
| 页面文件 | `C:\pagefile.sys` 1792MB，`AutomaticManagedPagefile = True` |
| TRIM | `NTFS DisableDeleteNotify = 0`、`ReFS DisableDeleteNotify = 0`（正常） |
| 当前用户 | `QIAN\qianz`，`管理员权限: False` → 读 `Microsoft-Windows-Diagnostics-Performance/Operational` 报「尝试执行未经授权的操作」（该通道实测 `enabled: true`，是权限而非被禁用） |
| 执行环境 | 只有 Windows PowerShell **5.1.26100.9711**（`C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe`），**pwsh 不存在**（`pwsh 存在: False`）；ExecutionPolicy：CurrentUser = `RemoteSigned`，其余 Undefined |

**PowerShell 5.1 相关的坑（可复用）**

1. 提权找不到 pwsh：`Start-Process : 由于出现以下错误，无法运行此命令: The system cannot find the file specified。` → 改用 `powershell.exe`。
2. 中文写进 `.ps1` 会被 5.1 解析失败：`ParserError … UnexpectedToken`（`+ "`n=== 这些通道是否被禁用（常见于"优化/隐私"工具） ==="`）→ 提权脚本一律写成纯 ASCII。
3. 提权进程输出是 UTF-16，`read` 工具报 `Error: cannot read "D:\蓝鲸deepseek工作区\boot-tune-output.log": binary file` → 先 `Get-Content -Encoding Unicode -Raw` 转 UTF-8。
4. 脚本里 `Get-Service -Filter "Name='$n'"` 的变量插值在 5.1 下被吞 → 过滤串为空、匹配不到任何服务（表现为「not found, skip」的假成功）→ 改用注册表 `HKLM:\SYSTEM\CurrentControlSet\Services` 直读 + `sc.exe config`。
5. `Set-ItemProperty` 静默失败（第一版脚本的 `bootTuneBackup_*` 备份项复核时为 0）→ 备份要落在脚本自己写的 JSON 账本里，不要以为注册表有备份。
6. 递归测目录大小：`Get-ChildItem -Recurse | Measure-Object Length -Sum` 在 C 盘根目录会超 120s 被转后台任务；`robocopy <path> C:\__nul__ /L /S /NJH /BYTES /XJ` 快得多，但首次解析正则写错会全部返回 0 GB（必须用 `Bytes\s*:\s+(\d+)`）。

### 1.2 开机慢：原因与已做处置

**判定的元凶**

- **两个 boot 型驱动**（`Start=1 Type=1`，早于服务与登录加载，**禁用服务无效**）：
  - `ACE-BOOT : State=Running StartMode=System` — `C:\Program Files\AntiCheatExpert\ACE-BOOT.sys`，版本 `1.0.2606.17242`，公司 `ANTICHEATEXPERT.COM`，1969KB
  - `vgk : State=Running StartMode=System` — `C:\Program Files\Riot Vanguard\vgk.sys`，版本 `1.19.1-18+20261001.143443`，公司 `Riot Games, Inc.`，**107150KB**
  - 处置建议：不玩对应游戏就直接卸载（Riot Vanguard / AntiCheatExpert）。
- **登录触发的第三方计划任务**（开机抢 I/O、联网查更新会堵住后续启动项）：
  `QQBrowser Updater Task(Core)`、`QuarkUpdaterTaskUser1.0.0.21{A6DB9AFF-F9CD-40D3-BCAB-9B9DEE659167}`、`WpsUpdateLogonTask_qianz`、`WpsWakeWnsLogonTask`、`LaunchDouyinGuard`（`\DouyinUser\DouyinGuard\`，State=Running）、`OneDrive Startup Task-S-1-5-21-…-1001`。
- **开机必失败的服务**：`XYProtectService`、`KPICService_Web` 在系统日志里反复出现 `Service Control Manager 7000: … failed to start` —— 「启动失败」本身要耗超时时间。
- **自动启动服务总数 110 个**（明显偏多）。
- 启动项（`StartupApproved`）：Wallpaper Engine、dev-sidecar、Steam++、Edge AutoLaunch、OneDrive、Radmin VPN；`LenovoBaiying = 已禁用`。
- 系统是 **26H2 预览版 26300.9711**，自带调试组件与遥测，同硬件下比正式版慢。

**已执行（12 项，用户原话：「禁用 4 个更新器计划任务 + SogouYSSvc/ImController/XYProtect/KPIC，关掉 Wallpaper Engine，关Radmin VPN，如果对系统和数据无影响就直接关」）**

| 类型 | 对象 | 变化 |
|---|---|---|
| 计划任务 | `\QQBrowser Updater Task(Core)` | Ready → **Disabled** |
| 计划任务 | `\QuarkUpdaterUser\QuarkUpdater\QuarkUpdaterTaskUser1.0.0.21{A6DB9AFF-F9CD-40D3-BCAB-9B9DEE659167}` | Ready → **Disabled** |
| 计划任务 | `\WpsUpdateLogonTask_qianz` | Ready → **Disabled** |
| 计划任务 | `\WpsWakeWnsLogonTask` | Ready → **Disabled** |
| 服务 | `SogouYSSvc`（搜狗输入法医生版基础服务，`D:\桌面\SogouYSInput\1.1.0.1278\SogouYSSvc.exe`） | Auto → Manual/Stopped |
| 服务 | `XYProtectService`（`D:\VPN\xunyou\XYProtectService.exe`，文件已不存在） | Auto → Manual/Stopped |
| 服务 | `KPICService_Web`（`C:\Program Files (x86)\Lenovo\SLBrowser\pic\kpicservice.exe`） | Auto → Manual/Stopped |
| 服务 | `ImControllerService`（Lenovo System Interface Foundation） | Auto/Running → Manual/Stopped |
| 服务 | `RvControlSvc`（Radmin VPN） | Auto → Manual（保持 Running） |
| 自启项 | `HKCU\…\Run\WallpaperEngine` = `"D:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper32.exe" -silent` | 已移除 |
| 自启项 | `HKLM\WOW6432Node\…\Run\RadminVPN` = `"C:\Program Files (x86)\Radmin VPN\RvRvpnGui.exe" /minimized` | 已移除 |

**提权命令原文（可复用模板）**

```powershell
$args = @('-NoProfile','-ExecutionPolicy','Bypass','-Command',
  "& '$scriptPath' *>&1 | Tee-Object -FilePath '$logOut'")
$p = Start-Process -FilePath 'powershell.exe' -ArgumentList $args -Verb RunAs -PassThru -WindowStyle Normal
```

**回滚账本（关键）**：`C:\Users\qianz\boot-tune-backup\boot-tune-20261015-193904.json` 与 `services-20261015-194006.json`，每项含 `type / name / before / after / time`。回滚示例：

```powershell
Enable-ScheduledTask -TaskName 'QQBrowser Updater Task(Core)'
Set-Service -Name 'ImControllerService' -StartupType Automatic
Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'WallpaperEngine' `
  -Value '"D:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper32.exe" -silent'
```

**明确未动**（留着给用户点名）：`LenovoVantageService`、`LenovoPcManagerService`、`LenovoServiceAS`、`LISFService`、`SLBService`、`QQBrowserUpdateService`、`TxQBService`、`WeType Management Service`、`douyin_performance_service`、`OfficePLUS Service`、`AMD Crash Defender Service`、`ElevocService`。Fn 功能键走独立的 `LenovoFnAndFunctionKeys`，未受影响。

**其它隐患**：`Microsoft-Windows-BitLocker-Driver` Event **24641**「重启时无法检索 BitLocker 卷主密钥」多次出现（建议确认微软账户已备份恢复密钥、管理员跑 `manage-bde -status C:`）；`ROOT\HIDCLASS\0000` 设备处于 Error。

### 1.3 存储测绘与清理

**占用实测**：C: 已用 378GB / 剩 122GB；D: 已用 338.9GB / 剩 112.7GB。

一级目录（GB）：

```
C:  实验室122G内存 129.05 | Users 108.78 | Windows 41.46 | Riot Games 35.22
    Program Files 14.06 | Program Files (x86) 13.02 | ProgramData 5.37
    $Recycle.Bin 4.59 | 外设驱动 0.89
D:  SteamLibrary 165.39 | WeGameApps 62.36 | 桌面 52.07 | Program Files 30.7
    学校 7.93 | 学习 3.74 | Drivers 3.12 | 我的世界MC 2.76 | LenovoSoftstore 2.37
    世界创作 2.21 | BaiduNetdisk 2.14 | $RECYCLE.BIN 1.15 | Deepseek 0.99
```

二级/子目录（GB）：

```
C:\实验室122G内存\2025 CENP-E 发育 116.93 | 佘振宇实验室BPA 9.41 | 佘振宇实验室软件安装 2.71
C:\Users\qianz\AppData\Local 35.65 | AppData\Roaming 18.65 | AppData\LocalLow 0.38
C:\Users\qianz\Downloads 11.93 | Documents 3.42 | Desktop 1.33 | Videos 0.02 | Pictures 0.02
C:\Windows\WinSxS 22.22 | Installer 1.05 | Logs 0.55 | SoftwareDistribution\Download 0.52
C:\Users\qianz\AppData\Local\Temp 0.39
D:\桌面 52.07（软件 46.4 | WPS Office 2.8 | DingDing 1.75 | SogouInput 0.75 | SogouYSInput 0.22）
```

AppData 大户（GB）：`Local\Microsoft 5.97`(OneNote 2.48 / Edge 2.06)、`Local\Programs 5.71`(Quark 4.72)、`Local\AMD 5.35`(DxcCache 3.42 / DxCache 1.76)、`Local\Wooduan 4.98`(Preload 4.94)、`Local\Tencent 1.99`、`Local\pnpm 1.6`、`Local\Quark 1.45`、`Roaming\Tencent 3.16`(xwechat 1.27 / WeChat 0.96 / WeGame 0.72)、`Roaming\kingsoft 2.49`、`Roaming\IQIYI Video 2.15`(LStyle 1.94)、`Roaming\Wooduan 2.03`、`Roaming\duowan 1.7`、`Roaming\.minecraft 1.32`、`Roaming\npm 0.43`。

缓存类：Edge Cache 0.39 + Code Cache 0.29；Chrome 缓存/Code Cache/Service Worker 均为 0；`npm-cache 0.05`、`pip cache 0.05`、`pnpm store 1.6`、`CrashDumps 0.02`；Yarn / NuGet 不存在。

大文件 Top：`Apex …pc_all.opt.starpak` 28.74GB、`pc_roots(01).opt.starpak` 19.44GB、`C:\Riot Games\VALORANT\…pakchunk10-WindowsClient.ucas` 18.89GB、`C:\hiberfil.sys` 11.12GB、`D:\Program Files\Lenovo\FusionEngine\LEmu\LemuHyperv VMs\MEmu\MEmu96-2024051000027FFF-disk2.vmdk` 7.03GB、洛克王国 `pakchunk11-WindowsNoEditor.pak` 6.67GB、`pagefile.sys` 1.75GB。

游戏占用：`SteamLibrary`（Apex 79.21 / CS2 68.9 / DST 4.11 / Terraria 0.75 / tModLoader 0.19 / Wallpaper Engine 0.77）、`WeGameApps\rail_apps\RocoKingdom(2002304)` 61.99GB、`C:\Riot Games`（VALORANT）35.22GB、`D:\SteamLibrary\steamapps\workshop` 9.7GB（其中游戏 ID 1281930 占 7.09GB）、联想 LEmu 模拟器 8.74GB（`MEmuSVC` 已 Stopped/Disabled）。

**可零风险清理（约 10.6GB，已给出清单，未见用户逐项批复）**

- C 盘回收站 4.59GB（内含 `$RVSKXH3.downloading` 2.2GB、`$RXOBT1R.mp4` 1.86GB）、D 盘回收站 1.15GB
- Downloads 里一年以上未动的安装包约 3.5GB（`VALORANT_CN_installer_v2.8.4.268.exe` 0.41GB、`Quark_V1.6.0.83`、`QQBrowser_Setup_x64`、`MC_setup`×2、`图吧工具箱`、`YYSetup`、`eudic_win` 等）
- 断点残留约 5.1GB：
  ```
  2.20 GB  C:\实验室122G内存\2025 CENP-E 发育\Illustrator_v29.0.zip.baiduyun.p.downloading   (2025-04)
  1.53 GB  D:\学校\入党\深入学习贯彻…三中全会精神.mp4.part                                     (2025-05)
  1.28 GB  D:\学校\入党\深入学习贯彻…三中全会精神.mp4(1).part                                  (2025-05)
  0.14 GB  C:\Users\qianz\Downloads\认真学习党的二十大精神…-刘春.mp4.part                        (2025-05)
  0.00 GB  C:\实验室122G内存\佘振宇实验室BPA\5 双酚S\jf400445n_si_001.pdf.crdownload           (2025-03)
  ```
- Edge 缓存 0.68GB、`SoftwareDistribution\Download` 0.52GB、Temp + D3DSCache 0.62GB

**千万不能删（原文照录）**

```
C:\Windows\Installer          1.05 GB  ← 删了以后程序无法修复/卸载
D:\SteamLibrary\steamapps\common\*      ← 手删会留下损坏的清单
C:\Users\qianz\AppData\Local\pnpm       1.60 GB  ← 开发依赖 store
AppData\Local\AMD\DxcCache              3.42 GB  ← 删了会立刻重新生成（白删）
C:\hiberfil.sys              11.12 GB  ← 用 powercfg /h /size 缩小，别直接删
C:\Windows\WinSxS            22.22 GB  ← 只能用 DISM /StartComponentCleanup
AppData\Roaming\Tencent\xwechat          ← 新版微信数据，是"档案"不是缓存
C:\Users\qianz\Documents\WeChat Files    ← 旧版微信真消息库（0.56 GB）
```

**已实际执行的删除（用户原话：「模拟器我会手动卸载，现在你删除上述其他」）**

- 永久删除（3.37GB）：`D:\VPN\XunYou8.0.exe`(155.09MB)、`D:\VPN\QiYouInstaller_6.6.42_20251223_175535.exe`(124.89MB)、`D:\VPN\xlacc-setup.exe`(118.04MB)、`D:\VPN\xunyou`(空目录)、`…\Roaming\Tencent\WeChat\XPlugin`(976.60MB)、`…\Roaming\IQIYI Video\LStyle`(1989.70MB)
- 移入回收站（7.14GB）：`C:\Users\qianz\AppData\Local\Wooduan\Preload`(5061.0MB)、`C:\Users\qianz\AppData\Roaming\Wooduan\SSJJ-4399`(2078.4MB)
- 结果：C: 121.93 → **124.69GB**，D: 121.45 → **121.81GB**；C 盘回收站 4.59 → **11.56GB**
- 留档：`C:\Users\qianz\storage-cleanup-20261015-210138.txt`（1715B）

**清理项风险取证（已交付，未见执行）**

| 项 | 实测 | 结论 |
|---|---|---|
| 迅游 `D:\VPN` | 共 398MB；`xunyou` 是**空目录**；`XYProtectService` 指向的 exe 已不存在 | 删除风险极低；这也解释了开机事件 7000 |
| `Local\Wooduan\Preload` 4.94GB | 5234 个 GUID 目录、每个含一个 `data` 文件，时间集中 2025-03-15；全盘找不到游戏客户端 | 纯缓存，低风险 |
| `Roaming\Wooduan\SSJJ-4399` 2.03GB | `battle\` 1723MB + `MicroClient64\` 252MB（含 GameGuard 60MB） | **不是"配置"，是游戏资源本体**（上一轮说法已更正），中风险 |
| 旧微信 `Roaming\Tencent\WeChat` 982MB | XPlugin 976.57MB（flue.dll 174.4MB ×2 等）；旧客户端 `3.9.12.55` 仍装但无进程，现用 `Weixin 4.1.15.13` | 纯插件解压缓存，低风险；**消息库在 `Documents\WeChat Files`** |
| 爱奇艺 `Roaming\IQIYI Video\LStyle` 1.99GB | 352 个 `.log` 合计 1966.6MB（qtplog 1859MB） | 零风险 |
| LEmu `D:\Program Files\Lenovo\FusionEngine` 8.74GB | `disk2.vmdk` 7.03GB 是**用户数据盘**，修改 2026-06-06 | **必须走 `…\LEmu\uninstall\uninstall.exe -u`**，手删会留服务与虚拟交换机残留 |

### 1.4 CLI 工具链落点（实测）

| 工具 | 位置 / 版本 | 备注 |
|---|---|---|
| Node / npm | `C:\Program Files\nodejs`（npm 11，会拦截构建脚本，需 `--allow-scripts=pnpm`） | DSH 私有运行时不入 PATH |
| Python | `C:\Users\qianz\AppData\Local\Programs\Python\Python315\python.exe`（winget 包名 `Python.Python.3.13`，实装 **3.15.0**） | 必须插在 PATH 最前，以绕过 WindowsApps 商店占位符 |
| pypdf | **6.20.1** | `pymupdf(fitz)` **不可用** |
| pdftotext / pdfinfo / pdftoppm | `C:\Users\qianz\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin\` | **不在 PATH**，必须写全路径 |
| Tesseract | `C:\Program Files\Tesseract-OCR\tesseract.exe`，`TESSDATA_PREFIX=C:\Users\qianz\tessdata`，`-l chi_sim+eng` 可用 | **不在 PATH**；54 页 150dpi OCR 约 53 秒 |
| Git / gh | Git `2.56.0.windows.2`、GitHub CLI `2.102.0`；gh 已登录账号 **Qianzongying**（token scopes `gist`/`read:org`/`repo`） | 装完需重启 DSH 才继承 PATH |

---

## 2. DSH 机制与使用经验

### 2.1 版本、profile 与配置层级

- DSH 版本 **`0.2.0-rc.2`**（桌面端 `/ desktop` profile）。
- 关键环境变量：`DSH_HOME=C:\Users\qianz\.dsh`、`DSH_PROFILE=desktop`、`DSH_PROFILE_DIR=C:\Users\qianz\.dsh\profiles\desktop`、`DSH_SESSION_ID=<当前会话>`、`DSH_SHELL=1`、`DSH_WEB_URL=http://127.0.0.1:19…`。
- 配置层级（按最后写入者生效）：`~/.dsh/profiles/desktop/package.json` 的 **`dsh.profile.bundles`** 是启用列表 → profile 根 `cordis.yml`（实测为空列表）→ **`~/.dsh/profiles/desktop/cordis.patch.yml`**（用户的补丁层，顶层 YAML 数组，支持 `- id: X` + `disabled: true`、config 覆盖、`insert:` 列表、`!!js` 表达式）。
- 实测补丁片段：
  ```yaml
  - id: agent-default-model
    name: "@deepseek-ai/dsh-agent-default-model"
    config:
      provider: deepseek-account
      model: deepseek-flash
      reasoningEffort: high
  - id: ui-settings
    enabled: false
  - id: hindsight
    disabled: true
  ```
- `.dsh` 目录实测包含：`attachments / cache / code-server / dsh-im-connect / dsh-market / dsh-runtimes / llm-deepseek / logs / profiles / sessions / skills / skills-manager / storages / telemetry / whale-audio / whale-bubble-imgs / .agent-presets / dog / openwrite`。
- **踩坑（重要）**：手写在 `cordis.patch.yml` 的条目可能被 GUI 重写覆盖或丢失 —— 一次「禁用论衡」的记录里，说明注释（`cordis.patch.yml:216-221`）留下了、真正生效的 4 行 `disabled: true` 不见了，表现是技能表里仍列着 `lunheng-article-pipeline`、`lunheng-commands`。**改完必须重启 DSH 并回读文件复核**。

### 2.2 会话存档位置与格式（迁移最需要的一条）

- 主目录：`C:\Users\qianz\.dsh\sessions\<workspace-slug>\<sessionId>\session.v4.jsonl.zstd`
  - workspace slug 是路径转义：`D:\蓝鲸deepseek工作区` → `--D-~84DD~9CB8deepseek~5DE5~4F5C~533A--`；默认工作区 → `--C-Users-qianz-Documents-deepseek-harness-default-workspace--`
  - **注意命名差异**：主会话目录名带 `session-` 前缀（`…\--D-…--\session-c7b0010b-…\`），子代理/checkpoint 会话目录名**不带**前缀（`…\--D-…--\12805586-3f3d-4e10-aaba-69e45a693165\`）。写错会 `ENOENT: no such file or directory`。
- **格式**：zstd 压缩的**多帧** JSONL（magic `0xFD2FB528`，小端字节 `28 b5 2f fd`）。整文件 `zstdDecompressSync` 只能解出第一帧，必须**按 magic 扫描帧边界逐帧解压**再拼接（`_migrate\decompress_sessions.mjs` 就是这么做的）。
- 每行是一个事件对象。首行形如：
  ```json
  {"type":"session","version":4,"id":"12805586-3f3d-4e10-aaba-69e45a693165","createdAt":1792002846475,"cwd":"D:\\蓝鲸deepseek工作区","parentSession":"im:weixin_4a41f03d3973:dm:1792002466481:o9cq80yxW_HkaTr1bRt04kAxCDl4@im.wechat","isSeeded":false,"origin":"subagent","delegationDepth":1,"agentPreset":"standard"}
  ```
  其他事件类型实测：`{"type":"sandbox/mode","seq":0,"time":…,"data":{"mode":"danger-full-access","source":"delegation"}}`、`{"type":"subagent/descriptor","seq":6,…,"data":{"version":3,"mode":"one-shot","provider":"spawn",…}}`。
- **工作区注册表**：`C:\Users\qianz\.dsh\storages\workspace.json`
  ```json
  {"unit":{"name":"workspace","version":2},
   "global":{"initialized":true,"defaultWorkspaceId":"c2b589df-3957-43b6-97ee-980fa0896d85",
             "workspaceIds":["0a284d03-3ba3-412d-99df-bcd8c9408f27","c2b589df-…"],
             "archivedSessionIds":["session-11685a2a-…","session-c7b0010b-…","session-83e0ebbd-…"],
             "pinnedSessionIds":[]},
   "tables":{"workspaces":{"c2b589df-…":{"path":"C:\\Users\\qianz\\Documents\\deepseek-harness\\default-workspace","title":"default-workspace","sessionIds":[…]}}}}
  ```
- 其它 storages：`storages\cost-meter\`（含 `ledger.json` 207006B）、`storages\session_projcache\`、`storages\session_projcache_archive_manager_v2\sessions\session_*.json`（会话投影缓存，含 `tokenUsage` 块）、`storages\vision_router_session_policy\`。
- 会话投影缓存里的 `tokenUsage` 实测字段：`uncachedInputTokens 35956`、`outputTokens 11305`、`cacheReadTokens 520704`、`cacheWriteTokens 0`，另有 `surfaceTokens 26243`。
- IM（微信）会话也是**普通 DSH 会话**：id 形如 `im:weixin_4a41f03d3973:dm:1792002466481:o9cq80yxW_HkaTr1bRt04kAxCDl4@im.wechat`，同样落盘（**含 reasoning**），照常计费；在桌面端它在「**频道**」页签而不是「任务」列表里，所以原对话框看不到。IM 桥配置在 `C:\Users\qianz\.dsh\dsh-im-connect\`（`channels.json`、`deferred-delivery.json`）。

### 2.3 子代理（delegation）与会话父子关系

- 子代理是**独立会话**，有自己的 session id（在 bili 面板里显示为 `<父会话id>|sub:1ee45271ed060930` 形式），字段 `origin:"subagent"`、`parentSession:"<父会话 id 或 IM 会话 id>"`、`delegationDepth`、`agentPreset`。
- 子代理会话同样在 `…\sessions\<workspace-slug>\` 下平铺存放（共 32 个 10–17KB 的小片段即此类），因此可以从父会话追溯到子会话。
- 子代理的权限范围在启动时固定、**不可在子会话内放宽**；实测事件 `{"type":"sandbox/mode","data":{"mode":"danger-full-access","source":"delegation"}}` 说明沙箱模式可由 delegation 继承/注入。
- 子代理常见用途（本机实测模式）：**mnemon 记忆维护**——每个完成回合由子代理做一次 checkpoint，用 `mnemon_document_search` 查重后 `mnemon_document_create` 落一份项目文档，最后用 `mnemon_subagent_result`（带 `requestId`）回报；若无新增可复用知识则返回 `skipped`。
- 另有 `workflow` / `subagent` / `subagent_fork` 工具，fork 型子代理继承已完成回合的上下文。

### 2.4 上下文压缩（compaction）

- 压缩引擎是插件 **`billion-context` 0.1.197**（「📦 压缩块」机制）：把旧消息折叠成模型自写的摘要块，配合 `compress` / `decompress` / `search_context` / `acp_status` 工具。
- 折叠完成标记实测原文：
  ```
  [Compressed m01204–m01333, m01231–m01235, … → 4 block(s), ~51573 tokens saved.]
  [Compressed m00001–m00216, … → 8 block(s), ~216604 tokens saved. Excluded 3 message(s) carrying unrecoverable media (remote URL / file references with no stored bytes) from compression range — folding would destroy them permanently (billion-context#1188/#2609). Inline images fold normally and stay restorable via decompress({ imageRef }).; Withdrawn 5 message(s) … to keep 2 turn(s) and 3 tool call/result pair(s) intact …; Excluded 1 protected message(s) m00775 from compression range (recent/last-user zone) …]
  ```
- 要点：① 携带不可恢复媒体的消息会被排除；② 最新用户区（recent/last-user zone）受保护；③ 内联图片可正常折叠、用 `decompress({ imageRef })` 还原。
- **跨会话/换代的坑（本会话亲历）**：`compress` 的 ref 是「每会话一次分配」的，换模型、中途起新会话实例、或原生压缩 rebase 后 ref 会重置为 m00001。报错原文：
  ```
  [Compression FAILED: None of the 2 requested range(s) resolved — every ref is unknown to this session. …
   range m00100..m00112: startId="m00100" does not exist in this session (typo or wrong session) — run acp_status for current refs.]
  ```
  连续 3 次失败会触发 **COMPRESS CIRCUIT BREAKER**，本会话剩余时间禁止再压缩（本档案会话即如此，只能靠摘要留存）。
- 压缩的**图片卸载**：上下文压缩时 `dsh-compaction-image-offload` 会把旧图换成引用以省 token。

### 2.5 token 与成本

- **两个账本，两套读法**：
  1. `C:\Users\qianz\.dsh\.dshw-usage.json`（余额与扣费事件，whale-widget / cost-meter 用）。实测原文：
     ```json
     {"date":"2026-10-15","lastBalance":7.316378,"todayUsage":0.068573,
      "history":{"2026-10-15":0.068573},
      "events":[{"ts":1792001406695,"day":"2026-10-15","model":"deepseek-flash","cost":0.43114332,"tokens":3363443},
                {"ts":1792002473404,"day":"2026-10-15","model":"deepseek-flash","cost":0.025353,"tokens":22470},
                {"ts":1792002538067,"day":"2026-10-15","model":"deepseek-flash","cost":0.00676044,"tokens":69485}],
      "accounting":{"version":1,"active":"bd52f96396e224bac5369ef6-CNY","books":{"bd52f96396e224bac5369ef6-CNY":{"currency":"CNY","days":{"2026-10-15":{"openingUnits":738495100,"lastUnits":731637800,"debitUnits":6857300,…}},"lastAt":1792002672964}},"migratedAt":1792001653305,"legacyHistory":{}},
      "dayStart":7.384951}
     ```
     同目录还有 `C:\Users\qianz\.dsh\.dshw-usage.json.before-recharge-fix.bak`(179B)、`.dshw-turn.json`。
  2. `C:\Users\qianz\.dsh\storages\cost-meter\ledger.json`（207006B，插件 `dsh-cost-meter` **1.8.26** 的明细账）。
     实测统计：**706 次调用，每次平均 100,924 tokens，缓存读占 93.4%**。
- **缓存命中账（bili 代理，`http://127.0.0.1:18787/__bili/`）**：`/overview` 返回 `sessions 18 / live 7 / requests 393 / inputTokens 34232770 / cachedTokens 32480896 / hitPct 95 / blocks 32 / repayTotal 271823 / missTtlTotal 419512`；`/sessions` 每会话给 `cacheHitPct / newContent / compRepay / ttlRepay / missDropNew / missDropTtl`。三个未命中桶 = 新增内容 + 压缩重付 + 前缀重算（上游 TTL 过期与客户端改写前缀**被归进同一个不可区分的桶**）。
- **命中率是"会话长度与结构"的函数，不是单次质量评分**：18 会话合计 95%；只跑 2–5 次的短会话普遍 49–80%（**第一击必然全价**）。一次实测对比：短会话 37 请求 / 42 万 tok → 88%（其中前缀重算 29,320 tok = 7.0%）；长马拉松 228 请求 / 2827 万 tok → 96%（压缩重付 250,978 = 1.3%，32 次折叠）。
- **提升命中的可操作要点**：快问快答别停 5 分钟（正好踩缓存过期）；大文件/大输出交子代理、主会话只留摘要；**别在会话中途改会被注入历史的东西**（写运行时记忆、启停技能、切模型/供应商都会让插入点之后的前缀重新付费）；尽量别打断重发。
- **常驻开销（工具膨胀）**：实测 **80–100 个工具常驻**、95 个工具 schema ≈ **17k tokens**，按每个工具定义 100–200 token 估，**光工具清单每轮就要约 1 万 token**；系统提示里含 mnemon 协议、专家团、论衡横幅等插件注入段约 **20,000 字符 ≈ 6,000 tokens（约 5%）**。建议关掉不用的重插件（当时指 vision-router / openwrite / lunheng），省约 35 个工具位。
- 反面经验：插件 **`@liustack/modsearch`/`modlens`、`dsh-plugin-marketplace`、`dsh-image-gen`、`dsh-openwrite`、`deep-read-summarize`、`dsh-smart-charts`、`billion-context`、`dsh-context`、`dsh-cost-meter`** 等都在「省 token / 看上下文」这一件事上重叠，装多了出问题分不清是谁的功劳与锅；**技能总量建议 ≤8**（技能正文随每个会话注入上下文）。

### 2.6 权限策略（approval policy / sandbox mode）

- **文件策略 / 沙箱模式**取值实测：`danger-full-access`（完全访问，可任意改文件）与 `workspace-write`（保守预设）。配置里出现在两个位置：`"permission": "danger-full-access"` 与 `"sandboxMode": {"val": "danger-full-access"}`（IM 渠道默认也可能是 `danger-full-access`）。
- **审批（approval）行为**：审批与提问走同一套原生按钮通道（allow once / reject、单选、多选+提交，开放问题保留文本输入）。规则：
  - 审批**始终留在发起任务的会话里，不会回落到 Web**；
  - 提示失败即视为拒绝；
  - **5 分钟内无人批准或拒绝，该动作自动取消**，并告知该会话「没有执行」；
  - 等待审批期间用户发的其它文本只会被提醒先处理审批，**不会当作下一轮提交**。
- 关掉审批弹窗时，需要授权的高危操作会被**直接拒绝**而不是询问；`danger-full-access` 下一般不会弹审批。
- **沙箱的硬边界**：命令沙箱不允许进程「脱离 Job Object」—— 表现是无法自启独立守护进程（如 browser-skill 的 daemon），报 `os error 5`（官方文档措辞：`cannot start an independent Windows daemon; the host may prohibit Job Object breakaway`）。规避：用**受管后台任务前台启动**，生命周期随会话；要长期存活需注册计划任务。
- 沙箱 ACL 拒绝的修复：加载技能 `diagnose-windows-sandbox-acl`，跑它自带的脚本（实测调用）
  ```powershell
  & 'C:\Users\qianz\AppData\Local\Temp\dsh-acl-skill-y1MxHX\scripts\diagnose-windows-sandbox-acl.ps1' `
    -Path 'D:\蓝鲸deepseek工作区' -AllowRoot 'D:\蓝鲸deepseek工作区' -Out 'C:\Users\qianz\dsh-acl-recovery'
  ```
  该技能要求：审批请求用**大白话**写（说清动哪个文件夹、给登录用户补缺失的完全控制、清掉外来包权限项、不改文件内容与所有者、打印回滚命令），且**不要**把错误码、`WRITE_DAC`/`WRITE_OWNER`、`S-1-15-2-*` SID、`icacls`、ACL/ACE、判定名和开关写进请求里。

### 2.7 memory：mnemon / hindsight / 运行时记忆

- **`dsh-mnemon` 0.5.29** 是可组合的三层记忆框架（实测组成）：
  - 3 个 source：`dsh-mnemon-source-documents`、`dsh-mnemon-source-memory-spaces`、`dsh-mnemon-source-runtime`
  - 6 个 strategy：`strategy-auto-capture`、`strategy-default-three-tier`、`strategy-general`、`strategy-light-context`、`strategy-scoped`（等）
  - 9 个 provider：`dsh-mnemon-provider-byterover / hindsight / holographic / honcho / mem0 / mnemon-native / openviking / retaindb / supermemory`
  - 暴露工具：`mnemon_view_route, mnemon_view_action, mnemon_memory_bodies, mnemon_recall, mnemon_related, mnemon_status, mnemon_document_search, mnemon_document_create, mnemon_document_manage, mnemon_runtime_memory, mnemon_remember, mnemon_link, mnemon_forget, mnemon_memory_body_create`（实测「[启用] dsh-mnemon」）
- **两个 Source 不是一回事**：
  - **Documents（项目文档）**：`mnemon_document_search` / `mnemon_document_create`，落盘在 `C:\Users\qianz\.dsh\storages\…\documents\active\*.md`，带 `sourcePaths`、`sessionIds`、`revision`、`contentHash`。**每个执行中 Agent 回合只允许一次 Documents 查询**（并行调用共享同一配额，子代理回合有独立配额）；返回的是「有界证据」，不是完整记录。
  - **运行时热记忆（runtime）**：`mnemon_runtime_memory` 维护注入每轮的紧凑热记忆（USER.md / MEMORY.md 投影），容量满时自动压缩/归档。
- **`@vectorize-io/hindsight-coding-agents` 0.8.1**（🧠 横幅背后）：记忆本身配置在 DSH **之外**的 `~/.hindsight/coding-agent.json`（server URL、token、bank 命名、opt-outs），兼容其他 Hindsight 宿主；实测该文件 **NOT PRESENT → 独立 Hindsight 插件没有服务端/token，未真正挂载**。市场日志里对应 `"@vectorize-io/hindsight-coding-agents: no loader entry matched"`。它自带工具：`hindsight_sync_status, hindsight_diagnose, hindsight_search_knowledge_pages, hindsight_list_knowledge_pages, hindsight_read_knowledge_page, hindsight_reflect, hindsight_capture_initiative, hindsight_ingest_document`（实测状态「[闲置]」）。profile 补丁里另有 `- id: hindsight / disabled: true`。
  启用路径（未确认是否已执行）：建 `C:\Users\qianz\.hindsight\coding-agent.json` 填 endpoint + token + bank，重启 App；或在 `dsh-mnemon` 页面启用 `dsh-mnemon-provider-hindsight`（需 Hindsight endpoint 与 bank scope，凭证留在 Host）。
- **教训**：`dsh-mnemon` 与 `hindsight-coding-agents` 功能重叠，再叠一层第三方记忆技能大概率**两套记忆互相打架**。
- 运行时记忆的**副作用**：写一条热记忆会让 MEMORY.md 快照变化，**插入点之后的每击都要重付前缀**（实测就是那次命中率掉到 88% 的原因之一）。
- 一个环境怪癖：desktop profile 被 Electron 独占，**CLI 无法管理该 profile**。

### 2.8 技能与插件的安装机制

- 技能目录与优先级（源码结论，文件 `@deepseek-ai/dsh-skill-filesystem\lib\index.js:21-25`）：
  ```js
  const PROJECT_DSH_RANK = 100;
  const PROJECT_AGENTS_RANK = 200;
  const CUSTOM_RANK = 300;
  const USER_DSH_RANK = 400;
  const USER_AGENTS_RANK = 500;
  ```
  `@deepseek-ai\dsh-skill\lib\index.js:519-521` 按 rank 升序排序、`:312-320` 同名只留第一个 → **rank 小的赢**。项目技能（100）覆盖用户技能（400），删任一份另一份自动接管。技能目录**热更新，不需重启 DSH**。
  目录速查：项目级 `<项目>/.dsh/skills/`、`<项目>/.agents/skills/`；用户级 `~/.dsh/skills/`、`~/.agents/skills/`；DSH 内置随应用分发、只读。
- 实测规模：`dsh-setup.md`（2026-10-15）记 **24 个插件**；技能一度 21 个（无重复）；bundle 33 个。
- **插件市场**：管理入口「插件市场（`dshmarket`）」，日志 `C:\Users\qianz\.dsh\profiles\desktop\.dsh-market\log.ndjson`（158 行、29100B 时）。安装日志三段式样板：
  ```
  {"event":"install","detail":"dsh-image-gen: pinned to the registry's latest, 0.9.1, so pnpm's fresh-release hold cannot substitute an older version silently"}
  {"event":"install","detail":"dsh-image-gen: the host's own replay activated it; adopted instead of mounting a second copy (#814, #827)"}
  {"event":"install","detail":"dsh-image-gen@0.9.1 exit=0 hot=true"}
  ```
  `hot=true` 即热加载成功。禁用/切换时常见 `: no loader entry matched`。
- **ClawHub 技能库**由插件 `@michengai/dsh-skills-manager` 提供：
  - 榜单 `https://clawhub.ai/api/v1/skills?sort=downloads&limit=10(&cursor)`（**只支持按 downloads 排序、无分类筛选**）
  - 搜索 `/api/v1/search?q=&limit=100`
  - 已装指纹 `C:\Users\qianz\.dsh\skills-manager\repositories.json` 的 `catalogInstalls`（形如 `clawhub:chindden/skill-creator`，逐文件存 sha256）
  - 状态 `C:\Users\qianz\.dsh\skills-manager\state.json`；日志 `C:\Users\qianz\.dsh\dsh-skills-manager.log`
  - 导入 `C:\Users\qianz\.dsh\skills\<name>` 后**默认 `policy-enable`（本地策略启用，源文件不变）**——所以装第三方技能前应先用 `skill-vetter` 审。
- 挑选原则（已交付结论）：只看「通用 CLI + 文件操作」依赖（`gh`、`markitdown`、`ffmpeg`、`obsidian-cli`）；依赖 `openclaw` 命令 / cron automation / lifecycle hook 的**在 DSH 里是废纸，甚至诱导模型调用不存在的工具**；数量 ≤8。

### 2.9 其它运行模型事实

- **DSH 完全在本机运行，没有云端部分**：Agent 循环、工具执行、IM 桥轮询都是本地的 → 电脑关机就不可用。
- 并发：**会话之间并发，会话之内排队**；中途引导命令 `/steer`、`/queue`、`/stop`；`maxParallelToolCalls` 默认 **10**（`1` 为串行，exclusive 调用保持顺序）。相关界面：「插件 → 官方分组 → Agent 循环 → 并行工具调用数」（页面只暂存，保存才写入，可 `恢复默认`）。
- 上下文占用查看：`/context` 命令（或 dsh-context 面板）。
- 模型/提供商：`agent-default-model` 实测 `provider: deepseek-account / model: deepseek-flash / reasoningEffort: high`；IM 渠道也配了 `reasoningEffort: "high"`（见 `C:\Users\qianz\.dsh\dsh-im-connect\channels.json`）——想省 token 可降到 `medium`/`low`。DeepSeek 适配器默认广告 `deepseek-flash`（文本+图片）与 `deepseek-v4-pro`（纯文本），各带 1,000,000 token 上下文；图片**仅输入**、不支持外链 URL、不支持模型输出图片，单请求上限 `maxImagesPerRequest: 600`，超出像素预算会被缩放（`imagePixelBudget`）。
- 运行目录：`D:\Deepseek\resources\run`；应用资源 `D:\Deepseek\resources\app.asar`（115.7MB）+ `app.asar.unpacked\dsh`。
- 已验证的工作区内容（2026-10-15/16）：`.dsh`、`browser-skill-verify`、`demo-图像生成`、`dsh-notes`、`en-course`、`pdf-capability-test`、`stats-capability-test`、`valorant-english-comms`、`word-demo`、`dsh-market-log.txt安装失败日志.txt`(6176B)、`_migrate`。

---

## 3. 论衡（lunheng）

- 包：**`lunheng-article-pipeline@19.6.0`**（另有技能 `lunheng-commands`）。定位：**多 Agent 深度长文流水线，9 个角色、三角验证，适合 ≥2000 字、要证据可追溯的论文/行业分析；3000 字以下的短文别用它**；**一次要跑几小时**（很费 token）。
- 注册内容：**7 个工具**（`lunheng_m_gate`、`lunheng_ethics_sanitize`、`lunheng_char_count`、`lunheng_handoff_check` 等）+ **9 个角色 Agent** + **11 个斜杠命令**，是「最重的插件之一」。（斜杠命令的**具体名称未在本批材料中列出——未确认**。）
- **「论衡开工」= 开工台**：挂在输入框上方的通栏卡片，代码 `C:\Users\qianz\.dsh\profiles\desktop\node_modules\lunheng-article-pipeline\lib\client.js:73` 注册到 `conversation.input.dock` 席位，`:77` `wb.title = '论衡开工'`。本质是一张 **Phase 0 定题表单**，生成结构化开场白**只 `setDraft`、绝不 `submit`**（`:582` 硬约束），因为 P0 开工确认必须本人点头。
  - 字段：项目名（必填，正则 `^[\w\-一-鿿]{1,32}$`，决定 `run/<项目名>/` 路径围栏）、题名（必填）、文类、目标篇幅（默认 8000 汉字）、语言（中文/English/中英混）、文风、素材、配图（默认关）、补充简报。
  - 三个正交授权面（v19.4.0 由旧的 `consent` 4 选 1 拆开，`client.js:393-394`）：**检索**＝全网检索/仅本地素材（唯一真改变流水线行为的一档，选「仅本地」会关掉外部检索工具，取值逐字用模板受控词）、**脱敏**＝`basic`/`strict`、**推理位置**＝面板不给开关也不回显，由本会话 provider 决定，开场白里留占位符逼主控按实际落实（残留 `<…>` 被机检 **A11** 判硬失败，`exit 21`）。
  - 三段合成 `01-任务简报.md` 头部的一条三段式授权串（`检索=` / `推理=` / `脱敏=`），由 `handoff-check --require-gates` 核。
  - 人在环：**四门（P0/P2.5/P3.5/P5）不设可省任一门**；`WB_HITL`（`:435`）的「全自动」不是取消四门，而是**直接采纳各门 `ask_user_question` 的首个推荐项**，仅保留 P0 确认（原文：`（**主人显式授权**：不再逐门提问，**直接采用各门 ask_user_question 的首个推荐项**继续——P2.5 大纲 / P3.5 洞察 / P5 终稿三门均按主控建议自决；仅保留 P0 开工确认；请把逐门替你做的选择写进交付说明，便于回溯）`）。
  - 「↺ 填充上次配置」= `localStorage: lunheng.workbench.last_cfg`。
  - 不用它也行：直接说「用论衡写一篇《…》」同样走 Phase 0，只是字段靠对话补齐。
- **伦理脱敏（H2）实测标记原文**（每次扫描都会在会话里插一段，本身会造成前缀重算）：
  ```
  〔论衡 H2 伦理脱敏〕basic 模式：命中替换 1 处（bankcard=1）；另有**低置信候选 13 个未改写**（姓氏命中但无角色词，实测绝大多数是普通词，须人工确认）；扫描 text 块 1 个、跳过超限块 0 个；改写正文=否；待复核类别：person-low-confidence（明细见 lunheng_ethics_sanitize 工具返回值，本标记不含原文）。需要真脱敏请调用 lunheng_ethics_sanitize 工具，并只把其 text 字段交给下游角色。
  ```
  变体实测：命中类别出现过 `bankcard=1`、`place=1`；低置信候选出现过 **18 个 / 13 个 / 3 个 / 1 个**。关键点：**标记本身不脱敏**，想真脱敏必须调用 `lunheng_ethics_sanitize` 并只把其 `text` 字段交给下游角色。
- **与 DSH 版本不兼容（重要）**：`lunheng-article-pipeline` 自己声明的 peer 范围是 **`>=0.1.2-rc.1 <0.2.0`**，而本机 DSH 是 **`0.2.0-rc.2`**，被排除在外 → 装了但官方不支持，因此被禁用（`cordis.patch.yml` 里 `- id: lunheng-article-pipeline / disabled: true`，另有 3 行 `tool-subagent-*`，包保留在 node_modules 里不卸载）。同批被禁的还有 `modsearch`、`modlens`、`hindsight`、`ui-skill-explorer`、`plugin-marketplace`、`openwrite` 四行、`agency-agents`、`agency-agents-remote`、`wallpaper-engine`。
  硬证据原文：`lunheng 被禁的硬原因是其 peer 范围 >=0.1.2-rc.1 <0.2.0 与本机运行的 DSH 0.2.0-rc.2 不兼容。`

---

## 4. 排障记录（现象 → 报错原文 → 原因 → 解决）

> 判读原则（本机反复验证）：**插件市场里的「AI 解释」是猜测模板，必须以 `.dsh-market\log.ndjson` 的原文为准。**

1. **联网搜索全挂**
   - 现象：所有 `web_search` 调用失败。
   - 报错原文：`configured web provider "modsearch" is not registered`
   - 原因：停用 `@liustack/modsearch` 插件**不会回滚配置行**，`searchProvider` 仍指向它。（日志：`{"event":"toggle","detail":"@liustack/modsearch -> off: fiber=false"}`、`"plugin kept off: @liustack/modsearch"`）
   - 解决：把 `cordis.patch.yml` 的 `web` 行 `searchProvider` 改成可用值（共 178 行、顶层条目 12 个；组合顺序 `dsh.profile.bundles` → `cordis.patch.yml` 覆盖层，按行 id 最后写入者生效），再实跑一次搜索验证。

2. **git 类插件安装失败（`dsh-smart-charts`）**
   - 两次失败。第 1 次报错原文：`github:hherosoul/dsh-smart-charts#0595787f346e53c81d617ce3f86888ebbd58b5d8 exit=1`，市场提示「这个 git 插件需要在安装时执行构建脚本，被 pnpm 默认拦截。点击「允许构建脚本并重试」放行后重试即可」；用户点允许后写入白名单（`event:"approve-builds"`，列表含 `protobufjs, cloudflared, dsh-smart-charts, …`），第 2 次仍 `exit=1`，且**日志里报错文本被截断只剩尾巴**。
   - 真实根因：**pnpm 准备 git 依赖时需要 PATH 上的 `pnpm` 与 `node`，而 DSH 私有运行时不入 PATH**。
   - 解决：在 `.local\bin` 放三个 `.cmd` 垫片。（后续这套垫片在补齐真实 CLI 工具链后被删掉。）
   - 教训：用户贴来的那段「lockfile 与 registry 不兼容 / 网络问题」是市场 AI 的猜测，**不是真实原因**。

3. **桌面端启动崩溃：托盘图标出现但窗口永不打开**
   - 现象：体感像「启动特别慢」，实为 Host 进程在 startup 阶段直接崩溃。
   - 报错：栈里为 **Cordis `INACTIVE_EFFECT`**。
   - 触发条件：**启动后立刻改插件开关**。
   - 相关复现：手写进 `cordis.patch.yml` 的条目**会被 GUI 重写覆盖**。
   - 自检方法：改完补丁后重启并回读该文件核对条目是否还在。

4. **浏览器插件守护进程起不来**
   - 报错原文：`os error 5`（命令沙箱不允许进程脱离 Job Object）。
   - 解决：改用受管后台任务前台启动；重启 DSH 后由插件的 bsk 客户端自动拉起；要一劳永逸可注册开机自启计划任务。

5. **工作区文件权限被沙箱挡住**（连在工作区里写文件、列目录都被挡）
   - 解决：加载 `diagnose-windows-sandbox-acl` 技能，跑它自带的 PowerShell（见 §2.6 的命令），输出目录 `C:\Users\qianz\dsh-acl-recovery`。该技能另收录在 `D:\Deepseek\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-sandbox-windows-acl\assets\diagnose-windows-sandbox-acl\SKILL.md`。

6. **PDF 文字层提取全空**
   - 报错原文：`pdftotext : 无法将"pdftotext"项识别为 cmdlet、函数、脚本文件或可运行程序的名称。…CommandNotFoundException`；`& : 无法将"tesseract"项识别为…`；`Get-Content : 找不到路径"…\t1ocr.txt"`。
   - 原因：两者都不在 PATH（真实路径见 §1.4）；且那批 PDF 是**扫描图无文字层**（`pdftotext` 只输出 9 字符）。
   - 解决：写全路径，用 `pdftoppm -r 150 -png` 渲染 + `tesseract -l chi_sim+eng --psm 3` OCR。
   - 另一处坑：`Copy-Item` 语言包时报 `PermissionDenied: (C:\Users\qianz\…sim.traineddata:FileInfo) [Copy-Item], Unauthorized`。

7. **回收站操作挂死**
   - 现象：PowerShell `Shell.Application` COM 调回收站在**非交互会话里挂住 5 分钟以上**（进度核查显示目标完全没动）。
   - 解决：`pip install send2trash` 后用 Python `send2trash`（15.3s + 3.0s 完成）。可用 Python：`C:\Users\qianz\AppData\Local\Programs\Python\Python315\python.exe`。

8. **`@vectorize-io/hindsight-coding-agents: no loader entry matched`**
   - 原因：该插件的 loader 行未注册（配置文件 `~/.hindsight/coding-agent.json` 不存在）；`dsh-mnemon` 里同一 provider 需要 endpoint + bank 才能用。

9. **市场安装日志里的常见事件**（用于自查，非故障）：`pinned to the registry's latest, X, so pnpm's fresh-release hold cannot substitute an older version silently`、`the host's own replay activated it; adopted instead of mounting a second copy (#814, #827)`、`exit=0 hot=true`、`resolved HEAD through an available china route; downloading the commit-pinned GitHub target directly for pnpm integrity`、`: no loader entry matched`。

10. **`gh auth login` 网页授权**：设备码流程可用；后台任务存在「假死」坑（长时间无输出但并未失败），需自行核对；`gh api` 在 PowerShell 下有引号坑。

11. **本档案会话自身**：连续 3 次 `compress` 失败触发 `COMPRESS CIRCUIT BREAKER`（原因见 §2.4 → ref 换代），本会话之后无法再压缩。

---

## 5. 用户偏好与习惯

- **语言**：全程中文；对中文排版有要求（装了 `chinese-copywriting-guidelines`，规则如中英文之间加空格、中文与数字之间加空格）。
- **成本敏感（反复出现）**：多次在提问里直接给出预算/上限——「token 花费限制在 0.3 元左右及以下」「token花费控制在0.3元左右或者以内」；会主动问「为什么本次对话的命中只有 90％左右，上一次有 96％左右」；对「无意义消耗 token 增多」高度在意，发起过专门的上下文瘦身/迁移任务。
- **先要风险分析、再动手**：典型原话「这些删除，先分析一下风险，其他先别动」「如果对系统和数据无影响就直接关」。默认希望**先只读取证 → 给逐项风险与回滚方式 → 他点头后再执行**。
- **部分事情要自己做**：「模拟器我会手动卸载，现在你删除上述其他」——愿意保留对高风险/不可逆操作（如卸载模拟器）的手动控制权。
- **要可逆与留痕**：接受「移入回收站而不是永久删除」的分档处理；认可写回滚账本/清理记录文件的做法。
- **授权风格**：给过一次性范围授权（如「直接采用各门 ask_user_question 的首个推荐项」，仅保留 P0 确认），不喜欢被逐门反复追问。
- **偏好可复用的脚本与文档**：对「整理成带注释、可直接以管理员身份运行、每步有确认提示的脚本」「留档 txt」明确感兴趣；自己在维护 `D:\蓝鲸deepseek工作区\dsh-notes\`（他的**第一个 Git 仓库**，记录 DSH 环境快照与 Git 速查）。
- **专业背景**：医学生/科研方向（有 `C:\实验室122G内存\` 显微成像数据、CENP-E 发育、BPA 实验文献；关注文献检索与临床统计），同时在学英语（51Talk 课件、`valorant-english-comms` 项目），是重度 PC 游戏玩家（VALORANT / Apex / CS2 / 洛克王国世界 / 我的世界），用联想笔记本 + 微信/飞书等 IM 桥远程用 DSH。
- **常用需求类型**：Windows 体检与优化、磁盘清理、插件/技能安装与排障、PDF/Office 处理、上下文与费用解释。

---

## 6. 已排除项（各留一行）

- `session-8da8d870-…`：51Talk《Classic English V3.0 Level 1》Unit 1 扫描课件的本地 OCR 解析与上课备考（业务内容，已排除；仅取其暴露的工具链事实）。
- `session-57bb73ba-…`：胸腔积液与语音震颤的机制订正（医学业务内容，已排除；仅取 `summon_expert` 工具事实）。

---

## 7. 未确认 / 存疑

- 论衡 **11 个斜杠命令的具体名称**：本批材料只见到数量，未见到清单。
- `dsh-smart-charts` 最终是否安装成功：材料止于第二轮失败与垫片修复思路，未见成功记录。
- `ImControllerService` 关闭后联想增值功能（智能散热/自动更新）的具体影响范围，只有定性描述。
- 启动性能事件 100–110 的真实耗时：**因当前非管理员始终未读到**，需管理员 PowerShell 执行
  ```powershell
  wevtutil sl "Microsoft-Windows-Diagnostics-Performance/Operational" /ca:"O:BAG:SYD:(A;;0xf0007;;;SY)(A;;0x7;;;BA)(A;;0x1;;;BO)(A;;0x5;;;S-1-5-32-545)"
  Get-WinEvent -LogName "Microsoft-Windows-Diagnostics-Performance/Operational" |
    Where-Object Id -in 100,101,102,103,106,109,110 |
    Select-Object Id, TimeCreated, Message | Format-List
  ```
- Hindsight 是否已按建议建 `C:\Users\qianz\.hindsight\coding-agent.json` 并启用：未确认（最后一次实测仍是 NOT PRESENT）。
