/* global module */

// Empty CommonJS module used by the Vite desktop build to null out native-only
// files and packages. Being CJS (not ESM), rolldown tolerates any named import
// from it (resolving to `undefined`) instead of erroring on a missing export —
// the same behavior webpack's null-loader gave. Distinct from null-module.js
// (`module.exports = null`, used by Metro), whose null value rolldown can't
// synthesize named exports from.
module.exports = {}
