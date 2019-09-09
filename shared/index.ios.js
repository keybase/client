// @flow
// React-native tooling assumes this file is here, so we just require our real entry point
import './app/globals.native'
import {NativeModules} from 'react-native'
import {_setSystemIsDarkMode} from './styles/dark-mode'

// Load storybook or the app
if (__STORYBOOK__) {
  const load = require('./storybook/index.native').default
  load()
} else {
  const NativeAppearance = NativeModules.Appearance

  if (NativeAppearance) {
    _setSystemIsDarkMode(NativeAppearance.initialColorScheme === 'dark')
  }
  const {load} = require('./app/index.native')
  load()
}
