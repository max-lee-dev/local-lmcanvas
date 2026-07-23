import type { Attachment } from "@shared/ipc";
import type { ImageMediaType } from "@shared/types";

export const IMAGE_ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/gif,image/webp";

const ALLOWED_IMAGE_TYPES = new Set(IMAGE_ATTACHMENT_ACCEPT.split(","));

export function imageFilesFromClipboard(items: DataTransferItemList): File[] {
  const files: File[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && ALLOWED_IMAGE_TYPES.has(file.type)) files.push(file);
  }
  return files;
}

export async function filesToImageAttachments(
  files: FileList | File[],
): Promise<Attachment[]> {
  const supported = Array.from(files).filter((file) =>
    ALLOWED_IMAGE_TYPES.has(file.type),
  );
  return Promise.all(supported.map(fileToAttachment));
}

async function fileToAttachment(file: File): Promise<Attachment> {
  const buffer = await file.arrayBuffer();
  return {
    mediaType: file.type as ImageMediaType,
    base64: arrayBufferToBase64(buffer),
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let index = 0; index < bytes.length; index += chunkSize) {
    parts.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
  }
  return btoa(parts.join(""));
}
