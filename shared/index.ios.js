// @flow
// React-native tooling assumes this file is here, so we just require our real entry point
import './globals.native'

// Load storybook or the app
if (__STORYBOOK__) {
  const {load} = require('./stories/setup-app.native.js')
  load()
} else {
  const {load} = require('./index.native')
  load()
}
