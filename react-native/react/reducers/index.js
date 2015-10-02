'use strict'

import { combineReducers } from 'redux'
import login from './login'
import search from './search'
import profile from './profile'
import config from './config'
import tabbedRouter from './tabbed-router.js'

export default function (state, action) {
  return combineReducers({
    login,
    tabbedRouter,
    search,
    profile,
    config
  })(state, action)
}
