// 场景：W4 — 极薄 Agnx Agent 工具：open_dots_health / open_dots_open。
import type { WorkspaceAppHostApi } from "@getagnx/app-sdk";
import {
  OPEN_DOTS_APP_ID,
  OPEN_DOTS_ENSURE_TOOL_REL,
  OPEN_DOTS_PANEL_ID,
} from "./constants";
import { loadOpenDotsConfigFromHost, openDotsConfigToEnsureArgs } from "./open-dots-config";

const GROUP = {
  groupId: "open-dots",
  groupTitle: "Open Dots",
} as const;

function pickEnsurePayload(result: {
  resultJson?: unknown;
  stdout?: string;
}): Record<string, unknown> | null {
  const json = result.resultJson;
  if (json && typeof json === "object" && json !== null) {
    return json as Record<string, unknown>;
  }
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  for (const line of stdout.split(/\r?\n/).reverse()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      // continue
    }
  }
  return null;
}

export function registerOpenDotsAgentTools(host: WorkspaceAppHostApi): () => void {
  return host.registerAgentTools({
    appId: OPEN_DOTS_APP_ID,
    availability: "always",
    tools: [
      {
        name: "open_dots_health",
        ...GROUP,
        description:
          "检查 Open Dots sidecar（FastAPI+Next）是否就绪。返回 origin/port；不代替上游审批与 computer。",
        inputSchema: {
          type: "object",
          properties: {
            ensure: {
              type: "boolean",
              description: "为 true 时主动跑 ensure（默认 true）",
            },
          },
          additionalProperties: false,
        },
        execute: async (input) => {
          const ensure = input?.ensure !== false;
          if (!ensure) {
            return {
              ok: true,
              message: "未执行 ensure；请打开 Open Dots Tab 或设 ensure:true。",
            };
          }
          if (!host.tools?.run) {
            return {
              ok: false,
              error: "host_tools_unavailable",
              message: "需 Agnx 桌面端 host.tools.run。",
            };
          }
          const cfg = await loadOpenDotsConfigFromHost(host.config);
          const result = await host.tools.run({
            appId: OPEN_DOTS_APP_ID,
            tool: OPEN_DOTS_ENSURE_TOOL_REL,
            args: openDotsConfigToEnsureArgs(cfg),
            timeoutMs: 360_000,
          });
          const payload = pickEnsurePayload(result);
          if (payload) return payload;
          return {
            ok: false,
            error: "empty_ensure_result",
            exitCode: result.exitCode,
            timedOut: result.timedOut,
            stderr: result.stderr?.slice(0, 400),
          };
        },
      },
      {
        name: "open_dots_open",
        ...GROUP,
        description:
          "在工作区打开 Open Dots Tab（上游 Dots 式工作区）。审批与 Computer 留在上游 UI。",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => {
          host.openMiniAppTab({
            appId: OPEN_DOTS_APP_ID,
            panelId: OPEN_DOTS_PANEL_ID,
          });
          return {
            ok: true,
            appId: OPEN_DOTS_APP_ID,
            panelId: OPEN_DOTS_PANEL_ID,
            message: "已请求打开 Open Dots Tab。",
          };
        },
      },
    ],
  });
}
