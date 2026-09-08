import { existsSync } from "fs";
import { dirname, join } from "path";
import { execPath } from "process";

export interface ResolvedNpmCommand {
  command: string;
  /** Arguments that must be prepended to every invocation (e.g. the npm-cli.js path). */
  prefix: string[];
}

/**
 * Resolve an npm command for use with `execFile`.
 *
 * On Windows bare `npm` is actually `npm.cmd`, which Node.js (since 20.12 due
 * to CVE-2024-27980) refuses to spawn from `execFile`/`spawn` without
 * `shell: true`. Same trick as `lib/npx.ts`: find the real `npm-cli.js` and
 * invoke it directly via the current `node` binary, which works identically on
 * every platform and needs no shell.
 *
 * Custom commands (e.g. a user-configured absolute path or an alternative
 * package manager) are passed through untouched.
 */
export function resolveNpmCommand(command = "npm"): ResolvedNpmCommand {
  if (!/^npm(\.(cmd|bat))?$/i.test(command)) {
    return { command, prefix: [] };
  }
  const nodeDir = dirname(execPath);
  const candidates = [
    // Windows MSI installer layout: node.exe and node_modules share a dir
    join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    // Unix layout: .../bin/node + .../lib/node_modules/npm/bin/npm-cli.js
    join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        return { command: execPath, prefix: [candidate] };
      }
    } catch {
      // ignore
    }
  }
  return { command, prefix: [] };
}
