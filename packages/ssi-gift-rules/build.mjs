// Builds the package from the rules engine Giftwise itself runs (src/lib/rules), so the two cannot drift.
// Bundles ESM and CommonJS with esbuild, writes the type declarations with tsc, and copies SSA's worked
// examples and Giftwise's published results for them, so the package's own test checks the build gives the same answers.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const entry = join(root, "src/lib/rules/index.ts");
rmSync(join(here, "dist"), { recursive: true, force: true });
for (const format of ["esm", "cjs"]) {
  await build({ entryPoints: [entry], bundle: true, platform: "neutral", format, target: "es2020", outfile: join(here, "dist", format === "esm" ? "index.js" : "index.cjs"), legalComments: "none", logLevel: "warning" });
}
execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", join(here, "tsconfig.json")], { stdio: "inherit" });
mkdirSync(join(here, "examples"), { recursive: true });
copyFileSync(join(root, "content/eval/ssa-examples.json"), join(here, "examples/ssa-examples.json"));
copyFileSync(join(root, "content/eval/ssa-examples-results.json"), join(here, "examples/ssa-examples-results.json"));
copyFileSync(join(root, "LICENSE"), join(here, "LICENSE"));
console.log("built ssi-gift-rules");
