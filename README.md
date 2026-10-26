# Aurora — macOS 网易云内部播放页美化

适配本机官方 **3.1.13 (3451), arm64**，实际在 `/Applications/NeteaseMusic.app` 的 `orpheus://orpheus/app.html` 内加载。使用该版本自带 CEF 调试通道安装本地 CSS/JS；它不是 BetterNCM 的 Mac 移植，也不是另一个播放器。

v0.3 接入官方客户端已有的 YRC 逐词时间和高精度原生播放进度，以 AMLL DOM 渲染器统一实现逐词渐变点亮、长音演出、行间缩放和弹簧滚动。移除了 v0.2 的原生滚动叠加位移。歌词字号调大一档，仅显示原文，隐藏中文译文；同时可见行数取决于句长和换行。没有 YRC 的歌曲回退为行级歌词，不推算或伪造逐词时间。

## 使用

需要 Node.js 22+ 且提供内置 WebSocket（本机实测 Node 25.5.0）。预先打包的歌词引擎已包含在 `plugin/vendor/`，使用时无需 npm 安装或从第三方下载脚本。

1. 如果网易云已从普通图标打开，先按 **⌘Q** 完全退出。
2. 双击 **启动 Aurora.command**，它会启动原来的官方网易云，并把本地插件加载到其界面。
3. 点击底部歌曲封面打开播放详情。左上 **AURORA** 按钮或 **⌘⇧A** 即时切换外观。音频播放、歌曲数据、进度和音量仍由官方客户端处理；插件仅在内部歌词区域渲染歌词。点击自定义歌词也会通过官方播放动作跳转。

启动脚本不需要常驻 Terminal。退出网易云即结束本次插件会话；以后使用启动脚本重新启用。普通应用图标启动会保持原样。仅当前版本通过验证；客户端更新后启动器会拒绝加载，需重新检查选择器和最小方案。

## 回滚

- 点击 AURORA / ⌘⇧A：即时恢复原始外观，可再次切回。
- 双击 **关闭 Aurora.command**：删除样式、背景、开关、自定义歌词，取消帧循环、观察器和原生事件订阅，恢复原始歌词及可访问性属性。
- **⌘Q 完全退出网易云**：关闭临时调试端口，清除内存中的全部插件代码。之后从原应用图标正常打开即可。

不修改官方应用包、资源包、签名、SIP 或 Gatekeeper，也不写用户账户/播放设置，不安装后台服务。测试证据表明退出后端口关闭、二进制/资源 SHA-256 不变且官方签名验证通过。

调试通道监听在 **127.0.0.1:49363**；同一电脑的其他进程可以访问这个会话。因此仅在启用插件时使用，完全退出即可关闭。不能把「关闭样式」等同于「关闭端口」。

## 文件与验证

- `plugin/aurora.css`：封面氛围背景、方形封面、歌词层次、减少动态效果适配。
- `plugin/aurora.js`：内部页面适配、原生音乐时钟与歌词订阅、AMLL 生命周期和完整清理。
- `plugin/lyrics.mjs`：YRC/LRC 解析、翻译对齐、暂停/倍速/跳转时钟。
- `plugin/vendor/`：固定版本 AMLL 0.6.0 打包产物与许可证。
- `scripts/cdp.mjs`：仅连接回环地址且目标限定为官方 app.html。
- `evidence/`（不随仓库发布，仅保存在本机）：本机版本/架构/签名与哈希、最小加载/撤销证据、真实窗口预览和样式版本快照。
- `docs/validation.md`：逐项说明实测范围和限制。

命令行：`npm run status` / `npm run enable` / `npm run disable`。这些命令要求通过启动脚本启动的调试会话已经运行。

修改引擎入口后：`npm ci --ignore-scripts`、`npm run build`。运行 `npm test` 检查时间解析、翻译对齐、暂停、倍速、跳转及失去进度心跳的处理。

## 参考

- [Refined Now Playing](https://github.com/solstice23/refined-now-playing-netease)：视觉参考；原项目依赖 BetterNCM，维护已暂停。
- [CEF 官方说明](https://chromiumembedded.github.io/cef/general_usage)：`remote-debugging-port`。
- [DevTools Runtime](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/)：本地插件通过 Runtime.evaluate 加载；不更改客户端音频或网络实现。
- [Apple Music Like Lyrics](https://github.com/amll-dev/applemusic-like-lyrics)：AMLL DOM 歌词引擎，固定版本 0.6.0；上游 AGPL-3.0-only 许可证随包保留。

这是针对当前客户端的实验性会话插件；不声称兼容所有 macOS 版本或其他网易云构建，不把视觉验证当作音质或长期性能证明。

## 许可证

本项目以 [AGPL-3.0-only](LICENSE) 发布，与打包的 AMLL 引擎一致。AMLL 的来源、版本和本地修改见 `plugin/vendor/NOTICE.md`。本项目与网易云音乐官方无关。
