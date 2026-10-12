// Entry point to the chrome part of the app: ORDER IS IMPORTANT
import './globals.desktop'
import {isDarwin, isWindows} from '@/constants/platform'
import KB2 from '@/util/electron'
import * as DarkMode from '@/stores/darkmode'

const {setSystemSupported, setSystemDarkMode} = DarkMode.useDarkModeState.getState().dispatch
setSystemDarkMode(KB2.constants.startDarkMode)
setSystemSupported(isDarwin || isWindows)
import('./main2.desktop')
  .then(() => {})
  .catch((e: unknown) => {
    console.error('main2.desktop load failed', e)
  })
