#!/usr/bin/env node
// Audits public (client-embedded) environment variables:
//  1. Every NEXT_PUBLIC_* / EXPO_PUBLIC_* name used in apps/ or .env.example must be allowlisted.
//  2. Secret-looking public names fail even louder.
//  3. .env.example files must not contain values.
//  4. If an allowlisted public variable is set in the current environment (CI/build),
//     its value must not be a secret key (sb_secret_… or a service_role JWT).
// Values are never printed.
//
// Usage: node tooling/security/public-env-check.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { classifySecretJwt, loadAllowlist, REPO_ROOT } from './lib.mjs';

/** @typedef {import('./lib.mjs').Finding} Finding */

const PUBLIC_ENV_REGEX = /\b(?:NEXT_PUBLIC|EXPO_PUBLIC)_[A-Z0-9_]+\b/g;
const PUBLIC_ENV_NAME = /^(?:NEXT_PUBLIC|EXPO_PUBLIC)_[A-Z0-9_]+$/;
const SECRET_LIKE_NAME = /SECRET|SERVICE|PRIVATE|TOKEN|PASSWORD|TMDB|KEY/;
const SOURCE_EXTENSIONS = /\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.expo',
  '.turbo',
  'dist',
  'build',
  'coverage',
]);

/**
 * @param {string} name
 * @param {string[]} allowed
 * @param {string} file
 * @returns {Finding | null}
 */
export function checkPublicName(name, allowed, file) {
  if (allowed.includes(name)) return null;
  if (SECRET_LIKE_NAME.test(name)) {
    return {
      rule: 'secret-like-public-env',
      message: `${name} looks like a secret but is exposed to clients`,
      file,
    };
  }
  return {
    rule: 'unapproved-public-env',
    message: `${name} is not in tooling/security/allowlist.json (publicEnv); SEC approval required`,
    file,
  };
}

/**
 * @param {string} text
 * @param {string[]} allowed
 * @param {string} file
 * @returns {Finding[]}
 */
export function checkSourceText(text, allowed, file) {
  const names = new Set(text.match(PUBLIC_ENV_REGEX) ?? []);
  return [...names].flatMap((name) => checkPublicName(name, allowed, file) ?? []);
}

/**
 * @param {string} text  contents of a .env.example file
 * @param {string[]} allowed
 * @param {string} file
 * @returns {Finding[]}
 */
export function checkEnvExample(text, allowed, file) {
  /** @type {Finding[]} */
  const findings = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    const name = (eq === -1 ? line : line.slice(0, eq)).replace(/^export\s+/, '').trim();
    const value = eq === -1 ? '' : line.slice(eq + 1).trim();
    if (value !== '') {
      findings.push({
        rule: 'env-example-has-value',
        message: `${name} has a value in .env.example; example files must stay empty`,
        file,
      });
    }
    if (PUBLIC_ENV_NAME.test(name)) {
      const finding = checkPublicName(name, allowed, file);
      if (finding) findings.push(finding);
    }
  }
  return findings;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string[]} allowed
 * @returns {Finding[]}
 */
export function checkEnvValues(env, allowed) {
  /** @type {Finding[]} */
  const findings = [];
  for (const name of allowed) {
    const value = env[name];
    if (!value) continue;
    if (value.startsWith('sb_secret_')) {
      findings.push({
        rule: 'secret-in-public-env',
        message: `${name} contains a Supabase SECRET key; use the publishable key instead`,
      });
    } else if (classifySecretJwt(value)) {
      findings.push({
        rule: 'secret-in-public-env',
        message: `${name} contains a secret JWT (${classifySecretJwt(value)})`,
      });
    }
  }
  return findings;
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** @param {string} root @returns {Finding[]} */
export function runChecks(root = REPO_ROOT, env = process.env) {
  const { publicEnv: allowed } = loadAllowlist();
  const files = [...walk(join(root, 'apps')), ...walk(join(root, 'packages'))];
  const rootExample = join(root, '.env.example');
  if (existsSync(rootExample)) files.push(rootExample);

  /** @type {Finding[]} */
  const findings = [];
  for (const file of files) {
    const rel = relative(root, file);
    if (file.endsWith('.env.example')) {
      findings.push(...checkEnvExample(readFileSync(file, 'utf8'), allowed, rel));
    } else if (SOURCE_EXTENSIONS.test(file)) {
      findings.push(...checkSourceText(readFileSync(file, 'utf8'), allowed, rel));
    }
  }
  findings.push(...checkEnvValues(env, allowed));
  return findings;
}

function main() {
  const findings = runChecks();
  for (const finding of findings) {
    console.error(
      `✖ [${finding.rule}] ${finding.message}${finding.file ? `\n    ${finding.file}` : ''}`,
    );
  }
  if (findings.length > 0) {
    console.error(
      `public-env-check: FAILED with ${findings.length} finding(s). See docs/security/secrets-policy.md`,
    );
    process.exit(1);
  }
  console.log('public-env-check: OK');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
