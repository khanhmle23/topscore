/**
 * File Validation & Sanitization
 * 
 * Security controls for uploaded files
 */

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_FILE_SIZE = 100; // 100 bytes

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUploadedFile(
  file: File | null
): FileValidationResult {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file size - minimum
  if (file.size < MIN_FILE_SIZE) {
    return { valid: false, error: 'File is too small to be a valid image' };
  }

  // Check file size - maximum
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large (max 10MB)' };
  }

  // Check MIME type
  const mimeType = file.type.toLowerCase();
  const isValidMime = ALLOWED_MIME_TYPES.includes(mimeType);
  
  // Also check file extension as fallback (HEIC files sometimes have wrong MIME)
  const filename = file.name.toLowerCase();
  const hasValidExtension = 
    filename.endsWith('.jpg') ||
    filename.endsWith('.jpeg') ||
    filename.endsWith('.png') ||
    filename.endsWith('.webp') ||
    filename.endsWith('.heic') ||
    filename.endsWith('.heif');

  if (!isValidMime && !hasValidExtension) {
    return { 
      valid: false, 
      error: 'Invalid file type. Supported: JPG, PNG, WebP, HEIC' 
    };
  }

  // Sanitize filename - check for path traversal attempts
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return { valid: false, error: 'Invalid filename' };
  }

  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  // Remove any path components and dangerous characters
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255); // Limit length
}
