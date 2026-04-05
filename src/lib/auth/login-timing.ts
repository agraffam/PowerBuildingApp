/**
 * Valid bcrypt hash used only so `bcrypt.compare` runs when the email is unknown,
 * reducing timing differences that could help guess registered addresses.
 * (Password is irrelevant; compare always fails against this hash for real user input.)
 */
export const BCRYPT_TIMING_DUMMY_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
