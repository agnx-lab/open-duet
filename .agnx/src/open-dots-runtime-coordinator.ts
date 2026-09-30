// 场景：Open Dots 运行时协调 — 配置变更后通知面板停旧再起。
export type OpenDotsRuntimeRestartReason =
  | "ports"
  | "ui-mode"
  | "data-dir"
  | "workspace"
  | "secrets"
  | "computer"
  | "manual";

type RestartListener = (reason: OpenDotsRuntimeRestartReason) => void;

const listeners = new Set<RestartListener>();

export function subscribeOpenDotsRuntimeRestart(listener: RestartListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyOpenDotsRuntimeNeedsRestart(reason: OpenDotsRuntimeRestartReason): void {
  for (const listener of listeners) {
    listener(reason);
  }
}
