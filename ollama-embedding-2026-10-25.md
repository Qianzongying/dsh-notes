# Ollama + 本地嵌入（语义记忆）上线账本 — 2026-10-25

## 为什么做

Mnemon 的记忆检索原本只有关键词匹配（`embedding.enabled: false`），
"记过却找不到" 属于这类。开启本地嵌入后，检索可以走向量语义匹配。

## 装了什么

| 项 | 值 |
|---|---|
| Ollama | 0.40.11（winget `Ollama.Ollama`，静默安装） |
| 程序目录 | `C:\Users\qianz\AppData\Local\Programs\Ollama\`（`ollama.exe` / `ollama app.exe`） |
| 嵌入模型 | `nomic-embed-text:latest`（274 MB，768 维） |
| 模型目录 | `C:\Users\qianz\.ollama\models` |
| 服务端口 | `http://127.0.0.1:11434`（实测 `/api/version` = 0.40.11；`/api/embed` 返回 768 维向量） |
| 显卡 | 无 NVIDIA GPU（`nvidia-smi` 不存在）⇒ CPU 推理；嵌入模型很小，CPU 足够 |

## 改了什么配置

`C:\Users\qianz\.dsh\profiles\desktop\cordis.patch.yml`，`- id: mnemon` 的 `config.embedding`：

```yaml
embedding:
  enabled: true                      # 原为 false
  endpoint: http://localhost:11434   # 不以 /v1 结尾 ⇒ 走 Ollama 原生协议 /api/embed
  model: nomic-embed-text
```

- 备份：`cordis.patch.yml.bak-embedding-20261025-135513`
- YAML 解析校验通过（node `yaml` 模块解析，`embedding = {enabled:true,...}`）
- **改完必须完全退出 DSH 再重开**（cordis.patch.yml 不热重载）

## 重启后还要做一步：补齐已有记忆的向量

已有 47 条记忆是在没有嵌入服务时写入的，**没有向量**，语义检索查不到它们
（关键词/链接/时间衰减仍能召回）。补齐入口在 Mnemon 的设置页：

设置 → 记忆系统 → 本地向量嵌入 → **测试状态** → 点「补齐」

## 回滚（三步，任选其一）

1. **只关嵌入**：把 `enabled: true` 改回 `false`，重启 DSH。记忆与向量数据不受影响。
2. **彻底回到没有 Ollama 的状态**：先关嵌入（第 1 步）→ `winget uninstall Ollama.Ollama` → 删 `C:\Users\qianz\.ollama\models`（274 MB）。
3. **配置层面**：`copy /Y cordis.patch.yml.bak-embedding-20261025-135513 cordis.patch.yml` 再重启。

## 已知代价

- 磁盘：274 MB 模型 + 程序本体
- 内存：Ollama 常驻（空闲时占用很低，推理时几百 MB）
- 开机自启：Ollama 装完默认随托盘启动（`ollama app.exe`）；不想常驻可退出托盘
- 每轮对话的 token 不会因此增加（嵌入只在记忆读写时用）
