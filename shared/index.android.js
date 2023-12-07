// React-native tooling assumes this file is here, so we just require our real entry point
import 'react-native-gesture-handler' // MUST BE FIRST https://github.com/software-mansion/react-native-gesture-handler/issues/320
import 'react-native-reanimated' // MUST BE HERE due to another bug https://github.com/software-mansion/react-native-reanimated/issues/4836
import './util/why-did-you-render'
import './app/globals.native'
import {Appearance} from 'react-native'
import {darkModeSupported, guiConfig, install} from 'react-native-kb'
import * as DarkMode from './constants/darkmode'
import {enableMapSet} from 'immer'

console.log('------------- android starting up ------------')

enableMapSet()
install()

const {setSystemSupported, setSystemDarkMode, setDarkModePreference} = DarkMode._useState.getState().dispatch
setSystemDarkMode(Appearance.getColorScheme() === 'dark')
setSystemSupported(darkModeSupported === '1')
try {
  const obj = JSON.parse(guiConfig)
  const dm = obj?.ui?.darkMode
  switch (dm) {
    case 'system': // fallthrough
    case 'alwaysDark': // fallthrough
    case 'alwaysLight':
      setDarkModePreference(dm, false)
      break
  }
} catch (_) {}

const {load} = require('./app/index.native')
load()
