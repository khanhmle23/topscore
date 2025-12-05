/**
 * HEIC to JPEG Converter
 * 
 * Converts iPhone HEIC images to JPEG format for processing
 */

// @ts-ignore - heic-convert doesn't have TypeScript types
import heicConvert from 'heic-convert';

export async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    console.log('[HEIC] Converting HEIC image to JPEG...');
    
    const outputBuffer = await heicConvert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.95, // High quality
    });

    console.log('[HEIC] Conversion successful');
    return Buffer.from(outputBuffer) as Buffer;
  } catch (error) {
    console.error('[HEIC] Conversion failed:', error);
    throw new Error('Failed to convert HEIC image');
  }
}

export function isHeicFile(mimeType: string, filename: string): boolean {
  const heicMimeTypes = ['image/heic', 'image/heif'];
  const heicExtensions = ['.heic', '.heif'];
  
  const hasHeicMime = heicMimeTypes.includes(mimeType.toLowerCase());
  const hasHeicExtension = heicExtensions.some(ext => 
    filename.toLowerCase().endsWith(ext)
  );
  
  return hasHeicMime || hasHeicExtension;
}
