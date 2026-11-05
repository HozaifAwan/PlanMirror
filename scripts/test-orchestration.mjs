// Compile the isolated TypeScript tests with the existing compiler and use Node's test runner.
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const output = mkdtempSync(join(process.cwd(), ".orchestration-tests-"));
try {
  execFileSync(process.execPath, [
    "node_modules/typescript/bin/tsc",
    "lib/orchestration/run-audit.test.ts", "--outDir", output,
    "--target", "ES2022", "--module", "commonjs", "--moduleResolution", "node",
    "--esModuleInterop", "--strict", "--skipLibCheck",
  ], { stdio: "inherit" });
  execFileSync(process.execPath, ["--test", join(output, "orchestration/run-audit.test.js")], { stdio: "inherit" });
} finally {
  rmSync(output, { recursive: true, force: true });
}
