// 场景：详情「配置」— 端口、uiMode、workspace、computer、密钥（W2–W3）。
import { createElement, useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { Pressable, Text, TextInput, View, type TextStyle, type ViewStyle } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import type { WorkspaceAppHostApi } from "@getagnx/app-sdk";
import {
  DEFAULT_OPEN_DOTS_API_PORT,
  DEFAULT_OPEN_DOTS_UI_PORT,
  OPEN_DOTS_APP_ID,
  OPEN_DOTS_SYNC_SECRETS_TOOL_REL,
  type OpenDotsComputerProvider,
  type OpenDotsUiMode,
} from "./constants";
import { getBoundHost } from "./host-bind";
import {
  defaultOpenDotsAppConfigDocument,
  isOpenDotsSecretConfigured,
  loadOpenDotsConfigFromHost,
  saveOpenDotsConfigToHost,
  type OpenDotsAppConfigDocument,
} from "./open-dots-config";
import { notifyOpenDotsRuntimeNeedsRestart } from "./open-dots-runtime-coordinator";

let cachedConfig: OpenDotsAppConfigDocument = defaultOpenDotsAppConfigDocument();

export function getCachedOpenDotsConfig(): OpenDotsAppConfigDocument {
  return cachedConfig;
}

function setCachedOpenDotsConfig(next: OpenDotsAppConfigDocument): void {
  cachedConfig = next;
}

function useDetailLayoutStyles() {
  const { theme } = useUnistyles();
  const dark = theme.colorScheme !== "light";
  return useMemo(() => {
    const column: ViewStyle = {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      alignSelf: "stretch",
      width: "100%",
      gap: 8,
      minWidth: 0,
    };
    const row: ViewStyle = {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
    };
    const muted: TextStyle = {
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.foregroundMuted,
    };
    const mono: TextStyle = {
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.foreground,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    };
    const ok: TextStyle = {
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.statusSuccess || "#15803d",
    };
    const warn: TextStyle = {
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.statusWarning || theme.colors.statusDanger,
    };
    const input = (focused: boolean): TextStyle => ({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 72,
      fontSize: 12,
      lineHeight: 16,
      borderWidth: 1.5,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      minHeight: 32,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      color: theme.colors.foreground,
      borderColor: focused
        ? theme.colors.accent
        : dark
          ? "rgba(255,255,255,0.35)"
          : "rgba(0,0,0,0.22)",
      backgroundColor: dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.92)",
    });
    return { column, row, muted, mono, ok, warn, input, theme, dark };
  }, [dark, theme]);
}

function DetailChip({
  label,
  busy,
  disabled,
  tone,
  onPress,
  testID,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  tone?: "accent" | "default";
  onPress: () => void;
  testID?: string;
}): ReactElement {
  const { theme, dark } = useDetailLayoutStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        opacity: disabled || busy ? 0.5 : pressed ? 0.85 : 1,
        borderColor:
          tone === "accent"
            ? theme.colors.accent
            : dark
              ? "rgba(255,255,255,0.28)"
              : "rgba(0,0,0,0.18)",
        backgroundColor:
          tone === "accent"
            ? dark
              ? "rgba(56,189,248,0.18)"
              : "rgba(14,165,233,0.12)"
            : dark
              ? "rgba(0,0,0,0.28)"
              : "rgba(255,255,255,0.85)",
      })}
    >
      <Text style={{ fontSize: 12, color: theme.colors.foreground }}>
        {busy ? "…" : label}
      </Text>
    </Pressable>
  );
}

function RuntimeDetailField(): ReactElement {
  const styles = useDetailLayoutStyles();
  const host = getBoundHost();
  const [draft, setDraft] = useState(getCachedOpenDotsConfig());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    void loadOpenDotsConfigFromHost(host?.config).then((loaded) => {
      setCachedOpenDotsConfig(loaded);
      setDraft(loaded);
    });
  }, [host]);

  const save = useCallback(async () => {
    if (!host?.config) {
      setMsg("无 host.config");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const next = await saveOpenDotsConfigToHost(host.config, {
        uiPort: draft.uiPort,
        apiPort: draft.apiPort,
        uiMode: draft.uiMode,
        computerProvider: draft.computerProvider,
        dataDir: draft.dataDir,
        workspaceRoot: draft.workspaceRoot,
      });
      setCachedOpenDotsConfig(next);
      setDraft(next);
      if (host.tools?.run) {
        await host.tools.run({
          appId: OPEN_DOTS_APP_ID,
          tool: OPEN_DOTS_SYNC_SECRETS_TOOL_REL,
          args: next.dataDir ? ["--data-dir", next.dataDir] : [],
          timeoutMs: 30_000,
        });
      }
      notifyOpenDotsRuntimeNeedsRestart("ports");
      setMsg("已保存并请求重启 sidecar");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [draft, host]);

  const pickWorkspace = useCallback(async () => {
    const picked = await host?.files?.pickDirectory?.({ title: "选择 WORKSPACE_ROOT" });
    if (typeof picked === "string" && picked.trim()) {
      setDraft((d) => ({ ...d, workspaceRoot: picked.trim() }));
    }
  }, [host]);

  return (
    <View style={styles.column}>
      <Text style={styles.muted}>
        UI 默认 {DEFAULT_OPEN_DOTS_UI_PORT} · API 默认 {DEFAULT_OPEN_DOTS_API_PORT} · computer 默认
        fake（Docker 非硬沙箱）
      </Text>
      <View style={styles.row}>
        <Text style={styles.mono}>uiPort</Text>
        <TextInput
          value={String(draft.uiPort)}
          onChangeText={(t) => setDraft((d) => ({ ...d, uiPort: Number(t) || d.uiPort }))}
          onFocus={() => setFocus("uiPort")}
          onBlur={() => setFocus(null)}
          keyboardType="number-pad"
          style={styles.input(focus === "uiPort")}
          testID="open-dots-config-ui-port"
        />
        <Text style={styles.mono}>apiPort</Text>
        <TextInput
          value={String(draft.apiPort)}
          onChangeText={(t) => setDraft((d) => ({ ...d, apiPort: Number(t) || d.apiPort }))}
          onFocus={() => setFocus("apiPort")}
          onBlur={() => setFocus(null)}
          keyboardType="number-pad"
          style={styles.input(focus === "apiPort")}
          testID="open-dots-config-api-port"
        />
      </View>
      <View style={styles.row}>
        {(["next-dev", "next-start"] as OpenDotsUiMode[]).map((mode) => (
          <DetailChip
            key={mode}
            label={mode}
            tone={draft.uiMode === mode ? "accent" : "default"}
            onPress={() => setDraft((d) => ({ ...d, uiMode: mode }))}
            testID={`open-dots-ui-mode-${mode}`}
          />
        ))}
        {(["fake", "docker"] as OpenDotsComputerProvider[]).map((provider) => (
          <DetailChip
            key={provider}
            label={`computer:${provider}`}
            tone={draft.computerProvider === provider ? "accent" : "default"}
            onPress={() => setDraft((d) => ({ ...d, computerProvider: provider }))}
            testID={`open-dots-computer-${provider}`}
          />
        ))}
      </View>
      <Text style={styles.muted}>workspaceRoot（网关读写边界）</Text>
      <View style={styles.row}>
        <TextInput
          value={draft.workspaceRoot ?? ""}
          onChangeText={(t) => setDraft((d) => ({ ...d, workspaceRoot: t }))}
          onFocus={() => setFocus("workspace")}
          onBlur={() => setFocus(null)}
          placeholder="默认 = 仓根"
          placeholderTextColor={styles.theme.colors.foregroundMuted}
          style={styles.input(focus === "workspace")}
          testID="open-dots-config-workspace"
        />
        <DetailChip label="选目录" onPress={() => void pickWorkspace()} testID="open-dots-pick-workspace" />
      </View>
      <Text style={styles.muted}>dataDir（DATA_DIR；空 = apps/data/open-dots）</Text>
      <TextInput
        value={draft.dataDir ?? ""}
        onChangeText={(t) => setDraft((d) => ({ ...d, dataDir: t }))}
        onFocus={() => setFocus("dataDir")}
        onBlur={() => setFocus(null)}
        style={styles.input(focus === "dataDir")}
        testID="open-dots-config-data-dir"
      />
      {draft.computerProvider === "docker" ? (
        <Text style={styles.warn}>
          Docker computer 需本机 Docker 与 runtime 镜像；非敌对网页硬隔离。默认请用 fake。
        </Text>
      ) : null}
      <View style={styles.row}>
        <DetailChip
          label="保存并重启"
          tone="accent"
          busy={busy}
          onPress={() => void save()}
          testID="open-dots-config-save-runtime"
        />
      </View>
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}
    </View>
  );
}

function SecretsDetailField(): ReactElement {
  const styles = useDetailLayoutStyles();
  const host = getBoundHost();
  const [draft, setDraft] = useState(getCachedOpenDotsConfig());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    void loadOpenDotsConfigFromHost(host?.config).then((loaded) => {
      setCachedOpenDotsConfig(loaded);
      setDraft(loaded);
    });
  }, [host]);

  const save = useCallback(async () => {
    if (!host?.config) {
      setMsg("无 host.config");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const next = await saveOpenDotsConfigToHost(host.config, {
        modelApiKey: draft.modelApiKey,
        modelApiBaseUrl: draft.modelApiBaseUrl,
        defaultModel: draft.defaultModel,
        composioApiKey: draft.composioApiKey,
      });
      setCachedOpenDotsConfig(next);
      setDraft(next);
      if (host.tools?.run) {
        await host.tools.run({
          appId: OPEN_DOTS_APP_ID,
          tool: OPEN_DOTS_SYNC_SECRETS_TOOL_REL,
          args: next.dataDir ? ["--data-dir", next.dataDir] : [],
          timeoutMs: 30_000,
        });
      }
      notifyOpenDotsRuntimeNeedsRestart("secrets");
      setMsg("密钥已同步；sidecar 将重启");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [draft, host]);

  return (
    <View style={styles.column}>
      <Text style={styles.muted}>
        推理适配器为专用 prediction/upload 合同（非通用 OpenAI chat completions）。详情只显示
        configured。
      </Text>
      <Text style={styles.mono}>
        MODEL_API_KEY: {isOpenDotsSecretConfigured(draft.modelApiKey) ? "configured" : "empty"}
      </Text>
      <TextInput
        secureTextEntry
        value={draft.modelApiKey ?? ""}
        onChangeText={(t) => setDraft((d) => ({ ...d, modelApiKey: t }))}
        onFocus={() => setFocus("key")}
        onBlur={() => setFocus(null)}
        placeholder="MODEL_API_KEY"
        placeholderTextColor={styles.theme.colors.foregroundMuted}
        style={styles.input(focus === "key")}
        testID="open-dots-config-model-key"
      />
      <TextInput
        value={draft.modelApiBaseUrl ?? ""}
        onChangeText={(t) => setDraft((d) => ({ ...d, modelApiBaseUrl: t }))}
        onFocus={() => setFocus("base")}
        onBlur={() => setFocus(null)}
        placeholder="MODEL_API_BASE_URL"
        placeholderTextColor={styles.theme.colors.foregroundMuted}
        style={styles.input(focus === "base")}
        testID="open-dots-config-model-base"
      />
      <TextInput
        value={draft.defaultModel ?? ""}
        onChangeText={(t) => setDraft((d) => ({ ...d, defaultModel: t }))}
        onFocus={() => setFocus("model")}
        onBlur={() => setFocus(null)}
        placeholder="DEFAULT_MODEL（如 gpt-5-mini）"
        placeholderTextColor={styles.theme.colors.foregroundMuted}
        style={styles.input(focus === "model")}
        testID="open-dots-config-default-model"
      />
      <Text style={styles.mono}>
        COMPOSIO: {isOpenDotsSecretConfigured(draft.composioApiKey) ? "configured" : "empty"}
      </Text>
      <TextInput
        secureTextEntry
        value={draft.composioApiKey ?? ""}
        onChangeText={(t) => setDraft((d) => ({ ...d, composioApiKey: t }))}
        onFocus={() => setFocus("composio")}
        onBlur={() => setFocus(null)}
        placeholder="COMPOSIO_API_KEY（可选）"
        placeholderTextColor={styles.theme.colors.foregroundMuted}
        style={styles.input(focus === "composio")}
        testID="open-dots-config-composio"
      />
      <DetailChip
        label="保存密钥并重启"
        tone="accent"
        busy={busy}
        onPress={() => void save()}
        testID="open-dots-config-save-secrets"
      />
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}
    </View>
  );
}

function ReloadTabSection(): ReactElement {
  const styles = useDetailLayoutStyles();
  return (
    <View style={styles.column}>
      <Text style={styles.muted}>强制重拉 ensure + Guest（含 Composio / audit 面板）。</Text>
      <DetailChip
        label="重新加载 Tab"
        tone="accent"
        onPress={() => notifyOpenDotsRuntimeNeedsRestart("manual")}
        testID="open-dots-reload-tab"
      />
    </View>
  );
}

function secretSummary(cfg: OpenDotsAppConfigDocument): string {
  const parts = [
    isOpenDotsSecretConfigured(cfg.modelApiKey) ? "model" : null,
    isOpenDotsSecretConfigured(cfg.modelApiBaseUrl) ? "base" : null,
    isOpenDotsSecretConfigured(cfg.composioApiKey) ? "composio" : null,
  ].filter(Boolean);
  return parts.length ? parts.join("+") : "none";
}

export function registerOpenDotsDetailConfig(host: WorkspaceAppHostApi): () => void {
  if (!host.ui?.registerDetailSheetExtras) {
    return () => {};
  }
  void loadOpenDotsConfigFromHost(host.config).then((loaded) => {
    setCachedOpenDotsConfig(loaded);
  });
  return host.ui.registerDetailSheetExtras({
    appId: OPEN_DOTS_APP_ID,
    surface: "config",
    buildRows: () => {
      const cfg = getCachedOpenDotsConfig();
      return [
        {
          label: "运行时",
          value: `ui:${cfg.uiPort} api:${cfg.apiPort} · ${cfg.uiMode} · ${cfg.computerProvider}`,
          helpText: "Next/FastAPI 端口、uiMode、computerProvider（fake|docker）。",
          groupId: "open-dots-runtime",
          groupTitle: "Open Dots",
          valueContent: createElement(RuntimeDetailField),
        },
        {
          label: "推理 / Composio",
          value: secretSummary(cfg),
          helpText: "MODEL_API_* 与 COMPOSIO；同步到 sidecar-env.json。",
          groupId: "open-dots-runtime",
          groupTitle: "Open Dots",
          valueContent: createElement(SecretsDetailField),
        },
        {
          label: "重新加载",
          value: "Tab / sidecar",
          helpText: "强制重拉 ensure + Guest；审计/连接器面板在上游 UI。",
          groupId: "open-dots-runtime",
          groupTitle: "Open Dots",
          valueContent: createElement(ReloadTabSection),
        },
      ];
    },
  });
}
