// React-native tooling assumes this file is here, so we just require our real entry point
import 'react-native-gesture-handler' // MUST BE FIRST https://github.com/software-mansion/react-native-gesture-handler/issues/320
import './why-did-you-render'
import './app/globals.native'
import {Appearance} from 'react-native'
import {NativeModules} from './util/native-modules.native'
import {_setSystemIsDarkMode, _setSystemSupported, _setDarkModePreference} from './styles/dark-mode'
import {enableES5, enableMapSet} from 'immer'
enableES5()
enableMapSet()

_setSystemIsDarkMode(Appearance.getColorScheme() === 'dark')

const NativeEngine = NativeModules.KeybaseEngine
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
