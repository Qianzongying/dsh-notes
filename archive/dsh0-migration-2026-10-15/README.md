# dsh0 迁移归档（2026-10-15 产物，2026-10-17 迁入）

这两份报告是 2026-10-15「dsh0 → dsh1」迁移时由两个子代理产出的原始分析：
- A-plugins-skills.md：DSH 插件与技能环境基线（DSH_HOME、profile、bundle 层、已装插件清单）
- B-machine-dsh.md：本机硬件/系统事实、DSH 机制与经验、排障记录、用户偏好、已排除项、未确认项

tools/ 里的 7 个 .mjs 是当时用来批量解压会话转录、提取标题与生成摘要的脚本，
做下一张交接卡时可直接复用（zstd 多帧、pwsh 重定向写成 UTF-16LE 这两个坑见 dsh-handoff 技能）。

其余内容（extract/ raw/ repos/ ccsn-x/、session_summaries.json、session_overview.txt、ccsn.tgz 等）
已于 2026-10-17 移入回收站。
