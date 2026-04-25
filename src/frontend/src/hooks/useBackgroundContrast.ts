import { useEffect, useState } from "react";

function getLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function parseGradientLuminance(gradient: string): number {
  try {
    const hexMatches = gradient.match(/#([0-9a-fA-F]{6})/g) || [];
    const rgbMatches = gradient.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g) || [];

    const luminances: number[] = [];

    for (const hex of hexMatches) {
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      luminances.push(getLuminance(r, g, b));
    }

    for (const rgb of rgbMatches) {
      const parts = rgb.match(/\d+/g)!.map(Number);
      luminances.push(getLuminance(parts[0], parts[1], parts[2]));
    }

    if (luminances.length === 0) return 0.5;
    return luminances.reduce((a, b) => a + b, 0) / luminances.length;
  } catch {
    return 0.5;
  }
}

const IMAGE_LOAD_TIMEOUT_MS = 3000;

async function sampleImageLuminance(imageUrl: string): Promise<number> {
  return new Promise((resolve) => {
    // Safety timeout — if image hasn't loaded in 3 seconds, return safe default
    const timeoutId = setTimeout(() => {
      console.warn("[useBackgroundContrast] image load timeout, using default");
      resolve(0.5);
    }, IMAGE_LOAD_TIMEOUT_MS);

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement("canvas");
        const sampleSize = 50;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(0.5);
          return;
        }
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
        let total = 0;
        const pixels = sampleSize * sampleSize;
        for (let i = 0; i < data.length; i += 4) {
          total += getLuminance(data[i], data[i + 1], data[i + 2]);
        }
        resolve(total / pixels);
      } catch (err) {
        console.warn("[useBackgroundContrast] canvas sampling failed:", err);
        resolve(0.5);
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      resolve(0.5);
    };

    try {
      img.src = imageUrl;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn("[useBackgroundContrast] failed to set image src:", err);
      resolve(0.5);
    }
  });
}

export function useBackgroundContrast(
  imageUrl: string | undefined,
  opacity: number,
): "light" | "dark" {
  const [bgMode, setBgMode] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // Guard: falsy imageUrl → always dark (safe default, never throws)
    if (!imageUrl) {
      setBgMode("dark");
      return;
    }

    let cancelled = false;

    const isGradient =
      imageUrl.startsWith("linear-gradient") ||
      imageUrl.startsWith("radial-gradient");

    if (isGradient) {
      try {
        const imgLuminance = parseGradientLuminance(imageUrl);
        const effectiveLuminance = imgLuminance * (1 - opacity);
        setBgMode(effectiveLuminance > 0.35 ? "light" : "dark");
      } catch {
        setBgMode("dark");
      }
      return;
    }

    sampleImageLuminance(imageUrl)
      .then((imgLuminance) => {
        if (cancelled) return;
        const effectiveLuminance = imgLuminance * (1 - opacity);
        setBgMode(effectiveLuminance > 0.35 ? "light" : "dark");
      })
      .catch(() => {
        if (!cancelled) setBgMode("dark");
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, opacity]);

  return bgMode;
}
