/**
 * Act as a senior security engineer following OWASP Top 10 best practices.
 * Assume ALL user input is malicious.
 * OWASP A03: Injection — validate/sanitize before processing.
 * OWASP A04: Insecure Design — enforce size limits and type whitelists.
 */

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file size and MIME type against a strict whitelist.
 * MIME type is browser-reported and can be spoofed — pair with validateImageMagicBytes.
 */
export function validateImageFile(file: File): FileValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "File too large. Maximum size is 5MB." };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    return {
      valid: false,
      error:
        "Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.",
    };
  }
  return { valid: true };
}

/**
 * Validates magic bytes (file signature) to prevent MIME type spoofing.
 * Reads only the first 12 bytes — never touches the full file content.
 */
export async function validateImageMagicBytes(
  file: File,
): Promise<FileValidationResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer || buffer.byteLength < 4) {
        resolve({ valid: false, error: "File is too small or corrupted." });
        return;
      }
      const bytes = new Uint8Array(buffer.slice(0, 12));

      // JPEG: FF D8 FF
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        resolve({ valid: true });
        return;
      }
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      ) {
        resolve({ valid: true });
        return;
      }
      // GIF: 47 49 46 38
      if (
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38
      ) {
        resolve({ valid: true });
        return;
      }
      // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
      if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      ) {
        resolve({ valid: true });
        return;
      }

      resolve({
        valid: false,
        error: "File content does not match an allowed image format.",
      });
    };
    reader.onerror = () =>
      resolve({ valid: false, error: "Could not read file." });
    // Read ONLY the first 12 bytes — minimal exposure
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
}

/**
 * Sanitizes a filename: strips path traversal, null bytes, special chars.
 * Returns a safe filename suitable for logging/display (never trust for server paths).
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal sequences
  let safe = filename.replace(/\.\.[/\\]/g, "");
  // Remove null bytes
  safe = safe.replace(/\0/g, "");
  // Remove non-alphanumeric except dot, dash, underscore
  safe = safe.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  // Collapse multiple dots (prevent double extensions like file.php.jpg)
  safe = safe.replace(/\.{2,}/g, ".");
  // Normalize extension to lowercase
  const parts = safe.split(".");
  if (parts.length > 1) {
    parts[parts.length - 1] = parts[parts.length - 1].toLowerCase();
  }
  // Limit total length
  safe = parts.join(".").substring(0, 255);
  return safe || "image.jpg";
}

/**
 * Sanitizes user-provided text for display by escaping HTML entities.
 * Use before rendering any user string in contexts where XSS could occur.
 * (In React JSX, interpolation is already safe — use this as an extra guard
 * for any scenario where the string is set as innerHTML or used outside JSX.)
 */
export function sanitizeDisplayText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates and trims text input length.
 * Returns trimmed text, or throws an Error if it exceeds maxLength.
 * Use at form-submit time — not per-keystroke.
 */
export function validateTextInput(
  text: string,
  maxLength = 1000,
  fieldName = "Input",
): string {
  const trimmed = text.trim();
  if (trimmed.length > maxLength) {
    throw new Error(
      `${fieldName} is too long. Maximum ${maxLength} characters allowed.`,
    );
  }
  return trimmed;
}
