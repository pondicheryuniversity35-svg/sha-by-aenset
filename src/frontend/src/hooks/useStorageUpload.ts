/**
 * Image upload hook that compresses images client-side.
 * Photos are stored in localStorage to avoid ICP message size limits.
 * Only a small key string is sent to the backend.
 *
 * Security: All uploads are validated for type (MIME + magic bytes) and size
 * before any processing occurs (OWASP A03/A04).
 */
import {
  validateImageFile,
  validateImageMagicBytes,
} from "../utils/fileValidation";

export function useImageUpload() {
  const compressImage = async (
    file: File,
    maxSize = 300,
    quality = 0.6,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Compress image and store it in localStorage.
   * Returns a short key string (not the base64) for backend storage.
   * Security: validates MIME type, magic bytes, and enforces 5MB limit before processing.
   */
  const storePhoto = async (file: File): Promise<string> => {
    // OWASP A03/A04: validate before reading full file content
    const mimeCheck = validateImageFile(file);
    if (!mimeCheck.valid) {
      throw new Error(mimeCheck.error ?? "Invalid file");
    }
    const magicCheck = await validateImageMagicBytes(file);
    if (!magicCheck.valid) {
      throw new Error(magicCheck.error ?? "Invalid file content");
    }

    const base64 = await compressImage(file, 200, 0.5);
    const key = `sha_photo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const tryStore = () => {
      localStorage.setItem(key, base64);
    };
    try {
      tryStore();
    } catch (e: unknown) {
      const isQuota =
        e instanceof DOMException &&
        (e.name === "QuotaExceededError" ||
          e.name === "NS_ERROR_DOM_QUOTA_REACHED");
      if (!isQuota) {
        return base64;
      }
      try {
        const photoKeys = Object.keys(localStorage)
          .filter((k) => k.startsWith("sha_photo_"))
          .sort();
        for (const oldKey of photoKeys) {
          localStorage.removeItem(oldKey);
          try {
            tryStore();
            return key;
          } catch {
            // still full, continue evicting
          }
        }
        return base64;
      } catch {
        return base64;
      }
    }
    return key;
  };

  /**
   * Resolve a photo key or legacy base64 to a displayable src string.
   */
  const resolvePhoto = (key: string): string => {
    if (!key) return "";
    if (key.startsWith("data:")) return key;
    if (key.startsWith("sha_photo_")) {
      return localStorage.getItem(key) || "";
    }
    return key;
  };

  /**
   * Remove a stored photo from localStorage.
   */
  const deletePhoto = (key: string): void => {
    if (key?.startsWith("sha_photo_")) {
      localStorage.removeItem(key);
    }
  };

  return { compressImage, storePhoto, resolvePhoto, deletePhoto };
}
