// Cross-platform process helpers for tooling scripts.
// Windows needs a shell to run pnpm/deno .cmd shims; Node (DEP0190) forbids
// passing an argument array together with `shell: true`, so on Windows the
// command is joined into one quoted string. Elsewhere no shell is used at all.
import { spawn, spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';

/**
 * Quotes an argument for cmd.exe unless it is made of safe characters only.
 * @param {string} arg
 */
export function quoteArg(arg) {
  return /^[\w@./:=,+-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`;
}

/** @param {string} command @param {string[]} args */
const commandLine = (command, args) => [command, ...args].map(quoteArg).join(' ');

/** @param {string} command @param {string[]} args @param {import('node:child_process').SpawnSyncOptions} [options] */
export function runSync(command, args, options = {}) {
  return isWindows
    ? spawnSync(commandLine(command, args), { ...options, shell: true })
    : spawnSync(command, args, options);
}

/** @param {string} command @param {string[]} args @param {import('node:child_process').SpawnOptions} [options] */
export function run(command, args, options = {}) {
  return isWindows
    ? spawn(commandLine(command, args), { ...options, shell: true })
    : spawn(command, args, options);
}
