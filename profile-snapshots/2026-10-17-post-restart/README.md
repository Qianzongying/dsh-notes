# 2026-10-17 post-restart 快照

重启优化（关 dsh-builtin-browser、卸 4 个包、清磁盘、装 Mnemon CLI）之后的**实际线上状态**。
与 post-optimize 快照的差异：desktop-cordis.patch.yml 被应用自行改写，追加了 mnemon 插件自己的配置块
（remoteAccess: read-only / persistenceStrategy.providerId: mnemon-native / 阈值与召回参数等），
没有恢复任何悬挂补丁条目，也没有重新启用 browser-electron / tool-browser（两者仍 disabled: true）。

回滚：把本目录 4 个文件复制回原位（desktop 三个到 C:\Users\qianz\.dsh\profiles\desktop\，headless 一个到
C:\Users\qianz\.dsh\profiles\headless\），然后完整重启 DSH。
