import type { Readable } from "node:stream";

export type JsonlHandler = (obj: unknown) => void;

export function consumeJsonl(stream: Readable, onObject: JsonlHandler): Promise<void> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      buffer += chunk;
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line.length > 0) {
          try {
            onObject(JSON.parse(line));
          } catch {
            // skip malformed line — CLIs occasionally print non-json banner text
          }
        }
        nl = buffer.indexOf("\n");
      }
    });
    stream.on("end", () => {
      const tail = buffer.trim();
      if (tail.length > 0) {
        try {
          onObject(JSON.parse(tail));
        } catch {
          /* drop */
        }
      }
      resolve();
    });
    stream.on("error", reject);
  });
}
