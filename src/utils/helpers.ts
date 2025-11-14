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
export function validateRequiredFields(obj: Record<string, any>, fields: string[]) {
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

// Capitalizes the first letter of a string
export function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Formats a UNIX timestamp (in seconds) to YYYY-MM-DD
export function formatDate(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(parseInt(timestamp, 10) * 1000); // convert seconds to ms
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function extractProjectName(domain: string): string {
  // Remove protocol (http, https, etc.)
  domain = domain.replace(/(^\w+:|^)\/\//, '');

  // Remove 'www.' prefix
  domain = domain.replace(/^www\./, '');

  // Remove any path or query (e.g., /path?param)
  domain = domain.split('/')[0].split('?')[0];

  const parts = domain.split('.');

  let mainPart = '';
  if (parts.length >= 3) {
    // Handle country TLDs like .com.au, .co.uk, etc.
    const tlds = ['com', 'co', 'net', 'org'];
    const secondLast = parts[parts.length - 2];
    const thirdLast = parts[parts.length - 3];

    mainPart = tlds.includes(secondLast) ? thirdLast : secondLast;
  } else if (parts.length === 2) {
    mainPart = parts[0]; // example.com
  } else {
    mainPart = domain;
  }

  const cleanName = mainPart
    .replace(/[-_]/g, ' ') // replace hyphens/underscores with spaces
    .replace(/\d+/g, '') // remove numbers
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()); // capitalize first letters

  return cleanName || '';

}

export function parseDomain(input: string) {
  let domain = input.trim();

  // Detect if user entered a full URL
  const isFullURL = /^https?:\/\//i.test(domain);

  // Extract hostname if it's a URL (this keeps www)
  try {
    if (isFullURL) domain = new URL(domain).hostname;
  } catch { }

  domain = domain.toLowerCase();

  // Universal TLD regex (supports multi-level TLDs)
  const tldMatch = domain.match(/([a-z0-9-]+\.[a-z]{2,}|[a-z]{2,})$/i);
  const tld = tldMatch ? tldMatch[1] : null;

  if (!tld) {
    return {
      parsedDomain: domain,
      type: "invalid"
    };
  }

  const parts = domain.split(".");
  const tldParts = tld.split(".");

  // Determine type based on ORIGINAL input type rules
  const type = isFullURL
    ? "url"
    : parts.length === tldParts.length + 1
      ? "rootdomain"
      : "subdomain";

  return {
    parsedDomain: domain,
    urlType: type
  };
}

