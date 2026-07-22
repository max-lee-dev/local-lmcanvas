#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ref = process.env.CODEX_PROTOCOL_REF ?? "main";
const sourceDir = process.env.CODEX_SOURCE_DIR;
const base = "codex-rs/app-server-protocol/schema/typescript";

async function upstreamFile(name) {
  if (sourceDir) {
    return readFile(resolve(sourceDir, base, name), "utf8");
  }
  const url = `https://raw.githubusercontent.com/openai/codex/${ref}/${base}/${name}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Unable to read ${url}: HTTP ${response.status}`);
  return response.text();
}

function methods(source) {
  return new Set([...source.matchAll(/"method":\s*"([^"]+)"/g)].map((match) => match[1]));
}

const local = await readFile(new URL("../src/main/agents/codexProtocol.ts", import.meta.url), "utf8");
const [serverSource, clientSource] = await Promise.all([
  upstreamFile("ServerRequest.ts"),
  upstreamFile("ClientRequest.ts"),
]);
const upstreamServerMethods = methods(serverSource);
const upstreamClientMethods = methods(clientSource);
const requiredClientMethods = [
  "initialize",
  "model/list",
  "thread/start",
  "thread/resume",
  "thread/fork",
  "thread/unsubscribe",
  "turn/start",
  "turn/interrupt",
];
const newServerMethods = [...upstreamServerMethods].filter(
  (method) => !local.includes(`"${method}"`),
);
const removedClientMethods = requiredClientMethods.filter((method) => !upstreamClientMethods.has(method));

if (newServerMethods.length || removedClientMethods.length) {
  if (newServerMethods.length) {
    console.error(`New Codex server requests need review: ${newServerMethods.join(", ")}`);
  }
  if (removedClientMethods.length) {
    console.error(`LMCanvas client methods disappeared upstream: ${removedClientMethods.join(", ")}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Codex protocol check passed (${sourceDir ? sourceDir : `openai/codex@${ref}`}).`);
  console.log(`Reviewed ${upstreamServerMethods.size} server requests and ${requiredClientMethods.length} client methods.`);
}
