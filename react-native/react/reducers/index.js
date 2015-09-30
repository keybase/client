'use strict'

import { combineReducers } from 'redux'
import login from './login'
import search from './search'
import profile from './profile'
import tabbedRouter from './tabbed-router.js'

export default function (state, action) {
  return combineReducers({
    login,
    tabbedRouter,
    search,
    profile
  })(state, action)
}
