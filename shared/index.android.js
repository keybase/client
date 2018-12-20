// @flow
// React-native tooling assumes this file is here, so we just require our real entry point
import './app/globals.native'
import './util/android-perf-helper.js'
require('./util/performance-polyfill.js')

performance.mark('app-start')

// require.Systrace.setEnabled(true)
// let name = ''
// require.Systrace.beginEvent = message => {
//   name = message
//   performance.mark(name)
// }
//
// require.Systrace.endEvent = () => {
//   performance.measure(name, name)
// }
//
// console.log('is require systrace enabled?', require.Systrace.isEnabled())

// Load storybook or the app
if (__STORYBOOK__) {
  // MUST happen first
  const {inject} = require('./stories/mock-react-redux')
  inject()
  const load = require('./storybook/index.native').default
  load()
} else {
  const {load} = require('./app/index.native')
  // const {load} = require('./app/presetup.native')
  load()
}
