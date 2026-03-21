#!/usr/bin/env node
/**
 * Vercel build entry: production env gate on Vercel Production deploys only.
 * Preview deployments often use non-production env; full production validation would fail there.
 * Local `npm run build:vercel` always runs the production gate (same as shipping checks).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const validateScript = path.join(appRoot, "scripts", "validate-env.mjs");

const onVercel = process.env.VERCEL === "1";
const vercelEnv = process.env.VERCEL_ENV;

const shouldValidateProduction =
  !onVercel || vercelEnv === "production";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    cwd: appRoot,
    shell: false,
    ...opts,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
  if (r.signal) {
    process.exit(1);
  }
}

if (shouldValidateProduction) {
  run(process.execPath, [validateScript, "--profile=production"]);
}

const npmShell = process.platform === "win32";
run("npm", ["run", "build"], { shell: npmShell });
