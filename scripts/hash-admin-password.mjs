#!/usr/bin/env node
// Generates the ADMIN_PASSWORD_HASH value for the restaurant-kit Worker.
// Same format the Worker verifies: pbkdf2-sha256$<iterations>$<salt>$<hash>.
//
//   npx restaurant-kit-hash-password            # prompts (input hidden)
//   echo -n 'pass' | npx restaurant-kit-hash-password
//   npx restaurant-kit-hash-password 'pass'     # lands in shell history; avoid
import { pbkdf2Sync, randomBytes } from "node:crypto";

// Workers Free plan caps PBKDF2 at 100k iterations.
const iterations = Number(process.env.PBKDF2_ITERATIONS ?? 100_000);

const CTRL_C = "\u0003";
const BACKSPACE = "\u007f";

function readHidden(prompt) {
  return new Promise((resolve) => {
    const { stdin, stderr } = process;
    let value = "";
    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === CTRL_C) process.exit(130);
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stderr.write("\n");
          resolve(value);
          return;
        }
        if (char === BACKSPACE || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, "");
}

async function readPassword() {
  if (process.argv[2]) return process.argv[2];
  if (!process.stdin.isTTY) return readStdin();
  const first = await readHidden("Admin password: ");
  const second = await readHidden("Repeat password: ");
  if (first !== second) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
  return first;
}

const password = await readPassword();
if (!password) {
  console.error("Password must not be empty.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const encoded = ["pbkdf2-sha256", String(iterations), salt.toString("base64url"), hash.toString("base64url")].join("$");

console.log(encoded);
console.error("\nStore it on the Worker (never in wrangler.toml):\n  wrangler secret put ADMIN_PASSWORD_HASH\n  wrangler secret put ADMIN_SESSION_SECRET   # e.g. openssl rand -base64 32");
