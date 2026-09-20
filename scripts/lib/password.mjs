import { pbkdf2Sync, randomBytes } from "node:crypto";

// Workers Free plan caps PBKDF2 at 100k iterations.
export const defaultIterations = Number(process.env.PBKDF2_ITERATIONS ?? 100_000);

const CTRL_C = "\u0003";
const BACKSPACE = "\u007f";

/** Same format the Worker verifies: pbkdf2-sha256$<iterations>$<salt>$<hash>. */
export function hashPassword(password, iterations = defaultIterations) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return ["pbkdf2-sha256", String(iterations), salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export function randomSessionSecret() {
  return randomBytes(32).toString("base64");
}

export function readHidden(prompt) {
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

/** argv value, else piped stdin, else a hidden double prompt on a TTY. Exits on mismatch/empty. */
export async function readPassword(argValue) {
  let password;
  if (argValue) password = argValue;
  else if (!process.stdin.isTTY) password = await readStdin();
  else {
    const first = await readHidden("Admin password: ");
    const second = await readHidden("Repeat password: ");
    if (first !== second) {
      console.error("Passwords do not match.");
      process.exit(1);
    }
    password = first;
  }
  if (!password) {
    console.error("Password must not be empty.");
    process.exit(1);
  }
  return password;
}
