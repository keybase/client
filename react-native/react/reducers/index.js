'use strict'

import { combineReducers } from 'redux'
import login from './login'
import devices from './devices'
import search from './search'
import tabbedRouter from './tabbed-router.js'

export default function (state, action) {
  return combineReducers({
    login,
    devices,
    tabbedRouter,
    search
  })(state, action)
}
