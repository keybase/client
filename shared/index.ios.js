// React-native tooling assumes this file is here, so we just require our real entry point
/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access */
import './why-did-you-render'
import 'react-native-gesture-handler' // MUST BE FIRST https://github.com/software-mansion/react-native-gesture-handler/issues/320
import './app/globals.native'
import {Appearance} from 'react-native'
import {darkModeSupported, guiConfig} from 'react-native-kb'
import * as DarkMode from './constants/darkmode'
import {enableMapSet} from 'immer'
enableMapSet()

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
