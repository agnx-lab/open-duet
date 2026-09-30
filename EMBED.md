## 上游嵌入

- 工作方式：整仓魔改（真树 `$AGNX_HOME/apps/open-dots`）
- 推荐模式：Wrap + 双进程 Sidecar（FastAPI `:8088` + Next `:3088`）+ Guest（`guest.auth=none` → `direct-iframe`）
- 挂载：`host.guest.mount`；panel 禁止手写 iframe
- 上游：`Anil-matcha/open-dots@617ac65`（本目录 git remote）
- Port 切片：`client/next.config.mjs` 同源 `/api/v1` rewrite（cookie + SSE）
- 默认值：`COMPUTER_PROVIDER=fake`；`uiMode=next-dev`；DATA_DIR=`$AGNX_HOME/apps/data/open-dots`
- 活页：Agnx monorepo `docs/sub-app/OpenDots子应用需求_open-dots-sub-app.md`

## 嵌页宿主能力缺口

| 上游能力 | 信号位置 | 嵌后风险 | 处置 (A–E) | 主路径 | 备注 |
| --- | --- | --- | --- | --- | --- |
| API auth + SSE | `client/lib/api.js` | 跨站 Guest：Cookie 被拦；EventSource 不能带 Bearer | C rewrite + `NEXT_PUBLIC_API_TOKEN` + fetch SSE | 是 | launcher 注入 `.auth-token`；`subscribeToChatStream` 用 fetch |
| 模型/Composio 密钥 | Settings + env | 嵌页可填 | A host.config + 上游 Settings | 是 | sync → sidecar-env.json |
| 图片附件 | upload FormData | 一般可用 | D | 是 | |
| WORKSPACE_ROOT | gateway workspace.* | 边界需配置 | A 详情路径 Chip | 是 | |
| Computer Docker | COMPUTER_PROVIDER | 非硬沙箱 | E→A W3 开关；默认 fake | 否（一期） | 需本机 Docker + runtime 镜像 |
| Composio OAuth | connectors authorize | iframe 弹窗/跳转 | E→D 失败可见 | 次 | |
| 语音输入 | Web Speech | 视 Guest 分区 | D | 否 | |
| 系统通知 / 外开窗 | 无强依赖 | — | D 不接 | 否 | |
| Create New Bot | `Dashboard` 原 `window.prompt`×3 | iframe/Electron Guest 静默 null → 点了无反应 | **C** 页内 `NewBotModal`（禁止 prompt） | 是 | 2026-09-30 已修 |
| 错误提示 | `ChatWindow` 仍有 `alert(` | Guest 内可能静默 | E→C 后续页内 toast | 否 | 非新建主路径 |

处置字母见 `skills/agnx-app/SKILL.md` §嵌页宿主能力缺口视角。
