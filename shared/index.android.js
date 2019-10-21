// @flow
// React-native tooling assumes this file is here, so we just require our real entry point
import './app/globals.native'
import {NativeModules} from 'react-native'
import {_setSystemIsDarkMode, _setSystemSupported, _setDarkModePreference} from './styles/dark-mode'

require.Systrace.beginEvent = message => {
  if (message.startsWith('RCTDeviceEventEmitter.emit(["RPC"')) {
    global.nativeTest.traceBeginSection(
      'RCTDeviceEventEmitter: RPC(' + (message.length - 37) + ' bytes): ' + message.substring(35, 35 + 30)
    )
  } else {
    global.nativeTest.traceBeginSection(message, 0)
  }
}

require.Systrace.endEvent = () => {
  global.nativeTest.traceEndSection()
}

// Load storybook or the app
if (__STORYBOOK__) {
  const load = require('./storybook/index.native').default
  load()
} else {
  const NativeAppearance = NativeModules.Appearance

  if (NativeAppearance) {
    _setSystemIsDarkMode(NativeAppearance.initialColorScheme === 'dark')
    _setSystemSupported(NativeAppearance.supported === '1')
  }

  const NativeEngine = NativeModules.KeybaseEngine
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
}
