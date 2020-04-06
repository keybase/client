// Entry point to the chrome part of the app: ORDER IS IMPORTANT
import '../../util/user-timings'
import 'react-hot-loader'
import {_setSystemIsDarkMode, _setSystemSupported} from '../../styles/dark-mode'
import {isDarwin} from '../../constants/platform'
import * as SafeElectron from '../../util/safe-electron.desktop'
import flags from '../../util/feature-flags.desktop'
import React from 'react'
import {enableMapSet} from 'immer'

enableMapSet()

if (__DEV__ && flags.whyDidYouRender) {
  const whyDidYouRender = require('@welldone-software/why-did-you-render/dist/no-classes-transpile/umd/whyDidYouRender.min.js')
  const ReactRedux = require('react-redux')
  whyDidYouRender(React, {
    exclude: [/Box/, /Connect\(.*\)/],
    trackAllPureComponents: true,
    trackExtraHooks: [[ReactRedux, 'useSelector']],
  })
}

_setSystemIsDarkMode(SafeElectron.workingIsDarkMode())
_setSystemSupported(isDarwin)
require('./main2.desktop')
