// @flow
// React-native tooling assumes this file is here, so we just require our real entry point
import './globals.native'

if (__STORYBOOK__) {
  const load = require('./stories/load.native.js').default
  load()
} else {
  const {load} = require('./index.native')
  load()
}
