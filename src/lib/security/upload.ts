import crypto from "crypto";

export type UploadKind = "image" | "document";

export interface ValidatedUpload {
  mime: string;
  extension: string;
  buffer: Buffer;
}

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const DOC_MAX_BYTES = 10 * 1024 * 1024;

function detectMagicMime(buf: Buffer): { mime: string; extension: string } | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: "image/png", extension: "png" };
  }

  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }

  // AVIF: ....ftypavif or ....ftypavis
  if (
    buf.subarray(4, 8).toString("ascii") === "ftyp" &&
    ["avif", "avis"].includes(buf.subarray(8, 12).toString("ascii"))
  ) {
    return { mime: "image/avif", extension: "avif" };
  }

  // PDF: %PDF-
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { mime: "application/pdf", extension: "pdf" };
  }

  return null;
}

/**
 * Strips EXIF (APP1), XMP/ICC optional metadata, and JPEG comments (COM) from a JPEG buffer.
 */
export function stripJpegMetadata(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;

  const chunks: Buffer[] = [buf.subarray(0, 2)];
  let offset = 2;

  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) break;

    const marker = buf[offset + 1];
    // Start of Scan (0xDA) or EOI (0xD9): copy remainder untouched
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(buf.subarray(offset));
      return Buffer.concat(chunks);
    }

    // Standalone markers without length
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(buf.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    const segmentLen = buf.readUInt16BE(offset + 2);
    const totalLen = 2 + segmentLen;
    if (segmentLen < 2 || offset + totalLen > buf.length) break;

    // Strip APP1 (0xE1 EXIF/XMP), APP13 (0xED IPTC), COM (0xFE)
    const shouldStrip = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!shouldStrip) {
      chunks.push(buf.subarray(offset, offset + totalLen));
    }
    offset += totalLen;
  }

  if (offset < buf.length) {
    chunks.push(buf.subarray(offset));
  }

  return Buffer.concat(chunks);
}

/**
 * Strips EXIF & textual metadata chunks (eXIf, tEXt, zTXt, iTXt) from a PNG buffer.
 */
export function stripPngMetadata(buf: Buffer): Buffer {
  if (buf.length < 8) return buf;
  const sig = buf.subarray(0, 8);
  const chunks: Buffer[] = [sig];
  let offset = 8;

  const stripTypes = new Set(["eXIf", "tEXt", "zTXt", "iTXt"]);

  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const totalLen = 12 + length;
    if (offset + totalLen > buf.length) break;

    if (!stripTypes.has(type)) {
      chunks.push(buf.subarray(offset, offset + totalLen));
    }
    offset += totalLen;
    if (type === "IEND") break;
  }

  return Buffer.concat(chunks);
}

/**
 * Validates file content using real magic bytes, strips image EXIF/metadata, and enforces size bounds.
 */
export function inspectAndSanitizeUpload(
  rawBuffer: Buffer,
  allowPdf = false
): { ok: true; data: ValidatedUpload } | { ok: false; error: string } {
  const detected = detectMagicMime(rawBuffer);
  if (!detected) {
    return {
      ok: false,
      error: "Unsupported or invalid file signature. Only JPG, PNG, WebP, AVIF, or PDF files are permitted.",
    };
  }

  if (detected.mime === "application/pdf" && !allowPdf) {
    return {
      ok: false,
      error: "PDF files are not allowed for image uploads.",
    };
  }

  const maxSize =
    detected.mime === "application/pdf" ? DOC_MAX_BYTES : IMAGE_MAX_BYTES;
  if (rawBuffer.length > maxSize) {
    return {
      ok: false,
      error: `File exceeds the ${maxSize / (1024 * 1024)} MB maximum upload limit.`,
    };
  }

  let cleanBuffer = rawBuffer;
  if (detected.mime === "image/jpeg") {
    cleanBuffer = stripJpegMetadata(rawBuffer);
  } else if (detected.mime === "image/png") {
    cleanBuffer = stripPngMetadata(rawBuffer);
  }

  return {
    ok: true,
    data: {
      mime: detected.mime,
      extension: detected.extension,
      buffer: cleanBuffer,
    },
  };
}

export function buildRandomizedStoragePath(folderPrefix: string, extension: string): string {
  const safePrefix = folderPrefix.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${safePrefix}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

