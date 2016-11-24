// @flow
// React-native tooling assumes this file is here, so we just require our real entry point
require('./shared')

module.hot && module.hot.accept(() => {
  console.log('accepted update in entry index.android.js')
})
