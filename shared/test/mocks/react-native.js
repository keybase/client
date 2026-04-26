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
