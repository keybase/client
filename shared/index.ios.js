// @flow
// React-native tooling assumes this file is here, so we just require our real entry point
import './app/globals.native'

// Load storybook or the app
if (__STORYBOOK__) {
  const load = require('./storybook/index.native').default
  load()
} else {
  const {load} = require('./app/index.native')
  load()
}
