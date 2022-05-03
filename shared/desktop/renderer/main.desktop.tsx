// Entry point to the chrome part of the app: ORDER IS IMPORTANT
import '../../util/user-timings'
import 'react-hot-loader'
import {_setSystemIsDarkMode, _setSystemSupported} from '../../styles/dark-mode'
import {isDarwin} from '../../constants/platform'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {enableMapSet} from 'immer'
import '../../why-did-you-render'

enableMapSet()
_setSystemIsDarkMode(SafeElectron.workingIsDarkMode())
_setSystemSupported(isDarwin)
setupKB2().then(() => {
  require('./main2.desktop')
})
