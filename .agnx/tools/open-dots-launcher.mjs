#!/usr/bin/env node
/**
 * 场景：Open Dots 双进程启动器 — FastAPI(apiPort) + Next(uiPort)；子进程随本进程退出。
 * 用法：node open-dots-launcher.mjs --api-port 8088 --ui-port 3088 [--ui-mode next-dev|next-start]
 */
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { access, constants as fsConstants } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function parseArgs(argv) {
  let apiPort = Number(process.env.OPEN_DOTS_API_PORT) || 8088;
  let uiPort = Number(process.env.OPEN_DOTS_UI_PORT) || 3088;
  let uiMode = process.env.OPEN_DOTS_UI_MODE === "next-start" ? "next-start" : "next-dev";
  let pythonBin = process.env.OPEN_DOTS_PYTHON || "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--api-port" || arg === "--apiPort") && next) {
      apiPort = Number(next) || apiPort;
      i += 1;
    } else if ((arg === "--ui-port" || arg === "--uiPort") && next) {
      uiPort = Number(next) || uiPort;
      i += 1;
    } else if ((arg === "--ui-mode" || arg === "--uiMode") && next) {
      uiMode = next === "next-start" ? "next-start" : "next-dev";
      i += 1;
    } else if ((arg === "--python" || arg === "--python-bin") && next) {
      pythonBin = String(next).trim();
      i += 1;
    }
  }
  return { apiPort, uiPort, uiMode, pythonBin };
}

async function pathExists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
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

async function waitFor(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await httpGetOk(url)) {
      console.error(`[open-dots-launcher] ${label} ready: ${url}`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const cfg = parseArgs(process.argv.slice(2));
const serverDir = path.join(repoRoot, "server");
const clientDir = path.join(repoRoot, "client");
const venvPython = path.join(serverDir, ".venv", "bin", "python");
const pythonBin =
  cfg.pythonBin ||
  (await pathExists(venvPython) ? venvPython : process.env.OPEN_DOTS_PYTHON) ||
  "python3";

if (!(await pathExists(path.join(serverDir, "app", "main.py")))) {
  console.error(`[open-dots-launcher] missing server/app/main.py`);
  process.exit(1);
}
if (!(await pathExists(path.join(clientDir, "package.json")))) {
  console.error(`[open-dots-launcher] missing client/package.json`);
  process.exit(1);
}

const env = {
  ...process.env,
  HOST: "127.0.0.1",
  PORT: String(cfg.apiPort),
  OPEN_DOTS_API_PORT: String(cfg.apiPort),
  OPEN_DOTS_UI_PORT: String(cfg.uiPort),
  OPEN_DOTS_UI_MODE: cfg.uiMode,
  NEXT_PUBLIC_API_URL: "/api/v1",
  CORS_ORIGINS: [
    `http://127.0.0.1:${cfg.uiPort}`,
    `http://localhost:${cfg.uiPort}`,
    process.env.CORS_ORIGINS || "",
  ]
    .filter(Boolean)
    .join(","),
};

const children = [];

function spawnChild(command, args, options, label) {
  const child = spawn(command, args, {
    ...options,
    stdio: "inherit",
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    console.error(`[open-dots-launcher] ${label} exited code=${code} signal=${signal}`);
    for (const c of children) {
      if (c !== child && !c.killed) {
        try {
          c.kill("SIGTERM");
        } catch {
          // ignore
        }
      }
    }
    process.exit(code ?? 1);
  });
  return child;
}

function shutdown() {
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

spawnChild(
  pythonBin,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(cfg.apiPort)],
  { cwd: serverDir, env },
  "fastapi",
);

const apiReady = await waitFor(
  `http://127.0.0.1:${cfg.apiPort}/api/v1/health`,
  120_000,
  "fastapi",
);
if (!apiReady) {
  console.error("[open-dots-launcher] FastAPI health timeout");
  shutdown();
}

const nextBin = path.join(clientDir, "node_modules", "next", "dist", "bin", "next");
const nextCommand = (await pathExists(nextBin)) ? process.execPath : "npx";
const nextArgs =
  cfg.uiMode === "next-start"
    ? (await pathExists(nextBin))
      ? [nextBin, "start", "-H", "127.0.0.1", "-p", String(cfg.uiPort)]
      : ["next", "start", "-H", "127.0.0.1", "-p", String(cfg.uiPort)]
    : (await pathExists(nextBin))
      ? [nextBin, "dev", "-H", "127.0.0.1", "-p", String(cfg.uiPort)]
      : ["next", "dev", "-H", "127.0.0.1", "-p", String(cfg.uiPort)];

spawnChild(nextCommand, nextArgs, { cwd: clientDir, env }, "next");

const uiReady = await waitFor(`http://127.0.0.1:${cfg.uiPort}/`, 180_000, "next");
if (!uiReady) {
  console.error("[open-dots-launcher] Next UI health timeout");
  shutdown();
}

await new Promise(() => {});
