// this file is ignored by ts
// @ts-nocheck
module.hot?.accept(() => {
  console.log('accepted update in common-adapters/mobile.native')
})

const NativeWrappers = require('./native-wrappers.native')

module.exports = {
  get NativeAnimated() {
    return NativeWrappers.NativeAnimated
  },
  get NativeEasing() {
    return NativeWrappers.NativeEasing
  },
  get NativeScrollView() {
    return NativeWrappers.NativeScrollView
  },
  get Portal() {
    return require('./portal.native').Portal
  },
  get PortalHost() {
    return require('./portal.native').PortalHost
  },
  get PortalProvider() {
    return require('./portal.native').PortalProvider
  },
  get ReAnimated() {
    return require('./reanimated').default
  },
  get ReAnimatedEasing() {
    return require('./reanimated').EasingNode
  },
}
