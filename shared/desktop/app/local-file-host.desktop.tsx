import crypto from 'crypto'

// The host of every local file scheme URL: a random value made once per launch and handed only to
// the app's own pages, so the scheme serves only URLs those pages built. Lowercase hex, as URL hosts
// are case-insensitive, in two labels to stay within the DNS label length.
const hex = crypto.randomBytes(32).toString('hex')
export const localFileHost = `${hex.slice(0, 32)}.${hex.slice(32)}`
