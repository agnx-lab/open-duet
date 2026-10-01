#!/usr/bin/env node
/**
 * 场景：短跑 sidecar — 确保 Open Dots FastAPI+Next 已起（默认 UI :3088 / API :8088）。
 * 用法：node .agnx/tools/ensure-open-dots.mjs [--ui-port <n>] [--api-port <n>] [--ui-mode next-dev|next-start]
 *       [--data-dir <path>] [--workspace-root <path>] [--computer-provider fake|docker]
 *       [--force-restart] [--supervised]
 * stdout：JSON { ok, origin, reused?, plan?, warnings? }
 */
import { spawn, execFile } from "node:child_process";
import { access, constants as fsConstants, mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const APP_ID = "open-dots";
const DEFAULT_UI_PORT = 3088;
const DEFAULT_API_PORT = 8088;

function parseArgs(argv) {
  let workDir = process.env.AGNX_APP_DATA_ROOT || "";
  let uiPort = DEFAULT_UI_PORT;
  let apiPort = DEFAULT_API_PORT;
  let uiMode = "next-dev";
  let dataDir = "";
  let workspaceRoot = "";
  let computerProvider = "fake";
  let forceRestart = false;
  let supervised = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--work-dir" || arg === "--workDir") && next) {
      workDir = String(next).trim();
      i += 1;
    } else if ((arg === "--ui-port" || arg === "--uiPort" || arg === "--port") && next) {
      const n = Number(next);
      if (Number.isFinite(n) && n > 0) uiPort = Math.floor(n);
      i += 1;
    } else if ((arg === "--api-port" || arg === "--apiPort") && next) {
      const n = Number(next);
      if (Number.isFinite(n) && n > 0) apiPort = Math.floor(n);
      i += 1;
    } else if ((arg === "--ui-mode" || arg === "--uiMode") && next) {
      uiMode = next === "next-start" ? "next-start" : "next-dev";
      i += 1;
    } else if ((arg === "--data-dir" || arg === "--dataDir") && next) {
      dataDir = String(next).trim();
      i += 1;
    } else if ((arg === "--workspace-root" || arg === "--workspaceRoot") && next) {
      workspaceRoot = String(next).trim();
      i += 1;
    } else if ((arg === "--computer-provider" || arg === "--computerProvider") && next) {
      computerProvider = next === "docker" ? "docker" : "fake";
      i += 1;
    } else if (arg === "--force-restart" || arg === "--forceRestart") {
      forceRestart = true;
    } else if (arg === "--supervised") {
      supervised = true;
    }
  }
  const fallbackWork = path.join(
    process.env.AGNX_HOME || path.join(homedir(), ".agnx-dev"),
    "apps",
    "data",
    APP_ID,
  );
  const resolvedWork = workDir || (supervised ? "" : fallbackWork);
  const resolvedData = dataDir || resolvedWork || fallbackWork;
  return {
    workDir: resolvedWork,
    uiPort,
    apiPort,
    uiMode,
    dataDir: resolvedData,
    workspaceRoot: workspaceRoot || repoRoot,
    computerProvider,
    forceRestart,
    supervised,
    repoRoot,
  };
}

function fingerprint(cfg) {
  return JSON.stringify({
    repoRoot: cfg.repoRoot,
    uiPort: cfg.uiPort,
    apiPort: cfg.apiPort,
    uiMode: cfg.uiMode,
    dataDir: cfg.dataDir,
    workspaceRoot: cfg.workspaceRoot,
    computerProvider: cfg.computerProvider,
  });
}

async function pathExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readState(statePath) {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return null;
  }
}

async function writeState(statePath, payload) {
  await writeFile(statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function httpGetOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 2500 }, (res) => {
      res.resume();
      resolve(res.statusCode != null && res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function isStackHealthy(cfg) {
  const apiOk = await httpGetOk(`http://127.0.0.1:${cfg.apiPort}/api/v1/health`);
  if (!apiOk) return false;
  return httpGetOk(`http://127.0.0.1:${cfg.uiPort}/`);
}

async function waitForHealth(cfg, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isStackHealthy(cfg)) return true;
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

function stopPid(pid) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) return;
  try {
    process.kill(n, "SIGTERM");
  } catch {
    // ignore
  }
}

function guestOrigin(cfg) {
  // 上游合并后 `/` 是营销页；真正工作台在 `/app`（含 AuthenticationGate）。
  return `http://127.0.0.1:${cfg.uiPort}/app`;
}

function healthUrlFor(cfg) {
  return `http://127.0.0.1:${cfg.uiPort}/`;
}

function baseSidecarEnv() {
  const keep = [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "SHELL",
    "TERM",
    "NODE_OPTIONS",
    "NODE_PATH",
    "NVM_BIN",
    "NVM_DIR",
    "SSH_AUTH_SOCK",
  ];
  const env = {};
  for (const key of keep) {
    if (typeof process.env[key] === "string" && process.env[key]) {
      env[key] = process.env[key];
    }
  }
  return env;
}

async function loadSidecarEnvSnapshot(cfg) {
  const candidates = [
    path.join(cfg.dataDir, "sidecar-env.json"),
    path.join(
      process.env.AGNX_HOME || path.join(homedir(), ".agnx-dev"),
      "apps",
      "data",
      APP_ID,
      "sidecar-env.json",
    ),
  ];
  for (const file of candidates) {
    try {
      const raw = JSON.parse(await readFile(file, "utf8"));
      if (raw && typeof raw === "object") return raw;
    } catch {
      // continue
    }
  }
  return {};
}

async function syncSecrets(cfg) {
  const syncScript = path.join(__dirname, "sync-open-dots-secrets.mjs");
  if (!(await pathExists(syncScript))) return;
  try {
    await execFileAsync(process.execPath, [syncScript, "--data-dir", cfg.dataDir], {
      cwd: cfg.repoRoot,
      timeout: 30_000,
      maxBuffer: 512 * 1024,
      env: process.env,
    });
  } catch {
    // non-fatal
  }
}

async function buildEnv(cfg) {
  const secrets = await loadSidecarEnvSnapshot(cfg);
  const env = {
    ...baseSidecarEnv(),
    ...secrets,
    HOST: "127.0.0.1",
    PORT: String(cfg.apiPort),
    OPEN_DOTS_API_PORT: String(cfg.apiPort),
    OPEN_DOTS_UI_PORT: String(cfg.uiPort),
    OPEN_DOTS_UI_MODE: cfg.uiMode,
    DATA_DIR: cfg.dataDir,
    WORKSPACE_ROOT: cfg.workspaceRoot,
    COMPUTER_PROVIDER: cfg.computerProvider,
    NEXT_PUBLIC_API_URL: "/api/v1",
    CORS_ORIGINS: `http://127.0.0.1:${cfg.uiPort},http://localhost:${cfg.uiPort}`,
  };
  // 跨站 Guest iframe 拦 Cookie → 注入 Bearer（launcher 也会在 FastAPI ready 后再读一次）
  if (!env.NEXT_PUBLIC_API_TOKEN) {
    try {
      const token = (await readFile(path.join(cfg.dataDir, ".auth-token"), "utf8")).trim();
      if (token) env.NEXT_PUBLIC_API_TOKEN = token;
    } catch {
      // first boot: launcher fills after FastAPI creates token
    }
  }
  if (cfg.computerProvider === "docker") {
    env.COMPUTER_DOCKER_IMAGE =
      secrets.COMPUTER_DOCKER_IMAGE || process.env.COMPUTER_DOCKER_IMAGE || "open-dots-computer:1.62.1";
  }
  return env;
}

async function ensurePythonVenv(cfg, warnings) {
  const serverDir = path.join(cfg.repoRoot, "server");
  const venvPython = path.join(serverDir, ".venv", "bin", "python");
  const requirements = path.join(serverDir, "requirements.txt");
  if (!(await pathExists(requirements))) {
    return { ok: false, error: `缺少 ${requirements}` };
  }
  if (await pathExists(venvPython)) {
    return { ok: true, pythonBin: venvPython };
  }
  warnings.push("首次创建 server/.venv 并 pip install…");
  try {
    await execFileAsync("python3", ["-m", "venv", ".venv"], {
      cwd: serverDir,
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    await execFileAsync(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"], {
      cwd: serverDir,
      timeout: 600_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr || "") : "";
    return { ok: false, error: `venv/pip 失败：${(stderr || msg).slice(0, 600)}` };
  }
  if (!(await pathExists(venvPython))) {
    return { ok: false, error: "venv 创建后仍无 python" };
  }
  return { ok: true, pythonBin: venvPython };
}

async function ensureClientDeps(cfg, warnings) {
  const clientDir = path.join(cfg.repoRoot, "client");
  const nextBin = path.join(clientDir, "node_modules", "next", "dist", "bin", "next");
  if (await pathExists(nextBin)) {
    return { ok: true };
  }
  warnings.push("首次 npm install（client）…");
  try {
    await execFileAsync("npm", ["install"], {
      cwd: clientDir,
      timeout: 600_000,
      maxBuffer: 8 * 1024 * 1024,
      env: process.env,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `client npm install 失败：${msg.slice(0, 500)}` };
  }
  if (!(await pathExists(nextBin))) {
    return { ok: false, error: "npm install 后仍无 next" };
  }
  return { ok: true };
}

async function ensureNextBuilt(cfg, warnings) {
  if (cfg.uiMode !== "next-start") return { ok: true };
  const buildId = path.join(cfg.repoRoot, "client", ".next", "BUILD_ID");
  if (await pathExists(buildId)) return { ok: true };
  warnings.push("uiMode=next-start：正在 next build…");
  try {
    await execFileAsync("npx", ["next", "build"], {
      cwd: path.join(cfg.repoRoot, "client"),
      timeout: 600_000,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: "/api/v1",
        OPEN_DOTS_API_PORT: String(cfg.apiPort),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `next build 失败：${msg.slice(0, 500)}` };
  }
  if (!(await pathExists(buildId))) {
    return { ok: false, error: "next build 后仍无 BUILD_ID" };
  }
  return { ok: true };
}

async function tryReusedResponse(cfg, statePath, wantedFp) {
  if (cfg.forceRestart) return null;
  if (!(await isStackHealthy(cfg))) return null;
  const existing = await readState(statePath);
  if (existing?.fingerprint && existing.fingerprint !== wantedFp) return null;
  return {
    ok: true,
    reused: true,
    port: cfg.uiPort,
    apiPort: cfg.apiPort,
    origin: guestOrigin(cfg),
    uiMode: cfg.uiMode,
    computerProvider: cfg.computerProvider,
    pid: existing?.pid ?? null,
    fingerprint: wantedFp,
  };
}

async function buildSupervisedPlan(cfg, warnings, wantedFp) {
  await syncSecrets(cfg);
  const py = await ensurePythonVenv(cfg, warnings);
  if (!py.ok) return py;
  const npm = await ensureClientDeps(cfg, warnings);
  if (!npm.ok) return npm;
  const built = await ensureNextBuilt(cfg, warnings);
  if (!built.ok) return built;

  const launcher = path.join(__dirname, "open-dots-launcher.mjs");
  if (!(await pathExists(launcher))) {
    return { ok: false, error: `找不到 launcher：${launcher}` };
  }

  const env = await buildEnv(cfg);
  env.OPEN_DOTS_PYTHON = py.pythonBin;

  return {
    ok: true,
    plan: {
      command: process.execPath,
      args: [
        launcher,
        "--api-port",
        String(cfg.apiPort),
        "--ui-port",
        String(cfg.uiPort),
        "--ui-mode",
        cfg.uiMode,
        "--python",
        py.pythonBin,
      ],
      cwd: cfg.repoRoot,
      env,
      fingerprint: wantedFp,
      healthUrl: healthUrlFor(cfg),
      port: cfg.uiPort,
      launchMode: cfg.uiMode,
      guestOrigin: guestOrigin(cfg),
    },
  };
}

async function ensureLocal(cfg, warnings, statePath, wantedFp) {
  const planned = await buildSupervisedPlan(cfg, warnings, wantedFp);
  if (!planned.ok) return planned;
  const existing = await readState(statePath);
  if (existing?.pid) stopPid(existing.pid);
  const plan = planned.plan;
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  const ready = await waitForHealth(cfg, 300_000);
  if (!ready) {
    stopPid(child.pid);
    return {
      ok: false,
      error: `Open Dots 启动超时（ui=${cfg.uiPort} api=${cfg.apiPort}）`,
      pid: child.pid ?? null,
    };
  }
  await writeState(statePath, {
    pid: child.pid ?? null,
    fingerprint: wantedFp,
    uiPort: cfg.uiPort,
    apiPort: cfg.apiPort,
    uiMode: cfg.uiMode,
    updatedAt: new Date().toISOString(),
  });
  return {
    ok: true,
    reused: false,
    port: cfg.uiPort,
    apiPort: cfg.apiPort,
    origin: guestOrigin(cfg),
    uiMode: cfg.uiMode,
    computerProvider: cfg.computerProvider,
    pid: child.pid ?? null,
    fingerprint: wantedFp,
  };
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const warnings = [];

  if (cfg.supervised && !cfg.workDir) {
    console.log(
      JSON.stringify({
        ok: false,
        error:
          "supervised ensure 需要 AGNX_APP_DATA_ROOT（或 --work-dir）指向 apps/data/open-dots",
      }),
    );
    process.exitCode = 1;
    return;
  }

  const workDir = cfg.workDir || path.join(homedir(), ".agnx-dev", "apps", "data", APP_ID);
  cfg.workDir = workDir;
  if (!cfg.dataDir) cfg.dataDir = workDir;

  await mkdir(cfg.workDir, { recursive: true });
  await mkdir(cfg.dataDir, { recursive: true });
  const statePath = path.join(cfg.workDir, "open-dots.json");
  const wantedFp = fingerprint(cfg);

  if (cfg.forceRestart) {
    const existing = await readState(statePath);
    if (existing?.pid) stopPid(existing.pid);
  }

  if (cfg.supervised) {
    const reused = await tryReusedResponse(cfg, statePath, wantedFp);
    if (reused) {
      console.log(JSON.stringify({ ...reused, healthUrl: healthUrlFor(cfg), warnings }));
      return;
    }
    const planned = await buildSupervisedPlan(cfg, warnings, wantedFp);
    if (!planned.ok) {
      console.log(JSON.stringify({ ...planned, repoRoot: cfg.repoRoot, warnings }));
      process.exitCode = 1;
      return;
    }
    console.log(
      JSON.stringify({
        ok: true,
        reused: false,
        plan: planned.plan,
        origin: guestOrigin(cfg),
        port: cfg.uiPort,
        apiPort: cfg.apiPort,
        uiMode: cfg.uiMode,
        computerProvider: cfg.computerProvider,
        warnings,
        repoRoot: cfg.repoRoot,
      }),
    );
    return;
  }

  const reused = await tryReusedResponse(cfg, statePath, wantedFp);
  if (reused) {
    console.log(JSON.stringify({ ...reused, warnings }));
    return;
  }
  const result = await ensureLocal(cfg, warnings, statePath, wantedFp);
  console.log(JSON.stringify({ ...result, warnings, repoRoot: cfg.repoRoot }));
  if (!result.ok) process.exitCode = 1;
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
