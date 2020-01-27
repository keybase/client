// Entry point to the chrome part of the app: ORDER IS IMPORTANT
import '../../util/user-timings'
import 'react-hot-loader'
import {_setSystemIsDarkMode} from '../../styles/dark-mode'

_setSystemIsDarkMode(KB.isDarkMode())
require('./main2.desktop')
