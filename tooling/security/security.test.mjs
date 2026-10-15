// Tests for the secret scanners. Fake secrets are assembled at runtime so that
// no secret-shaped literal is ever committed (keeps gitleaks clean).
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { scanDirectory, scanText } from './bundle-guard.mjs';
import { classifySecretJwt } from './lib.mjs';
import {
  checkEnvExample,
  checkEnvValues,
  checkSourceText,
  runChecks,
} from './public-env-check.mjs';

const ALLOWED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
const EMPTY_ALLOWLIST = { publicEnv: ALLOWED, findings: [] };

/** @param {Record<string, unknown>} payload */
function fakeJwt(payload) {
  const b64 = (/** @type {object} */ obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.${'s'.repeat(43)}`;
}
// Low-entropy filler so gitleaks' generic-api-key rule does not flag the test itself.
const FAKE_FILLER = 'FAKE'.repeat(6);
/** @param {string} [body] defaults to the low-entropy filler */
const fakeSecretKey = (body = FAKE_FILLER) => ['sb', 'secret', body].join('_');
/** Realistic, high-entropy key body generated at runtime (never committed). */
const randomKeyBody = () => randomBytes(24).toString('base64url');

const tempDirs = /** @type {string[]} */ ([]);
function tempDirWith(/** @type {string} */ content) {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-guard-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'chunk.js'), content);
  return dir;
}
after(() => tempDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('bundle-guard', () => {
  it('flags a Supabase secret key', () => {
    const rules = scanText(`const k="${fakeSecretKey()}";`).map((f) => f.rule);
    assert.deepEqual(rules, ['supabase-secret-key']);
  });

  it('flags a realistic high-entropy Supabase secret key', () => {
    const rules = scanText(`k="${fakeSecretKey(randomKeyBody())}"`).map((f) => f.rule);
    assert.deepEqual(rules, ['supabase-secret-key']);
  });

  it('flags a plain service_role reference', () => {
    const rules = scanText('createClient(url, key, { role: "service_role" })').map((f) => f.rule);
    assert.deepEqual(rules, ['service-role-reference']);
  });

  it('flags a service_role JWT but not an anon JWT', () => {
    assert.equal(classifySecretJwt(fakeJwt({ role: 'service_role' })), 'supabase-service-role-jwt');
    assert.equal(classifySecretJwt(fakeJwt({ role: 'anon' })), null);
    const rules = scanText(
      `a="${fakeJwt({ role: 'anon' })}"; b="${fakeJwt({ role: 'service_role' })}"`,
    )
      .map((f) => f.rule)
      .filter((rule) => rule !== 'service-role-reference');
    assert.deepEqual(rules, ['supabase-service-role-jwt']);
  });

  it('flags a TMDB read access token by its api_read scope', () => {
    const token = fakeJwt({ aud: 'x', scopes: ['api_read'], version: 1 });
    assert.deepEqual(
      scanText(token).map((f) => f.rule),
      ['tmdb-read-token'],
    );
  });

  it('never prints a full secret', () => {
    const secret = fakeSecretKey();
    const [finding] = scanText(secret);
    assert.ok(finding?.sample && !finding.sample.includes(secret));
  });

  it('scans a build directory and honours the allowlist', () => {
    const dir = tempDirWith(`x="${fakeSecretKey()}"`);
    assert.equal(scanDirectory(dir, EMPTY_ALLOWLIST).findings.length, 1);

    const allowlist = {
      publicEnv: ALLOWED,
      findings: [{ rule: 'supabase-secret-key', reason: 'test fixture' }],
    };
    assert.equal(scanDirectory(dir, allowlist).findings.length, 0);
  });

  it('finds every secret type inside a build directory', () => {
    const dir = tempDirWith(
      [
        `a="${fakeSecretKey(randomKeyBody())}"`,
        `b="${fakeJwt({ role: 'service_role' })}"`,
        `c="${fakeJwt({ scopes: ['api_read'] })}"`,
      ].join(';'),
    );
    const rules = scanDirectory(dir, EMPTY_ALLOWLIST).findings.map((f) => f.rule);
    assert.deepEqual(rules.sort(), [
      'supabase-secret-key',
      'supabase-service-role-jwt',
      'tmdb-read-token',
    ]);
  });

  it('passes a clean build directory', () => {
    const dir = tempDirWith('console.log("hello")');
    assert.deepEqual(scanDirectory(dir, EMPTY_ALLOWLIST).findings, []);
  });
});

describe('public-env-check', () => {
  it('accepts allowlisted public variables', () => {
    assert.deepEqual(checkSourceText('process.env.NEXT_PUBLIC_SUPABASE_URL', ALLOWED, 'a.ts'), []);
  });

  it('rejects secret-looking and unapproved public variables', () => {
    const rules = checkSourceText(
      'process.env.NEXT_PUBLIC_TMDB_TOKEN; process.env.NEXT_PUBLIC_FEATURE_FLAG',
      ALLOWED,
      'a.ts',
    ).map((f) => f.rule);
    assert.deepEqual(rules.sort(), ['secret-like-public-env', 'unapproved-public-env']);
  });

  it('rejects values inside .env.example', () => {
    const findings = checkEnvExample(
      '# comment\nNEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=abc\n',
      ALLOWED,
      '.env.example',
    );
    assert.deepEqual(
      findings.map((f) => f.rule),
      ['env-example-has-value'],
    );
  });

  it('rejects a secret pasted into an allowlisted public variable', () => {
    const findings = checkEnvValues(
      {
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeSecretKey(),
        NEXT_PUBLIC_SUPABASE_URL: fakeJwt({ role: 'service_role' }),
      },
      ALLOWED,
    );
    assert.equal(findings.length, 2);
    for (const finding of findings) assert.ok(!finding.message.includes(FAKE_FILLER));
  });

  it('rejects a realistic secret key pasted into a public variable', () => {
    const findings = checkEnvValues(
      { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeSecretKey(randomKeyBody()) },
      ALLOWED,
    );
    assert.deepEqual(
      findings.map((f) => f.rule),
      ['secret-in-public-env'],
    );
  });

  it('also checks Edge Function example env files', () => {
    const root = mkdtempSync(join(tmpdir(), 'public-env-'));
    tempDirs.push(root);
    mkdirSync(join(root, 'supabase', 'functions'), { recursive: true });
    writeFileSync(
      join(root, 'supabase', 'functions', '.env.example'),
      'TMDB_API_READ_ACCESS_TOKEN=leaked\n',
    );
    assert.deepEqual(
      runChecks(root, {}).map((f) => f.rule),
      ['env-example-has-value'],
    );
  });

  it('passes on the current repository', () => {
    assert.deepEqual(runChecks(undefined, {}), []);
  });
});
