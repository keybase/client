'use strict'

import { combineReducers } from 'redux'
import login from './login'
import tabbedRouter from './tabbed-router.js'

export default combineReducers({
  login,
  tabbedRouter
})
