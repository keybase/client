/* global module */
// constants/platform calls these at import time under isIOS, which some tests set,
// so the empty stub the other native-only packages get is not enough.
module.exports = {
  GlassView: () => null,
  isGlassEffectAPIAvailable: () => false,
  isLiquidGlassAvailable: () => false,
}
