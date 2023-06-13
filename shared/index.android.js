// React-native tooling assumes this file is here, so we just require our real entry point
import 'react-native-gesture-handler' // MUST BE FIRST https://github.com/software-mansion/react-native-gesture-handler/issues/320
import ViewReactNativeStyleAttributes from 'react-native/Libraries/Components/View/ReactNativeStyleAttributes'
import './why-did-you-render'
import './app/globals.native'
import {Appearance} from 'react-native'
import {darkModeSupported, guiConfig} from 'react-native-kb'
import * as DarkMode from './constants/darkmode'
import {enableES5, enableMapSet} from 'immer'
enableES5()
enableMapSet()

// Add scaleY back to work around its removal in React Native 0.70. needed for list perf issues, see list-area.native
ViewReactNativeStyleAttributes.scaleY = true

const {setSystemSupported, setSystemDarkMode, setDarkModePreference} =
  DarkMode.useDarkModeState.getState().dispatch
setSystemDarkMode(Appearance.getColorScheme() === 'dark')
setSystemSupported(darkModeSupported === '1')
try {
  const obj = JSON.parse(guiConfig)
  const dm = obj?.ui?.darkMode
  switch (dm) {
    case 'system': // fallthrough
    case 'alwaysDark': // fallthrough
    case 'alwaysLight':
      setDarkModePreference(dm)
      break
  }
} catch (_) {}

const {load} = require('./app/index.native')
load()
