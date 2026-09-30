// 场景：Open Dots Host 绑定单例 — 面板 / 详情 / 工具共用。
import type { WorkspaceAppHostApi } from "@getagnx/app-sdk";

let boundHost: WorkspaceAppHostApi | null = null;

export function bindOpenDotsHost(host: WorkspaceAppHostApi): void {
  boundHost = host;
}

export function getBoundHost(): WorkspaceAppHostApi | null {
  return boundHost;
}

export function requireBoundHost(): WorkspaceAppHostApi {
  if (!boundHost) {
    throw new Error("Open Dots Host 尚未绑定");
  }
  return boundHost;
}
