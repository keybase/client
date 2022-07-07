// Entry point to the chrome part of the app: ORDER IS IMPORTANT
import './globals.desktop'
import {_setSystemIsDarkMode, _setSystemSupported} from '../../styles/dark-mode'
import {isDarwin, isWindows} from '../../constants/platform'
import {enableMapSet} from 'immer'
import '../../why-did-you-render'
import KB2, {waitOnKB2Loaded} from '../../util/electron.desktop'

enableMapSet()
waitOnKB2Loaded(() => {
  _setSystemIsDarkMode(KB2.constants.startDarkMode)
  _setSystemSupported(isDarwin || isWindows)
  require('./main2.desktop')
})
