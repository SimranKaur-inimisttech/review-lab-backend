export function generateOtp(length = 6) {
  const min = Math.pow(10, length - 1); // e.g., 100000
  const max = Math.pow(10, length) - 1; // e.g., 999999
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

export function getOtpExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000); // now + X minutes
}
