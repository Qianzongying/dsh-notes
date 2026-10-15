# DSH 学习笔记

个人使用 **DeepSeek Harness（DSH）** 的配置记录与命令速查。

这个仓库同时是我的**第一个 Git 仓库** —— 用来把「本地改文件 → 提交 → 推到 GitHub」这条链路完整走通一次。

## 目录

| 文件 | 内容 |
| --- | --- |
| [dsh-setup.md](dsh-setup.md) | 本机 DSH 环境快照：已装插件、已装技能 |
| [git-notes.md](git-notes.md) | Git 常用命令速查（新手向） |

## 环境快照

| 项目 | 版本 |
| --- | --- |
| DeepSeek Harness | `0.2.0-rc.2` |
| Git | `2.56.0.windows.2` |
| GitHub CLI | `2.102.0` |
| 系统 | Windows · PowerShell 5.1 |

## 这个仓库是怎么建起来的

```powershell
git init
git add .
git commit -m "首次提交"
gh repo create dsh-notes --public --source=. --push
```

四条命令：初始化 → 暂存 → 提交 → **在 GitHub 上创建仓库并推送**。

---

> 快照时间：2026-10-15。配置文件改动后这份记录会过期。
