// Compile backend tests; run DOM tests against their original source and CSS files.
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const output = mkdtempSync(join(process.cwd(), ".planmirror-tests-"));
try {
  execFileSync(process.execPath, [
    "node_modules/typescript/bin/tsc",
    "lib/orchestration/run-audit.test.ts", "lib/orchestration/plan-audit.test.ts",
    "lib/orchestration/audit-request.test.ts", "lib/paypal/client.ts",
    "app/api/ai/extract/route.ts", "lib/audit/compare-subscription-terms.ts", "--outDir", output, "--rootDir", ".",
    "--target", "ES2022", "--module", "commonjs", "--moduleResolution", "node",
    "--rewriteRelativeImportExtensions", "--esModuleInterop", "--strict", "--skipLibCheck",
  ], { stdio: "inherit" });
  const sourceTests = ["frontend.test.mjs", "studio-adapter.test.mjs", "check-bot-mock.test.mjs", "check-bot-ai.test.mjs", "studio-workflow.test.mjs", "studio-workspace.test.mjs", "studio-agent.test.mjs", "studio-harness.test.mjs"];
  const tests = readdirSync("tests").filter(name => name.endsWith(".test.mjs") && !sourceTests.includes(name));
  mkdirSync(join(output, "tests"));
  for (const name of tests) {
    writeFileSync(join(output, "tests", name),
      readFileSync(join("tests", name), "utf8").replaceAll('.ts"', '.js"').replaceAll(".ts'", ".js'"));
  }
  execFileSync(process.execPath, ["--test",
    ...tests.map(name => join(output, "tests", name)),
    join(output, "lib/orchestration/run-audit.test.js"),
    join(output, "lib/orchestration/plan-audit.test.js"),
    join(output, "lib/orchestration/audit-request.test.js"),
  ], { stdio: "inherit" });
  // Frontend tests load TSX components and styles directly from the source tree.
  // Moving them into the compiled backend directory breaks those relative paths.
  execFileSync(process.execPath, ["--import", "tsx", "--test", ...sourceTests.map(name => `tests/${name}`)], { stdio: "inherit" });
} finally {
  rmSync(output, { recursive: true, force: true });
}
