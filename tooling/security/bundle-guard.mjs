#!/usr/bin/env node
// Scans client build output (web .next/static, mobile `expo export`) for secrets
// that must never ship to a browser or device.
//
// Usage: node tooling/security/bundle-guard.mjs <dir> [<dir> ...]
// Exit codes: 0 clean, 1 findings, 2 usage error / missing build output.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { classifySecretJwt, isAllowlisted, loadAllowlist, redact, REPO_ROOT } from './lib.mjs';

/** @typedef {import('./lib.mjs').Finding} Finding */

const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Pattern rules applied to raw file content. */
export const PATTERN_RULES = [
  {
    rule: 'supabase-secret-key',
    message: 'Supabase secret key (sb_secret_…) found in client bundle',
    regex: /sb_secret_[A-Za-z0-9_-]{16,}/g,
  },
  {
    rule: 'service-role-reference',
    message: '"service_role" referenced in client bundle',
    regex: /\bservice_role\b/g,
  },
  {
    rule: 'tmdb-v3-api-key',
    message: 'TMDB v3 api_key parameter found in client bundle',
    regex: /api_key=[0-9a-f]{32}\b/gi,
  },
  {
    rule: 'private-key',
    message: 'PEM private key found in client bundle',
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
];

const JWT_REGEX = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

const JWT_MESSAGES = {
  'supabase-service-role-jwt': 'JWT with role "service_role" found in client bundle',
  'tmdb-read-token': 'TMDB API read access token (api_read scope) found in client bundle',
};

/**
 * @param {string} text
 * @returns {Finding[]}
 */
export function scanText(text) {
  /** @type {Finding[]} */
  const findings = [];

  for (const { rule, message, regex } of PATTERN_RULES) {
    for (const match of text.matchAll(regex)) {
      findings.push({ rule, message, sample: redact(match[0]) });
    }
  }

  for (const match of text.matchAll(JWT_REGEX)) {
    const rule = classifySecretJwt(match[0]);
    if (rule) {
      findings.push({
        rule,
        message: JWT_MESSAGES[/** @type {keyof typeof JWT_MESSAGES} */ (rule)],
        sample: redact(match[0]),
      });
    }
  }

  return findings;
}

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * @param {string} dir
 * @param {import('./lib.mjs').Allowlist} allowlist
 * @returns {{ findings: Finding[], filesScanned: number }}
 */
export function scanDirectory(dir, allowlist) {
  /** @type {Finding[]} */
  const findings = [];
  const files = listFiles(dir);

  for (const file of files) {
    if (statSync(file).size > MAX_FILE_BYTES) continue;
    // latin1 keeps every byte, so strings inside binary bundles (e.g. Hermes .hbc) are still found.
    const text = readFileSync(file, 'latin1');
    for (const finding of scanText(text)) {
      const located = { ...finding, file: relative(REPO_ROOT, file) };
      if (!isAllowlisted(located, allowlist)) findings.push(located);
    }
  }

  return { findings, filesScanned: files.length };
}

function main() {
  const dirs = process.argv.slice(2);
  if (dirs.length === 0) {
    console.error('Usage: node tooling/security/bundle-guard.mjs <dir> [<dir> ...]');
    process.exit(2);
  }

  const allowlist = loadAllowlist();
  let total = 0;

  for (const dir of dirs) {
    const absolute = resolve(dir);
    if (!existsSync(absolute)) {
      console.error(`bundle-guard: "${dir}" not found — build the app first.`);
      process.exit(2);
    }
    const { findings, filesScanned } = scanDirectory(absolute, allowlist);
    total += findings.length;
    for (const finding of findings) {
      console.error(
        `✖ [${finding.rule}] ${finding.message}\n    ${finding.file}: ${finding.sample}`,
      );
    }
    console.log(
      `bundle-guard: ${dir} — ${filesScanned} files scanned, ${findings.length} finding(s)`,
    );
  }

  if (total > 0) {
    console.error(
      `bundle-guard: FAILED with ${total} finding(s). See docs/security/secrets-policy.md`,
    );
    process.exit(1);
  }
  console.log('bundle-guard: OK');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
