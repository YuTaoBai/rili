import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
// Expo prebuild may rewrite npm scripts. Keep our managed-project manifest intact.
const before = readFileSync("package.json");
let result;
try {
  result = spawnSync(
    process.execPath,
    [
      "node_modules/expo/bin/cli",
      "prebuild",
      "--platform",
      "android",
      "--no-install",
      "--clean",
    ],
    { stdio: "inherit" },
  );
} finally {
  writeFileSync("package.json", before);
}
if (result.error) throw result.error;
process.exit(result.status ?? 1);
