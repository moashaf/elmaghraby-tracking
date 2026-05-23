/**
 * Points the Tauri desktop shell at your live web app URL (or localhost for dev).
 *
 * Reads from .env.local:
 *   NEXT_PUBLIC_APP_URL  — same URL you deploy (recommended)
 *   TAURI_WEB_URL        — override for desktop only
 *
 * Usage:
 *   node scripts/sync-desktop-url.mjs dev   → localhost:3000
 *   node scripts/sync-desktop-url.mjs prod  → production URL from env
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

function loadEnv() {
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i === -1) continue;
      const key = trimmed.slice(0, i).trim();
      const value = trimmed.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

function normalizeUrl(url) {
  return url.replace(/\/$/, "");
}

const mode = process.argv[2] === "dev" ? "dev" : "prod";
loadEnv();

const local = "http://localhost:3000";
let target = local;

if (mode === "prod") {
  target = normalizeUrl(process.env.TAURI_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || "");
  if (!target || target.includes("your-project") || target.includes("example.com")) {
    console.error(
      "Set NEXT_PUBLIC_APP_URL in .env.local to your live site first.\n" +
        "Example: NEXT_PUBLIC_APP_URL=https://elmaghraby-tracing.vercel.app"
    );
    process.exit(1);
  }
}

const configPath = join(process.cwd(), "src-tauri", "tauri.conf.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

config.build.devUrl = mode === "dev" ? local : target;
config.build.frontendDist = mode === "dev" ? local : target;
config.build.beforeDevCommand = "npm run dev";
// Remote URL shell: no need to build Next.js inside the installer
config.build.beforeBuildCommand = mode === "dev" ? "npm run build" : "";

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`[desktop] mode=${mode} url=${config.build.frontendDist}`);
