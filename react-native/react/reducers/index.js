'use strict'

import { combineReducers } from 'redux'
import login from './login'
import devices from './devices'
import tabbedRouter from './tabbed-router.js'

export default combineReducers({
  login,
  devices,
  tabbedRouter
})
