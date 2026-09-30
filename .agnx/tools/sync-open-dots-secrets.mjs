#!/usr/bin/env node
/**
 * 场景：host.config 密钥/路径 → apps/data/open-dots/sidecar-env.json（ensure/launcher 注入）。
 * 用法：node sync-open-dots-secrets.mjs [--data-dir <path>] [--agnx-home <path>]
 */
import { homedir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const APP_ID = "open-dots";
const CONFIG_KEY = "open-dots-app-config";

function parseArgs(argv) {
  let dataDir = "";
  let agnxHome = process.env.AGNX_HOME || "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--data-dir" || arg === "--dataDir") && next) {
      dataDir = String(next).trim();
      i += 1;
    } else if (arg === "--agnx-home" && next) {
      agnxHome = String(next).trim();
      i += 1;
    }
  }
  if (!agnxHome) {
    agnxHome = path.join(homedir(), ".agnx-dev");
  }
  if (!dataDir) {
    dataDir = path.join(agnxHome, "apps", "data", APP_ID);
  }
  return { dataDir, agnxHome };
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function pick(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function main() {
  const { dataDir, agnxHome } = parseArgs(process.argv.slice(2));
  const hostPath = path.join(agnxHome, "apps", "data", APP_ID, "config", `${CONFIG_KEY}.json`);
  const raw = await readJson(hostPath);
  const doc = raw && typeof raw === "object" ? raw : {};

  const env = {};
  const modelApiKey = pick(doc.modelApiKey);
  const modelApiBaseUrl = pick(doc.modelApiBaseUrl);
  const defaultModel = pick(doc.defaultModel);
  const composioApiKey = pick(doc.composioApiKey);
  const workspaceRoot = pick(doc.workspaceRoot);
  const dataDirCfg = pick(doc.dataDir);
  const computerProvider = pick(doc.computerProvider);

  if (modelApiKey) env.MODEL_API_KEY = modelApiKey;
  if (modelApiBaseUrl) env.MODEL_API_BASE_URL = modelApiBaseUrl;
  if (defaultModel) env.DEFAULT_MODEL = defaultModel;
  if (composioApiKey) env.COMPOSIO_API_KEY = composioApiKey;
  if (workspaceRoot) env.WORKSPACE_ROOT = workspaceRoot;
  if (dataDirCfg) env.DATA_DIR = dataDirCfg;
  if (computerProvider === "docker" || computerProvider === "fake") {
    env.COMPUTER_PROVIDER = computerProvider;
  }

  await mkdir(dataDir, { recursive: true });
  const outPath = path.join(dataDir, "sidecar-env.json");
  await writeFile(outPath, `${JSON.stringify(env, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      ok: true,
      outPath,
      keys: Object.keys(env),
      configured: {
        modelApiKey: Boolean(modelApiKey),
        modelApiBaseUrl: Boolean(modelApiBaseUrl),
        composioApiKey: Boolean(composioApiKey),
        computerProvider: computerProvider || "fake",
      },
    }),
  );
}

main().catch((err) => {
  console.log(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exitCode = 1;
});
