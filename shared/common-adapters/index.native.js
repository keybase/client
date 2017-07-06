// @flow

module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in common-adapters/index.native')
  })

export * from './index.js'
export * from './native-wrappers.native.js'
