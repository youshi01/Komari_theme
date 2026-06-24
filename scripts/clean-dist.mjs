import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

if (!dist.startsWith(root)) {
  throw new Error(`Refusing to remove outside project: ${dist}`);
}

if (process.platform === "win32") {
  const literal = dist.replace(/'/g, "''");
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$ErrorActionPreference = 'Stop'; if (Test-Path -LiteralPath '${literal}') { Remove-Item -LiteralPath '${literal}' -Recurse -Force }`,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to clean dist: ${dist}`);
  }
} else {
  rmSync(dist, { recursive: true, force: true });
}
