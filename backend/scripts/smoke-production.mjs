/**
 * smoke-production.mjs
 * Starts the production build (npm start), waits for /health to return
 * { success: true, status: "ok" }, then shuts down the child cleanly.
 *
 * Cross-platform: works on Windows CI (cmd.exe) and Linux (npm).
 * Port: auto-selected to avoid conflicts with running services.
 */

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

// ── Find a free TCP port ────────────────────────────────────────────
const findFreePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const port = String(await findFreePort());
const healthUrl = `http://127.0.0.1:${port}/health`;

// ── Spawn the production server ─────────────────────────────────────
const isWin = process.platform === "win32";
const command = isWin ? "cmd.exe" : "npm";
const args = isWin ? ["/d", "/s", "/c", "npm.cmd start"] : ["start"];

// Strip Windows-internal keys that break child_process.spawn on win32
const childEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("=")),
);

const child = spawn(command, args, {
  env: {
    ...childEnv,
    NODE_ENV: "production",
    PORT: port,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";

child.stdout.on("data", (chunk) => {
  output += chunk.toString();
  process.stdout.write(chunk);
});

child.stderr.on("data", (chunk) => {
  output += chunk.toString();
  process.stderr.write(chunk);
});

// ── Cleanup ─────────────────────────────────────────────────────────
const stopServer = async () => {
  if (child.exitCode !== null) return; // Already exited

  if (isWin && child.pid) {
    // taskkill /T /F kills the process tree on Windows
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      timeout: 5000,
    });
    // Give taskkill a moment to complete
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }

  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
};

// ── Health poll ──────────────────────────────────────────────────────
const waitForHealth = async () => {
  const deadline = Date.now() + 90_000; // 90 s timeout for slow CI

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited prematurely (code=${child.exitCode}).\n${output}`);
    }

    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const body = await response.json();
        if (body.success === true && body.status === "ok") return;
      }
    } catch {
      // Server is still starting — keep polling.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Health check timed out after 90 s: ${healthUrl}\n${output}`);
};

// ── Main ─────────────────────────────────────────────────────────────
console.log(`[smoke] Using free port ${port} — spawning production server...`);

let smokeError;

try {
  await waitForHealth();
  console.log(`[smoke] PASS — ${healthUrl} returned { success: true, status: "ok" }`);
} catch (error) {
  smokeError = error;
  console.error("[smoke] FAIL:", error.message);
} finally {
  await stopServer();
}

// Exit after cleanup so the process does not stay alive
if (smokeError) {
  process.exit(1);
}

process.exit(0);
