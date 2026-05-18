/* global module */
// Stub for native-only packages in desktop/test environments.
// These packages are only used inside isMobile branches that are never executed in tests.
module.exports = {
  requireNativeModule: () => ({}),
  requireOptionalNativeModule: () => null,
}
