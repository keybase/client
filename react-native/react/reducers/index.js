'use strict'

import { combineReducers } from 'redux'
import login from './login'
import login2 from './login2'
import devices from './devices'
import search from './search'
import tabbedRouter from './tabbed-router.js'

export default function (state, action) {
  return combineReducers({
    login,
    login2,
    devices,
    tabbedRouter,
    search
  })(state, action)
}
