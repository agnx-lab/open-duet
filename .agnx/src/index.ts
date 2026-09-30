// 场景：Open Dots Sub App 入口 — Guest + ensure + retain + 极薄工具 + 详情配置。
import type { WorkspaceAppHostApi, WorkspaceAppModule } from "@getagnx/app-sdk";
import { OpenDotsIcon } from "./open-dots-icon";
import {
  OPEN_DOTS_APP_ID,
  OPEN_DOTS_ENSURE_TOOL_REL,
  OPEN_DOTS_OPEN_COMMAND_ID,
  OPEN_DOTS_PANEL_ID,
  OPEN_DOTS_SYNC_SECRETS_TOOL_REL,
} from "./constants";
import { registerOpenDotsDetailConfig } from "./detail-config";
import { registerOpenDotsAgentTools } from "./agent-tools";
import { bindOpenDotsPanelHost, OpenDotsPanel } from "./panel";

export const appId = OPEN_DOTS_APP_ID;

function openOpenDotsTab(
  host: WorkspaceAppHostApi,
  context?: {
    serverId?: string;
    workspaceId?: string;
    currentPathname?: string | null;
  },
): void {
  host.openMiniAppTab({
    appId: OPEN_DOTS_APP_ID,
    panelId: OPEN_DOTS_PANEL_ID,
    serverId: context?.serverId,
    workspaceId: context?.workspaceId,
    currentPathname: context?.currentPathname,
  });
}

export function activate(host: WorkspaceAppHostApi): void {
  bindOpenDotsPanelHost(host);
  registerOpenDotsDetailConfig(host);
  registerOpenDotsAgentTools(host);

  host.registerMiniApp({
    id: OPEN_DOTS_PANEL_ID,
    appId: OPEN_DOTS_APP_ID,
    title: "Open Dots",
    icon: OpenDotsIcon,
    component: OpenDotsPanel,
    iframeShortcutCapture: true,
    isolation: {
      mode: "iframe",
      sidecarTools: [OPEN_DOTS_ENSURE_TOOL_REL, OPEN_DOTS_SYNC_SECRETS_TOOL_REL],
      note: "Tab Guest 加载本仓受管 Open Dots；FastAPI+Next 双进程 + 同源 /api rewrite",
    },
  });

  host.registerCommand({
    id: OPEN_DOTS_OPEN_COMMAND_ID,
    appId: OPEN_DOTS_APP_ID,
    title: "Open Dots",
    keywords: ["open-dots", "opendots", "dots", "openai dots", "审批", "computer"],
    icon: OpenDotsIcon,
    sidebarAction: {
      defaultVisible: true,
      label: "Dots",
      order: 65,
    },
    run: (context) => {
      openOpenDotsTab(host, context);
    },
  });
}

const moduleExport: WorkspaceAppModule = {
  appId: OPEN_DOTS_APP_ID,
  activate,
};

export default moduleExport;

export {
  OPEN_DOTS_APP_ID,
  OPEN_DOTS_OPEN_COMMAND_ID,
  OPEN_DOTS_PANEL_ID,
} from "./constants";
export { OpenDotsPanel } from "./panel";
