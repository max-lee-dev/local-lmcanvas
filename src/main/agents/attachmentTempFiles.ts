import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nanoid } from "nanoid";
import type { Attachment } from "@shared/ipc";
import type { ImageMediaType } from "@shared/types";

const EXTENSIONS: Record<ImageMediaType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export type AttachmentTempFiles = {
  paths: string[];
  cleanup: () => Promise<void>;
};

export async function writeAttachmentsToTemp(
  attachments: Attachment[]
): Promise<AttachmentTempFiles> {
  if (attachments.length === 0) {
    return { paths: [], cleanup: async () => {} };
  }
  const dir = await mkdtemp(join(tmpdir(), "lmc-attach-"));
  const paths: string[] = [];
  try {
    for (const a of attachments) {
      const ext = EXTENSIONS[a.mediaType] ?? "bin";
      const path = join(dir, `${nanoid(8)}.${ext}`);
      await writeFile(path, Buffer.from(a.base64, "base64"));
      paths.push(path);
    }
  } catch (err) {
    // best-effort cleanup of partials, then rethrow
    await Promise.allSettled(paths.map((p) => unlink(p)));
    throw err;
  }
  const cleanup = async (): Promise<void> => {
    await Promise.allSettled(paths.map((p) => unlink(p)));
  };
  return { paths, cleanup };
}
