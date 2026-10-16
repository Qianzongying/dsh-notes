# profile 快照：2026-10-17 优化后

对照 2026-10-17-pre-optimize/ 看这次改了什么。

## 本次改动
- cordis.patch.yml 7,235 B → 4,563 B：删掉 11 条悬挂/重复条目（modlens、hindsight、ui-skill-explorer、plugin-marketplace×2、lunheng-article-pipeline、tool-subagent-retrieval/-strong/-audit、michengai-codex-pet、remote-web-ui），新增 browser-electron 与 tool-browser 的 disabled: true。
- package.json：dependencies 47 → 43（卸掉 dsh-plugin-marketplace、@linxin666/dsh-remote-web-ui、@linxin666/dsh-client-ui-skill-explorer、lunheng-article-pipeline）；dsh.profile.bundles 47 → 46。
- 验证方式：复制 profile 到 audit-desktop（node_modules 用 junction 指向 desktop 的），dsh --profile audit-desktop --dump-config 显示 0 条 'patch: entry "X" not found'，tool-browser / browser-electron 均为 disabled: true。

## 回滚
把 pre-optimize/ 里对应文件复制回 C:\Users\qianz\.dsh\profiles\desktop\，再按下面命令装回包：
  dsh.cmd plugin --profile desktop add dsh-plugin-marketplace@0.5.3
  dsh.cmd plugin --profile desktop add @linxin666/dsh-remote-web-ui@0.4.6
  dsh.cmd plugin --profile desktop add @linxin666/dsh-client-ui-skill-explorer@0.4.6
  dsh.cmd plugin --profile desktop add lunheng-article-pipeline@19.6.6
然后完整退出并重开 DSH（cordis.patch.yml 不热重载）。
