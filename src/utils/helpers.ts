import { ApiError } from "./ApiError";
import crypto from 'crypto';

export function generateOtp(length = 6) {
  const min = Math.pow(10, length - 1); // e.g., 100000
  const max = Math.pow(10, length) - 1; // e.g., 999999
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

export function getOtpExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000); // now + X minutes
}

// Validates that all required fields
export function validateRequiredFields(obj, fields) {
  const missing = fields.filter(
    (field) => obj[field] === undefined || obj[field] === null || obj[field] === ''
  );

  if (missing.length > 0) {
    throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`);
  }
}

// Generates a secure random token (64 characters, 256-bit).
export function generateToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char token
}

// Returns a future date string in ISO format based on days ahead.
export function generateExpiryDate(days = 7) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
}