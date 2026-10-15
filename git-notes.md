# Git 常用命令速查

写给自己的备忘。以下命令都在**项目目录里**执行。

## 先理解四个区域

```
工作区            暂存区            本地仓库          远程仓库
（你改的文件） → （git add）  → （git commit） → （git push）
                                          ← （git pull）
```

| 区域 | 是什么 |
| --- | --- |
| **工作区** | 磁盘上你正在编辑的那些文件 |
| **暂存区** | 这次提交「打算包含哪些改动」的待办清单 |
| **本地仓库** | 隐藏的 `.git` 目录，所有提交历史存这里 |
| **远程仓库** | GitHub 上的那一份 |

关键点：**`git add` 和 `git commit` 是两步**。`add` 是"我打算提交这些"，`commit` 才是真正存档。

## 日常最常用的 6 条

| 命令 | 作用 |
| --- | --- |
| `git status` | 看当前有哪些改动。**不确定时先敲它** |
| `git add .` | 把所有改动加入暂存区（`.` 表示当前目录全部） |
| `git commit -m "说明"` | 生成一个存档点，`-m` 后面是说明 |
| `git log --oneline` | 看历史，一行一条 |
| `git push` | 把本地提交推到 GitHub |
| `git pull` | 把 GitHub 上的新内容拉下来 |

## 只提交部分文件

```powershell
git add README.md            # 只暂存这一个文件
git add src/                 # 只暂存这个目录
git add -A                   # 全部（包括删除操作）
```

## 查看改动内容

```powershell
git diff                     # 工作区 vs 暂存区（还没 add 的改动）
git diff --staged            # 暂存区 vs 上次提交（已 add、准备提交的）
git log -3                   # 看最近 3 条提交的完整信息
git show HEAD                # 看最近一次提交具体改了什么
```

## 撤销

| 场景 | 命令 |
| --- | --- |
| 改乱了，想丢弃**未 add** 的修改 | `git checkout -- 文件名` |
| 已经 add，想撤出暂存区（保留改动） | `git restore --staged 文件名` |
| 提交说明写错了（还没 push） | `git commit --amend -m "新说明"` |
| 想看某次提交的哈希 | `git log --oneline` |

> ⚠️ `git reset --hard` 会**真正删掉**未提交的改动，新手期先别碰。

## 分支

```powershell
git branch                   # 列出本地分支（当前分支前面有 *）
git switch -c 新分支名        # 新建并切换
git switch main              # 切回 main
git merge 分支名             # 把某分支合并进当前分支
```

## 远程

```powershell
git remote -v                # 看远程仓库地址
git push -u origin main      # 第一次推送时绑定上游，之后直接 git push
git clone 地址               # 把别人的仓库完整拷到本地
```

## 第一次使用要先配置身份

```powershell
git config --global user.name  "你的名字"
git config --global user.email "你的邮箱"
```

**每次提交都会记录这两个信息，并且公开可见。** 想保护隐私可以用 GitHub 提供的匿名邮箱（在 GitHub 的 `Settings → Emails` 里能看到，形如 `12345678+用户名@users.noreply.github.com`）。

## 实用小配置

```powershell
git config --global init.defaultBranch main   # 新仓库默认分支叫 main
git config --global core.autocrlf true        # Windows 换行符自动处理
git config --global core.quotepath false      # 中文文件名正常显示，不转义
git config --global pull.rebase false         # pull 时用 merge 而非 rebase（新手更直观）
```

## 遇到问题怎么办

- **`git status` 是最有用的命令**，它会告诉你当前处于什么状态、下一步能做什么。
- 卡住了先敲 `git status`，再决定。
- 报错信息直接复制去搜，Git 的报错通常写得很具体。
