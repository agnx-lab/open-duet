// 场景：Open Dots Sub App 常量（AppId / 命令 / 面板 / ensure）。
export const OPEN_DOTS_APP_ID = "open-dots";
export const OPEN_DOTS_PANEL_ID = "open-dots.main";
export const OPEN_DOTS_OPEN_COMMAND_ID = "open-dots.open";

export const OPEN_DOTS_ENSURE_TOOL_REL = ".agnx/tools/ensure-open-dots.mjs";
export const OPEN_DOTS_SYNC_SECRETS_TOOL_REL = ".agnx/tools/sync-open-dots-secrets.mjs";

export const OPEN_DOTS_CONFIG_KEY = "open-dots-app-config";

export const DEFAULT_OPEN_DOTS_UI_PORT = 3088;
export const DEFAULT_OPEN_DOTS_API_PORT = 8088;

export type OpenDotsUiMode = "next-dev" | "next-start";
export type OpenDotsComputerProvider = "fake" | "docker";
