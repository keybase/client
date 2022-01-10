// React-native tooling assumes this file is here, so we just require our real entry point
import './why-did-you-render'
import './app/globals.native'
import {Appearance, NativeModules} from 'react-native'
import {_setSystemIsDarkMode, _setSystemSupported, _setDarkModePreference} from './styles/dark-mode'
import {enableES5, enableMapSet} from 'immer'
enableES5()
enableMapSet()

// Load storybook or the app
// if (__STORYBOOK__) {
// const load = require('./storybook/index.native').default
// load()
// } else {

const NativeEngine = NativeModules.KeybaseEngine
_setSystemIsDarkMode(Appearance.getColorScheme() === 'dark')
_setSystemSupported(NativeEngine.darkModeSupported === '1')

try {
  const obj = JSON.parse(NativeEngine.guiConfig)
  if (obj && obj.ui) {
    const dm = obj.ui.darkMode
    switch (dm) {
      case 'system': // fallthrough
      case 'alwaysDark': // fallthrough
      case 'alwaysLight':
        _setDarkModePreference(dm)
        break
    }
  }
} catch (_) {}

const {load} = require('./app/index.native')
load()
// }
