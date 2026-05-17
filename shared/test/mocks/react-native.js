/* global exports */
exports.Dimensions = {
  get: () => ({fontScale: 1, height: 900, scale: 1, width: 1440}),
}

exports.Platform = {
  OS: 'ios',
  Version: 'test',
  isPad: false,
  select: spec => spec?.default,
}

exports.StyleSheet = {
  create: styles => styles,
  hairlineWidth: 1,
}

exports.NativeModules = {}
exports.findNodeHandle = () => null

// Minimal Animated stub — needed by @react-navigation/elements which calls
// Animated.createAnimatedComponent at module load time.
exports.Animated = {
  Value: function Value() {},
  createAnimatedComponent: Component => Component,
  event: () => () => {},
  spring: () => ({start: () => {}}),
  timing: () => ({start: () => {}}),
}

// Minimal component stubs needed by @react-navigation/elements at load time.
/* eslint-disable react/display-name */
exports.Pressable = () => null
exports.Text = () => null
exports.TouchableOpacity = () => null
exports.View = () => null
/* eslint-enable react/display-name */
