// Entry point to the chrome part of the app: ORDER IS IMPORTANT
import '../../util/user-timings'
import 'react-hot-loader'
import {_setSystemIsDarkMode} from '../../styles/dark-mode'
import {isDarwin} from '../../constants/platform'
_setSystemIsDarkMode(isDarwin && KB.electron.systemPreferences.isDarkMode())
// @ts-ignore react-navigation require process in the global space
window.process = KB.process
require('./main2.desktop')
