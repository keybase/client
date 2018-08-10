// @flow
// React-native tooling assumes this file is here, so we just require our real entry point
import 'core-js/es6/object' // required for babel-plugin-transform-builtin-extend in RN Android
import 'core-js/es6/array' // required for emoji-mart in RN Android
import 'core-js/es6/string' // required for emoji-mart in RN Android
import 'core-js/es6/map' // required for FlatList in RN Android

import './app/globals.native'

// Load storybook or the app
if (__STORYBOOK__) {
  // MUST happen first
  const {inject} = require('./stories/mock-react-redux')
  inject()
  const {load} = require('./stories/setup-app.native.js')
  load()
} else {
  const {load} = require('./app/index.native')
  load()
}
