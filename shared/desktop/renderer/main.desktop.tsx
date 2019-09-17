// Entry point to the chrome part of the app: ORDER IS IMPORTANT
import '../../util/user-timings'
import 'react-hot-loader'
import {_setSystemIsDarkMode, _setSystemSupported} from '../../styles/dark-mode'
import {isDarwin} from '../../constants/platform'
import * as SafeElectron from '../../util/safe-electron.desktop'

_setSystemIsDarkMode(isDarwin && SafeElectron.getSystemPreferences().isDarkMode())
_setSystemSupported(isDarwin)
require('./main2.desktop')
