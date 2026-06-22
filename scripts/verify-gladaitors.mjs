#!/usr/bin/env node
/**
 * Build-time guard: fail if this tree is not the GLADAITORS Next.js app.
 * Prevents accidental deploy of stablecoin or other projects to gladaitors.vercel.app.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
  console.error(`[verify-gladaitors] ${msg}`);
  process.exit(1);
}

let pkg;
try {
  pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
} catch (e) {
  fail(`Could not read package.json: ${e.message}`);
}

if (pkg.name !== "gladaitors") {
  fail(
    `package.json name is "${pkg.name}", expected "gladaitors". Wrong project tree.`
  );
}

let layout;
try {
  layout = readFileSync(join(root, "app", "layout.tsx"), "utf8");
} catch (e) {
  fail(`Could not read app/layout.tsx: ${e.message}`);
}

if (!layout.includes("GLADAITORS")) {
  fail(
    'app/layout.tsx metadata must include "GLADAITORS". Wrong app or corrupted layout.'
  );
}

console.log("[verify-gladaitors] OK: gladaitors app verified.");