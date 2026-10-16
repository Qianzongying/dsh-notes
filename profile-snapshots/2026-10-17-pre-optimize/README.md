# profile 快照：2026-10-17 优化前

在「DSH 全面优化」动手之前，把 desktop / headless 两个 profile 的配置原样冻结在这里。

| 文件 | 对应 |
|---|---|
| desktop-cordis.patch.yml | C:\Users\qianz\.dsh\profiles\desktop\cordis.patch.yml |
| desktop-package.json | C:\Users\qianz\.dsh\profiles\desktop\package.json |
| desktop-pnpm-workspace.yaml | C:\Users\qianz\.dsh\profiles\desktop\pnpm-workspace.yaml |
| headless-cordis.patch.yml | C:\Users\qianz\.dsh\profiles\headless\cordis.patch.yml |

回滚方式：把对应文件复制回原位，然后完整退出并重开 DSH（cordis.patch.yml 不热重载）。
被卸载的包要单独装回来：dsh.cmd plugin --profile desktop add 包名@版本。
