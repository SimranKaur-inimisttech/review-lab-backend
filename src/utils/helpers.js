import { ApiError } from "./ApiError.js";

export function generateOtp(length = 6) {
  const min = Math.pow(10, length - 1); // e.g., 100000
  const max = Math.pow(10, length) - 1; // e.g., 999999
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

export function getOtpExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000); // now + X minutes
}

// Validates that all required fields are present (not null, undefined, or empty string)
export function validateRequiredFields(obj, fields) {
  const missing = fields.filter(
    (field) => obj[field] === undefined || obj[field] === null || obj[field] === ''
  );

  if (missing.length > 0) {
    throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`);
  }
}