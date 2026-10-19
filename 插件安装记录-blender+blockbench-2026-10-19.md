# 插件安装记录：dsh-blender-plugin v2.2.0 + blockbench-ysm-agent v0.4.0

日期：2026-10-19 18:35–18:50（Asia/Shanghai）· 会话：当前会话
前置：Blender 5.2.2 LTS（portable，D:\Apps\blender-5.2.2-windows-x64）已于同日装好；本机无管理员权限。

## 0. 兼容性结论

| 检查项 | Blender 插件 | Blockbench 插件 | 冲突？ |
|---|---|---|---|
| 端口 | 9876 addon / 9877 http / 9879 worker | 随机（`server.listen(0)`） | 否 |
| 包名 | `@dsh-external/dsh-blender-plugin` | `@local/dsh-blockbench-agent` | 否 |
| 宿主进程 | Blender 5.2.2（已装） | Electron 43.4.0 + BAE（自带 fork 的 Blockbench） | 否 |
| 工具数 | 16 | 30 | 合计 46 个进每轮固定前缀（首次约 +8–10K tokens，缓存后便宜） |
| 技能名 | `blender-modeling`（bundled，rank 600） | `blockbench-ysm-artist`（skills/*.md） | 否 |
| 重启要求 | 是 | 是 | — |

**结论：兼容，可并存。** 但两个 GUI 宿主（Blender ~570MB / BAE ~550MB）同时挂会吃内存，建议按需只开一个。

## 1. 落盘清单

| 对象 | 路径 | 说明 |
|---|---|---|
| Blender 插件包 | `C:\Users\qianz\.dsh\profiles\desktop\node_modules\@dsh-external\dsh-blender-plugin` | 161 文件，解自 release tgz（sha256 0739d566…6034 校验一致） |
| Blender 插件配置 | 包根 `dsh-blender.config.json` + `C:\Users\qianz\.dsh\dsh-blender.config.json` | blenderExe=`D:\Apps\blender-5.2.2-windows-x64\blender.exe`；workDir=`%LOCALAPPDATA%\dsh-blender-rt`；9876/9877 |
| Blender 侧 addon | `%APPDATA%\Blender Foundation\Blender\5.2\scripts\addons\dsh_blender_bridge.py` | 已 `addon_utils.enable(...)` + `save_userpref()`，`ADDON_ENABLED=True` |
| BB 插件包 | `…\node_modules\@local\dsh-blockbench-agent` | 9 文件（index.js 30 工具 + ws-server + client.js + skill） |
| BB 插件配置 | 包内 `cordis.patch.yml` | workspaceRoot=`D:\蓝鲸deepseek工作区`，project=`bb-models`，autoStart=**false** |
| BAE 运行时 | `D:\Apps\bb-agent\bb-agent-app` | 190 文件，GPL-3.0 构建产物（Blockbench 5.2.2 fork，含预构建 dist + node_modules） |
| Electron | `D:\Apps\bb-agent\electron\electron.exe` | **43.4.0**（Blockbench 5.2.2 devDep `^43.4.0`），137.7MB zip 解压 215MB |
| BB 模型工作区 | `D:\蓝鲸deepseek工作区\bb-models` | 新建，`workspace = workspaceRoot/project` |
| 安装包留档 | `D:\Apps\_dl\plugins\{dsh-blender-plugin-2.2.0.tgz,bb-agent-0.4.0.zip}`、`D:\Apps\_dl\electron\…zip` | — |

profile `package.json` 改动（2 处）：dependencies 加两条 `file:./node_modules/…`；`dsh.profile.bundles` 末尾加两个包名。

## 2. 已做验证

| 项 | 结果 |
|---|---|
| Blender 插件后端自启 | ✅ `curl 127.0.0.1:9877/doctor` 有响应（插件已被宿主加载，后端在跑） |
| Blender addon 启用 | ✅ `ADDON_ENABLED=True`（离屏 save_userpref） |
| BB 插件 / BAE 语法 | ✅ `node --check` main.js、bb-agent-bridge.js 通过 |
| BAE 启动 | ✅ Electron 43.4.0 拉起 BAE 存活 14s（4 进程 ~550MB），已杀 |
| 两插件 ESM 解析 | ⚠️ 独立 `import()` 报 `Cannot find package '@deepseek-ai/dsh-tools'` —— **正常**：peer 依赖由宿主 app.asar 提供，解析阶段已过（不是 SyntaxError） |

## 3. 待验收（须完全退出 DSH 并重开）

```powershell
# A. Blender 链：ok=true 需要 Blender GUI + addon 已 Connect
curl.exe -sS http://127.0.0.1:9877/doctor
# 首次用 blender_viewport(op="launch") 一键拉起（约 11s 自动 Connect）

# B. Blockbench 链
/bb-start      # 然后 bb_session_start
/bb-status
```

⚠️ doctor 当前 `blenderExe` 解析成 `C:\Users\qianz\.dsh\tools\bin\blender.cmd`（auto:path），因为配置在插件启动后才写完 —— **重启后应读到我写的 config，解析为 D:\Apps\blender-5.2.2-windows-x64\blender.exe**；若仍是 .cmd，就把 `DSH_BLENDER_EXE` 环境变量设成上面的 exe（.cmd 包装会多一层 cmd.exe，launch 子进程可能失败）。

## 4. 已知限制

- **YSM 游戏内验证跑不了**：需要 Minecraft + Forge/NeoForge + YSM 模组 + **Java 17/21**；本机只有 Java 1.8.0_461，`.minecraft` 只有 cache、mods=0。插件本身可用（建模/贴图/动画/无头渲染），只是最后一环缺席。
- BB 插件建仓 2026-10-18、2★、license 字段 NOASSERTION（插件部分是 MIT，BAE 是 GPL-3.0 派生），属于热乎的个人项目，升级前先看 release。
- Blender 插件宣传稿数字漂移（15 工具/183 op vs 16 工具/186 op），以 release README 为准。

## 5. 回滚（4 步，全部可逆）

```powershell
$prof='C:\Users\qianz\.dsh\profiles\desktop'
# 1) 从 package.json 删掉两个 deps 行 + bundles 末尾两行
# 2) 删包目录
Remove-Item "$prof\node_modules\@dsh-external\dsh-blender-plugin" -Recurse -Force
Remove-Item "$prof\node_modules\@local\dsh-blockbench-agent" -Recurse -Force
# 3) 删配置 / addon / 运行时
Remove-Item 'C:\Users\qianz\.dsh\dsh-blender.config.json'
Remove-Item "$env:APPDATA\Blender Foundation\Blender\5.2\scripts\addons\dsh_blender_bridge.py"
Remove-Item 'D:\Apps\bb-agent' -Recurse -Force
# 4) 重启 DSH
```
