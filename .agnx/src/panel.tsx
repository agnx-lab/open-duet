// 场景：Open Dots 薄壳面板 — host.guest.mount；首帧品牌扫光；retain + 配置热重启。
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactElement,
} from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type {
  WorkspaceAppBrandLogoLoaderPanelProps,
  WorkspaceAppHostApi,
} from "@getagnx/app-sdk";
import { OPEN_DOTS_APP_ID, OPEN_DOTS_CONFIG_KEY, OPEN_DOTS_ENSURE_TOOL_REL } from "./constants";
import {
  loadOpenDotsConfigFromHost,
  openDotsConfigToEnsureArgs,
} from "./open-dots-config";
import { bindOpenDotsHost, requireBoundHost } from "./host-bind";
import {
  subscribeOpenDotsRuntimeRestart,
  type OpenDotsRuntimeRestartReason,
} from "./open-dots-runtime-coordinator";

const WEB_ROOT_STYLE: CSSProperties = {
  flex: "1 1 0%",
  alignSelf: "stretch",
  minHeight: 0,
  minWidth: 0,
  width: "100%",
  height: "100%",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  backgroundColor: "transparent",
};

const GUEST_HOST_STYLE: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  minWidth: 0,
  width: "100%",
  height: "100%",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  position: "relative",
};

const BOOT_LAYER_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  background: "rgb(9, 9, 11)",
};

const ERROR_LAYER_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 3,
  display: "flex",
  flexDirection: "column",
  background: "rgba(9,9,11,0.88)",
};

const ERROR_FALLBACK_STYLE: CSSProperties = {
  ...ERROR_LAYER_STYLE,
  alignItems: "center",
  justifyContent: "center",
  color: "#a1a1aa",
  padding: 24,
  textAlign: "center",
};

const RETAIN_REASON = "open-dots-open";

const styles = StyleSheet.create((theme) => ({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing[6],
    backgroundColor: "transparent",
  },
  fallbackText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    textAlign: "center",
  },
}));

export function bindOpenDotsPanelHost(host: WorkspaceAppHostApi): void {
  bindOpenDotsHost(host);
}

function getHost(): WorkspaceAppHostApi {
  return requireBoundHost();
}

function canUseGuestSurface(): boolean {
  return typeof document !== "undefined" && getHost().platform.isWeb;
}

export function OpenDotsPanel(_props: {
  appId: string;
  panelId: string;
  entityId: string;
}): ReactElement {
  const guestHostRef = useRef<HTMLDivElement | null>(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = getHost();
    host.background?.requestRetain?.({
      appId: OPEN_DOTS_APP_ID,
      active: true,
      reason: RETAIN_REASON,
    });
    return () => {
      host.background?.requestRetain?.({
        appId: OPEN_DOTS_APP_ID,
        active: false,
        reason: RETAIN_REASON,
      });
    };
  }, []);

  useEffect(() => {
    if (!canUseGuestSurface()) {
      setBooting(false);
      setError("当前平台暂不支持嵌入 Open Dots，请使用 Agnx 桌面端。");
      return;
    }

    let cancelled = false;
    let unmountGuest: (() => void) | null = null;
    let unsubscribeConfig: (() => void) | null = null;

    const mountGuest = async (options?: {
      forceRestart?: boolean;
      reason?: OpenDotsRuntimeRestartReason;
    }) => {
      const host = getHost();
      if (!guestHostRef.current) return;
      if (!host.guest?.mount) {
        if (!cancelled) {
          setBooting(false);
          setError("宿主未提供 host.guest（需升级 Agnx 并重新扫描子应用）");
        }
        return;
      }

      unmountGuest?.();
      unmountGuest = null;
      setBooting(true);
      setError(null);

      try {
        const cfg = await loadOpenDotsConfigFromHost(host.config);
        const args = openDotsConfigToEnsureArgs(cfg, {
          forceRestart: options?.forceRestart,
        });
        if (cancelled || !guestHostRef.current) return;
        unmountGuest = host.guest.mount({
          container: guestHostRef.current,
          ensureTool: OPEN_DOTS_ENSURE_TOOL_REL,
          ensureArgs: args,
          timeoutMs: 360_000,
          bootOverlay: false,
          onReady: () => {
            if (!cancelled) {
              setError(null);
              window.setTimeout(() => {
                if (!cancelled) setBooting(false);
              }, 320);
            }
          },
          onError: (detail) => {
            if (!cancelled) {
              setBooting(false);
              setError(`${detail.code}: ${detail.message}`);
            }
          },
        });
      } catch (err) {
        if (!cancelled) {
          setBooting(false);
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void mountGuest();

    const unsubscribeRestart = subscribeOpenDotsRuntimeRestart(() => {
      void mountGuest({ forceRestart: true, reason: "manual" });
    });

    const hostForConfig = getHost();
    if (hostForConfig.config?.subscribe) {
      unsubscribeConfig = hostForConfig.config.subscribe({
        scope: "app",
        appId: OPEN_DOTS_APP_ID,
        key: OPEN_DOTS_CONFIG_KEY,
        emitCurrent: false,
        listener: () => {
          void mountGuest({ forceRestart: true, reason: "manual" });
        },
      });
    }

    return () => {
      cancelled = true;
      unsubscribeRestart();
      unsubscribeConfig?.();
      unmountGuest?.();
    };
  }, []);

  if (!canUseGuestSurface()) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>{error ?? "加载中…"}</Text>
      </View>
    );
  }

  const BrandPanel = getHost().ui
    ?.BrandLogoLoaderPanel as ComponentType<WorkspaceAppBrandLogoLoaderPanelProps> | undefined;

  return (
    <div style={WEB_ROOT_STYLE} data-testid="workspace-mini-app-open-dots-root">
      <div
        ref={guestHostRef}
        data-agnx-guest-surface-host="true"
        style={GUEST_HOST_STYLE}
      />
      {booting && !error && BrandPanel ? (
        <div data-agnx-guest-boot-overlay="true" style={BOOT_LAYER_STYLE} role="status">
          <BrandPanel title="正在启动 Open Dots…" testID="open-dots-boot-overlay" />
        </div>
      ) : null}
      {booting && !error && !BrandPanel ? (
        <div data-agnx-guest-boot-overlay="true" style={ERROR_FALLBACK_STYLE} role="status">
          正在启动 Open Dots…
        </div>
      ) : null}
      {error && BrandPanel ? (
        <div style={ERROR_LAYER_STYLE} role="alert">
          <BrandPanel
            title={error}
            description="打开命令面板 → Open Dots → 详情，复制 Guest Surface。"
            testID="open-dots-mount-error"
          />
        </div>
      ) : null}
      {error && !BrandPanel ? (
        <div style={ERROR_FALLBACK_STYLE} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
