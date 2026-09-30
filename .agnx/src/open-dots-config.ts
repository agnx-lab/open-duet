// 场景：Open Dots 端口 / 密钥 / workspace / computer 经 host.config 落盘。
import type { WorkspaceAppConfigApi } from "@getagnx/app-sdk";
import {
  DEFAULT_OPEN_DOTS_API_PORT,
  DEFAULT_OPEN_DOTS_UI_PORT,
  OPEN_DOTS_APP_ID,
  OPEN_DOTS_CONFIG_KEY,
  type OpenDotsComputerProvider,
  type OpenDotsUiMode,
} from "./constants";

export interface OpenDotsAppConfigDocument {
  version: 1;
  uiPort: number;
  apiPort: number;
  uiMode: OpenDotsUiMode;
  computerProvider: OpenDotsComputerProvider;
  dataDir?: string;
  workspaceRoot?: string;
  modelApiKey?: string;
  modelApiBaseUrl?: string;
  defaultModel?: string;
  composioApiKey?: string;
}

export function defaultOpenDotsAppConfigDocument(): OpenDotsAppConfigDocument {
  return {
    version: 1,
    uiPort: DEFAULT_OPEN_DOTS_UI_PORT,
    apiPort: DEFAULT_OPEN_DOTS_API_PORT,
    uiMode: "next-dev",
    computerProvider: "fake",
  };
}

function normalizeUiMode(raw: unknown): OpenDotsUiMode {
  return raw === "next-start" ? "next-start" : "next-dev";
}

function normalizeComputer(raw: unknown): OpenDotsComputerProvider {
  return raw === "docker" ? "docker" : "fake";
}

function normalizeSecret(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePort(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 65535) return fallback;
  return Math.floor(n);
}

export function normalizeOpenDotsAppConfigDocument(raw: unknown): OpenDotsAppConfigDocument {
  const defaults = defaultOpenDotsAppConfigDocument();
  if (!raw || typeof raw !== "object") return defaults;
  const doc = raw as Partial<OpenDotsAppConfigDocument>;
  return {
    version: 1,
    uiPort: normalizePort(doc.uiPort, defaults.uiPort),
    apiPort: normalizePort(doc.apiPort, defaults.apiPort),
    uiMode: normalizeUiMode(doc.uiMode),
    computerProvider: normalizeComputer(doc.computerProvider),
    dataDir: normalizeSecret(doc.dataDir),
    workspaceRoot: normalizeSecret(doc.workspaceRoot),
    modelApiKey: normalizeSecret(doc.modelApiKey),
    modelApiBaseUrl: normalizeSecret(doc.modelApiBaseUrl),
    defaultModel: normalizeSecret(doc.defaultModel),
    composioApiKey: normalizeSecret(doc.composioApiKey),
  };
}

export function isOpenDotsSecretConfigured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function openDotsConfigToEnsureArgs(
  cfg: OpenDotsAppConfigDocument,
  options?: { forceRestart?: boolean },
): string[] {
  const args = [
    "--ui-port",
    String(cfg.uiPort),
    "--api-port",
    String(cfg.apiPort),
    "--ui-mode",
    cfg.uiMode,
    "--computer-provider",
    cfg.computerProvider,
  ];
  if (cfg.dataDir) args.push("--data-dir", cfg.dataDir);
  if (cfg.workspaceRoot) args.push("--workspace-root", cfg.workspaceRoot);
  if (options?.forceRestart) args.push("--force-restart");
  return args;
}

export async function loadOpenDotsConfigFromHost(
  config: WorkspaceAppConfigApi | null | undefined,
): Promise<OpenDotsAppConfigDocument> {
  if (!config?.get) return defaultOpenDotsAppConfigDocument();
  try {
    const raw = await config.get({
      scope: "app",
      appId: OPEN_DOTS_APP_ID,
      key: OPEN_DOTS_CONFIG_KEY,
      defaultValue: null,
    });
    return normalizeOpenDotsAppConfigDocument(raw);
  } catch {
    return defaultOpenDotsAppConfigDocument();
  }
}

export async function saveOpenDotsConfigToHost(
  config: WorkspaceAppConfigApi | null | undefined,
  patch: Partial<OpenDotsAppConfigDocument>,
): Promise<OpenDotsAppConfigDocument> {
  const current = await loadOpenDotsConfigFromHost(config);
  const merged: OpenDotsAppConfigDocument = { ...current, ...patch };
  for (const key of [
    "dataDir",
    "workspaceRoot",
    "modelApiKey",
    "modelApiBaseUrl",
    "defaultModel",
    "composioApiKey",
  ] as const) {
    if (patch[key] === "") {
      delete merged[key];
    }
  }
  const normalized = normalizeOpenDotsAppConfigDocument(merged);
  if (!config?.set) return normalized;
  await config.set({
    scope: "app",
    appId: OPEN_DOTS_APP_ID,
    key: OPEN_DOTS_CONFIG_KEY,
    value: normalized,
  });
  return normalized;
}
