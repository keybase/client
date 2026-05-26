// Entry point to the chrome part of the app: ORDER IS IMPORTANT
import './globals.desktop'
import {isDarwin, isWindows} from '@/constants/platform'
import KB2, {waitOnKB2Loaded} from '@/util/electron'
import * as DarkMode from '@/stores/darkmode'

waitOnKB2Loaded(() => {
  const {setSystemSupported, setSystemDarkMode} = DarkMode.useDarkModeState.getState().dispatch
  setSystemDarkMode(KB2.constants.startDarkMode)
  setSystemSupported(isDarwin || isWindows)
  import('./main2.desktop').then(() => {}).catch(() => {})
})
