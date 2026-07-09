#!/usr/bin/env node
// setup-playwright.mjs — One-time Playwright + Chromium bootstrap for web-desg.
// Idempotent: safe to run every time. Installs to ~/.cache/web-desg-runner/
// so it doesn't pollute the user's global Node modules.

import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const RUNNER_DIR = join(homedir(), '.cache', 'web-desg-runner');
const PACKAGE_JSON = join(RUNNER_DIR, 'package.json');
const NODE_MODULES = join(RUNNER_DIR, 'node_modules');
const PLAYWRIGHT_INSTALLED = existsSync(join(NODE_MODULES, 'playwright'));
const CHROMIUM_MARKER = join(RUNNER_DIR, '.chromium-installed');

function log(msg) {
  console.error(`[setup-playwright] ${msg}`);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')} (exit ${result.status})`);
  }
  return result;
}

try {
  if (!existsSync(RUNNER_DIR)) {
    mkdirSync(RUNNER_DIR, { recursive: true });
  }

  // Ensure package.json exists (needed for local installs)
  if (!existsSync(PACKAGE_JSON)) {
    writeFileSync(PACKAGE_JSON, JSON.stringify({
      name: 'web-desg-runner',
      version: '1.0.0',
      type: 'module',
      private: true,
    }, null, 2));
  }

  // Install playwright if missing
  if (!PLAYWRIGHT_INSTALLED) {
    log('Installing playwright (one-time, ~30s)...');
    // Use a China-friendly mirror if the default fails
    try {
      run('npm', ['install', '--prefix', RUNNER_DIR, 'playwright', '--no-save', '--loglevel=error']);
    } catch (e) {
      log('Default npm install failed, trying npmmirror.com...');
      run('npm', ['install', '--prefix', RUNNER_DIR, 'playwright', '--no-save', '--loglevel=error',
        '--registry=https://registry.npmmirror.com']);
    }
  } else {
    log('playwright already installed.');
  }

  // Install Chromium browser if missing
  // First check if the python playwright already installed it (sharing saves ~200MB)
  const msPlaywrightDir = join(homedir(), '.cache', 'ms-playwright');
  let chromiumFound = existsSync(CHROMIUM_MARKER);
  if (!chromiumFound && existsSync(msPlaywrightDir)) {
    const dirs = readdirSync(msPlaywrightDir).filter(d => d.startsWith('chromium-'));
    if (dirs.length > 0) {
      log(`Reusing existing Chromium at ${join(msPlaywrightDir, dirs[0])}`);
      process.env.PLAYWRIGHT_BROWSERS_PATH = msPlaywrightDir;
      chromiumFound = true;
    }
  }
  if (!chromiumFound) {
    log('Installing Chromium browser for playwright (one-time, ~60s)...');
    try {
      run('npx', ['--prefix', RUNNER_DIR, 'playwright', 'install', 'chromium']);
      // Note: --with-deps requires sudo and is skipped in sandboxed envs.
      // System deps are usually present on dev machines.
    } catch (e) {
      log('Default browser install failed, trying mirror...');
      process.env.PLAYWRIGHT_DOWNLOAD_HOST = 'https://npmmirror.com/mirrors/playwright';
      try {
        run('npx', ['--prefix', RUNNER_DIR, 'playwright', 'install', 'chromium']);
      } catch (e2) {
        log(`All browser install attempts failed: ${e2.message}`);
        log('Suggestion: install via python playwright (pip install playwright && playwright install chromium)');
      }
    }
    if (existsSync(join(homedir(), '.cache', 'ms-playwright'))) {
      const dirs = readdirSync(join(homedir(), '.cache', 'ms-playwright')).filter(d => d.startsWith('chromium-'));
      if (dirs.length > 0) {
        writeFileSync(CHROMIUM_MARKER, new Date().toISOString());
      }
    }
  } else {
    log('Chromium already available.');
  }

  log('Ready. web-desg can now capture screenshots and scrape pages.');
  console.log(JSON.stringify({ ok: true, runnerDir: RUNNER_DIR }));
} catch (err) {
  log(`Setup failed: ${err.message}`);
  log('Falling back to curl-only mode (no screenshots, no JS rendering).');
  console.log(JSON.stringify({ ok: false, error: err.message, fallback: 'curl' }));
  // Exit 0 so callers can proceed in fallback mode; they should check the JSON.
  process.exit(0);
}
