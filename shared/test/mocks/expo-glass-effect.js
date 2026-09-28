/* global module */
// constants/platform calls these at import time under isIOS, which some tests set,
// so the generic native-module stub (no exports) isn't enough.
module.exports = {
  GlassView: () => null,
  isGlassEffectAPIAvailable: () => false,
  isLiquidGlassAvailable: () => false,
}
