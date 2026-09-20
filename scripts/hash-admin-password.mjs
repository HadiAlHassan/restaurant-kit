#!/usr/bin/env node
// Prints the ADMIN_PASSWORD_HASH value for the restaurant-kit Worker.
//
//   npx restaurant-kit-hash-password            # prompts (input hidden)
//   echo -n 'pass' | npx restaurant-kit-hash-password
//   npx restaurant-kit-hash-password 'pass'     # lands in shell history; avoid
import { hashPassword, readPassword } from "./lib/password.mjs";

const password = await readPassword(process.argv[2]);
console.log(hashPassword(password));
console.error("\nStore it on the Worker (never in wrangler.toml):\n  wrangler secret put ADMIN_PASSWORD_HASH\n  wrangler secret put ADMIN_SESSION_SECRET   # e.g. openssl rand -base64 32");
