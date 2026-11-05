// Run the Postman collection with Newman against BASE_URL (default: the local production build on port 3100).
import { spawnSync } from "node:child_process";

const base = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
const args = ["-y", "newman@6.2.3", "run", "postman/giftwise.postman_collection.json", "-e", "postman/giftwise.postman_environment.json", "--env-var", `baseUrl=${base}`, "--reporters", "cli", "--color", "off"];
const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
