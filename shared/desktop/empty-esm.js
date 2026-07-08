// Self-contained ESM empty module, safe to serve directly in the Vite dev server.
// The `export *` (from an empty ESM module) makes es-module-lexer treat the export
// list as opaque, so dev skips its strict named-export check — `import {X}` from a
// nulled native file resolves to undefined at runtime instead of erroring. Used for
// the native-file null fallback in dev; the prod build uses the CJS empty-module.js
// (rolldown tolerates missing named imports there via CJS interop).
export default {}
export * from './empty-esm-star.js'
