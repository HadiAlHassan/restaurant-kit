#!/usr/bin/env node
// One-shot provisioning for a restaurant-kit site (or one of its wrangler envs).
//
//   npx restaurant-kit-bootstrap --bucket demo-menu-staging --env staging --seed-from demo-menu
//   npx restaurant-kit-bootstrap --bucket demo-menu --restaurant demo
//   npx restaurant-kit-bootstrap --dev-vars            # writes .dev.vars for `wrangler dev`
//
// --password <pw> skips the prompt but stays in shell history and `ps`; prefer the prompt.
//
// Steps (each skippable with --skip-<step>): bucket, seed, secrets, dry-run. Run from the site
// directory (where wrangler.toml lives). Needs `wrangler login` done first.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashPassword, randomSessionSecret, readPassword } from "./lib/password.mjs";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 11).map((line) => line.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}

const envFlag = args.env ? ["--env", args.env] : [];
const restaurantId = args.restaurant ?? readRestaurantIdFromToml(args.env);
const label = args.env ? `env "${args.env}"` : "production";

// Pinned to a major so npx never pulls an arbitrary release; a site-local wrangler 4.x is used as-is.
const wranglerPackage = "wrangler@4";

function wrangler(cmdArgs, options = {}) {
  const result = spawnSync("npx", [wranglerPackage, ...cmdArgs], {
    stdio: options.input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
    input: options.input,
    encoding: "utf8",
  });
  if (result.status !== 0 && !options.allowFailure) {
    console.error(`\nwrangler ${cmdArgs.join(" ")} failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
  return result;
}

function step(title) {
  console.log(`\n== ${title}`);
}

if (args["dev-vars"]) {
  step("Local .dev.vars for `wrangler dev`");
  if (existsSync(".dev.vars") && !args.force) {
    console.log(".dev.vars already exists; pass --force to overwrite.");
  } else {
    const password = await readPassword(args.password);
    writeFileSync(".dev.vars", `ADMIN_PASSWORD_HASH="${hashPassword(password)}"\nADMIN_SESSION_SECRET="${randomSessionSecret()}"\n`, { mode: 0o600 });
    ensureGitignored(".dev.vars");
    console.log("Wrote .dev.vars (gitignored). Start the stack with:\n  npx wrangler dev            # API + built site on :8787\n  npm run dev:worker          # vite on :5173 talking to :8787");
  }
  process.exit(0);
}

if (!args.bucket) {
  console.error("Missing --bucket <name>. See --help.");
  process.exit(1);
}

if (!args["skip-bucket"]) {
  step(`R2 bucket ${args.bucket}`);
  const created = wrangler(["r2", "bucket", "create", args.bucket], { allowFailure: true });
  if (created.status !== 0) console.log("(bucket create failed — it probably already exists; continuing)");
}

if (args["seed-from"] && !args["skip-seed"]) {
  step(`Seed ${args.bucket} from ${args["seed-from"]} (published → published + draft)`);
  const dir = mkdtempSync(join(tmpdir(), "rk-seed-"));
  const file = join(dir, "menu.json");
  wrangler(["r2", "object", "get", `${args["seed-from"]}/restaurants/${restaurantId}/published/menu.json`, "--file", file, "--remote"]);
  for (const target of ["published", "draft"]) {
    wrangler(["r2", "object", "put", `${args.bucket}/restaurants/${restaurantId}/${target}/menu.json`, "--file", file, "--content-type", "application/json", "--remote"]);
  }
  rmSync(dir, { recursive: true, force: true });
} else if (!args["skip-seed"]) {
  console.log(`\n(no --seed-from: the ${label} draft/published menu starts empty; the site shows its bundled seed until you publish)`);
}

if (!args["skip-secrets"]) {
  step(`Admin secrets for ${label}`);
  const password = await readPassword(args.password);
  wrangler(["secret", "put", "ADMIN_PASSWORD_HASH", ...envFlag], { input: hashPassword(password) });
  wrangler(["secret", "put", "ADMIN_SESSION_SECRET", ...envFlag], { input: randomSessionSecret() });
}

if (!args["skip-dry-run"]) {
  step(`Deploy dry run (${label})`);
  // `--env=` targets the top-level (production) config explicitly; wrangler warns when envs exist and none is named.
  wrangler(["deploy", "--dry-run", ...(args.env ? envFlag : ["--env="])], { allowFailure: true });
}

step("Remaining manual steps");
console.log(
  [
    "1. Zone: the domain must be on this Cloudflare account (registrar nameservers → Cloudflare).",
    "2. DNS: a hostname you list as `custom_domain = true` must have NO existing A/AAAA/CNAME record,",
    "   or the deploy fails with 409. Delete the record, or use a zone route (`pattern = \"host/*\"`).",
    "3. Old Pages project on the same hostname? Remove its custom domain first.",
    `4. Deploy: npx wrangler deploy --env${args.env ? ` ${args.env}` : '=""'}`,
    '5. Check: curl -s https://<host>/api/admin/session  →  {"strategy":"password",...}',
  ].join("\n"),
);

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      index += 1;
    } else out[key] = true;
  }
  return out;
}

function readRestaurantIdFromToml(env) {
  if (!existsSync("wrangler.toml")) return "restaurant";
  const toml = readFileSync("wrangler.toml", "utf8");
  const section = env ? toml.split(`[env.${env}.vars]`)[1] : undefined;
  const match = section?.match(/RESTAURANT_ID\s*=\s*"([^"]+)"/) ?? toml.match(/RESTAURANT_ID\s*=\s*"([^"]+)"/);
  return match?.[1] ?? "restaurant";
}

function ensureGitignored(entry) {
  let current = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : "";
  if (current.split(/\r?\n/).some((line) => line.trim() === entry || line.trim() === `/${entry}`)) return;
  if (current && !current.endsWith("\n")) current += "\n";
  writeFileSync(".gitignore", `${current}${entry}\n`);
}
