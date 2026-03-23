/**
 * Forensic photo processing: watermarking + SHA-256 hashing
 * Ensures legal evidence integrity for handover protocol photos.
 */

export interface ForensicMeta {
  sha256: string;
  watermarkText: string;
  capturedAt: string; // ISO
}

/**
 * Render a semi-transparent watermark onto the bottom-right of the image.
 * Returns a new data URL with the watermark baked in.
 */
export async function applyWatermark(
  dataUrl: string,
  protocolId: string,
  gpsLat: number | null,
  gpsLng: number | null,
): Promise<{ watermarkedUrl: string; watermarkText: string }> {
  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const gpsStr = gpsLat !== null && gpsLng !== null
    ? `${gpsLat.toFixed(5)},${gpsLng.toFixed(5)}`
    : 'GPS n/a';
  const watermarkText = `ET-Protokoll ${protocolId} | ${dateStr} | ${timeStr} | ${gpsStr}`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not available')); return; }

      ctx.drawImage(img, 0, 0);

      // Semi-transparent band at bottom
      const bandH = Math.max(28, img.height * 0.035);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, img.height - bandH, img.width, bandH);

      // Text
      const fontSize = Math.max(11, Math.round(img.width * 0.013));
      ctx.font = `${fontSize}px monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      ctx.fillText(watermarkText, img.width - 8, img.height - bandH / 2);

      const watermarkedUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve({ watermarkedUrl, watermarkText });
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

/**
 * Compute SHA-256 hash of raw image data (the data URL string).
 */
export async function computeSha256(dataUrl: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(dataUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Full forensic pipeline: watermark + hash.
 * Returns the watermarked image URL and all forensic metadata.
 */
export async function processForensicPhoto(
  originalDataUrl: string,
  protocolId: string,
  gpsLat: number | null,
  gpsLng: number | null,
): Promise<{ processedUrl: string; forensic: ForensicMeta }> {
  const { watermarkedUrl, watermarkText } = await applyWatermark(
    originalDataUrl, protocolId, gpsLat, gpsLng,
  );
  const sha256 = await computeSha256(watermarkedUrl);
  return {
    processedUrl: watermarkedUrl,
    forensic: {
      sha256,
      watermarkText,
      capturedAt: new Date().toISOString(),
    },
  };
}
