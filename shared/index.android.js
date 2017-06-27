// @flow
// React-native tooling assumes this file is here, so we just require our real entry point
import 'core-js/es6/object' // required for babel-plugin-transform-builtin-extend in RN Android
import 'core-js/es6/array' // required for emoji-mart in RN Android
import 'core-js/es6/string' // required for emoji-mart in RN Android
import 'core-js/es6/map' // required for FlatList in RN Android

import './globals.native'

if (__STORYBOOK__) {
  require('./stories/load.native.js')
} else {
  const {load} = require('./index.native')
  load()
}
