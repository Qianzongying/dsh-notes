# 本机 DSH 环境快照

> 记录时间：2026-10-15
> DSH 版本：`0.2.0-rc.2`
> 配置位置：`~/.dsh/profiles/desktop/package.json`（字段 `dsh.profile.bundles` 是启用列表）

## 已装插件（24 个）

### 一、界面与入口

| 插件 | 版本 | 作用 |
| --- | --- | --- |
| `dsh-better-sidebar` | 0.26.0 | 原生右侧栏，底部工作台 |
| `@michengai/dsh-codex-ui` | 1.1.38 | 左侧导航、工作区会话树、全局搜索 |
| `@linxin666/dsh-remote-web-ui` | 0.4.6 | 手机扫码远程访问 Web UI |
| `dsh-whale-widget` | 0.4.2 | 余额与用量显示 |

> 三个界面插件各管一块：右侧栏 / 左侧导航 / 远程访问，**互补不冲突**。

### 二、上下文与费用

| 插件 | 版本 | 作用 |
| --- | --- | --- |
| `billion-context` | 0.1.197 | 上下文压缩 |
| `dsh-context` | 0.71.0 | 上下文洞察：KPI、token/费用趋势、热力图 |
| `dsh-cost-meter` | 1.8.26 | 费用统计与配额解析 |

> **压 / 看 / 算钱** —— 三个职责不同，都要留。

### 三、内容生产

| 插件 | 版本 | 作用 |
| --- | --- | --- |
| `dsh-univer-office` | 0.3.7 | Univer 办公套件（表格/文档/幻灯片/数据库/画布） |
| `@tt-a1i/archify-dsh` | 1.0.0 | 架构图、流程图、时序图 |
| `lunheng-article-pipeline` | 19.6.0 | 论衡：多 Agent 深度长文流水线 |

### 四、记忆

| 插件 | 版本 | 作用 |
| --- | --- | --- |
| `dsh-mnemon` | 0.5.29 | 可组合记忆框架：运行时记忆 / 项目档案 / 记忆空间 |

### 五、联网与视觉

| 插件 | 版本 | 作用 |
| --- | --- | --- |
| `dsh-free-search` | 0.8.10 | 搜索增强，24 个引擎 |
| `@liustack/modsearch` | 5.10.6 | 搜索增强，多引擎自动故障转移 |
| `dsh-vision-router` | 3.0.3 | 免费视觉链，识图工具 |

> ⚠️ `dsh-free-search` 与 `modsearch` **抢占同一个网页搜索插槽**，实际生效的是先注册的那个。

### 六、会话、协作与扩展

| 插件 | 版本 | 作用 |
| --- | --- | --- |
| `@michengai/dsh-archive-manager` | 1.0.19 | 会话归档与整理 |
| `@michengai/dsh-im-connect` | 0.1.76 | IM 连接（注意权限范围） |
| `@michengai/dsh-agency-agents` | 1.0.19 | 专家角色召唤 |
| `@michengai/dsh-skills-manager` | 1.1.21 | 技能管理器 |
| `@wxg-prc-cpg/browser-skill-dsh-plugin` | 0.3.3 | 浏览器自动化 |
| `dsh-plugin-marketplace` | 0.5.3 | 插件市场（第二个） |
| `dshmarket` | 1.66.22 | 插件市场（主用） |

### 装了但不在启用列表里

以下 4 个已下载到 `node_modules`，但**没有出现在 `dsh.profile.bundles` 中**，因此不会加载：

| 插件 | 版本 | 说明 |
| --- | --- | --- |
| `@linxin666/dsh-client-ui-skill-explorer` | 0.4.6 | 技能中心（与 skills-manager 功能重叠） |
| `@liustack/modlens` | 3.26.6 | 视觉增强（与 vision-router 重叠；且默认引擎缺失） |
| `@vectorize-io/hindsight-coding-agents` | 0.8.1 | Hindsight 记忆（与 mnemon 的记忆空间重叠） |
| `dsh-plugin-marketplace` | 0.5.3 | 与 `dshmarket` 重叠，留一个即可 |

## 已装技能（20 个）

**办公文档**：`office-docx`、`office-pptx`、`office-xlsx`

**Univer 套件**：`univer`、`univer-sheet`、`univer-doc`、`univer-slide`、`univer-base`、`univer-board`、`univer-embed`、`univer-cross-unit-formula`

**写作与排版**：`chinese-copywriting-guidelines`、`skill-creator`、`lunheng-article-pipeline`、`lunheng-commands`

**图表**：`archify`

**记忆**：`hindsight-coding-agent`

**浏览器**：`browser-skill`

**演示文稿**：`academic-pptx-skill`

**系统诊断**：`diagnose-windows-sandbox-acl`

## 技能目录

| 范围 | 路径 |
| --- | --- |
| 项目级 | `<项目>/.dsh/skills/` |
| 项目级（共享） | `<项目>/.agents/skills/` |
| 用户级 | `~/.dsh/skills/` |
| 用户级（共享） | `~/.agents/skills/` |
| DSH 内置 | 随应用分发，只读 |

## 常用入口速查

| 想做什么 | 去哪里 |
| --- | --- |
| 装 / 卸插件 | 插件市场（`dshmarket`） |
| 管技能、从 GitHub 或 ClawHub 装技能 | 设置 → 技能 |
| 管记忆 | 侧边栏「记忆系统」 |
| 改模型 / 加模型提供商 | 设置 → 模型 |
| 看上下文占用 | `/context` 命令，或 `dsh-context` 页面 |
| 切换搜索源 | `/free-search-engine` 命令 |
