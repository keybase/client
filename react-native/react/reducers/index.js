'use strict'

import { combineReducers } from 'redux'
import login from './login'
import router from './router'

export default combineReducers({
  login,
  router
})
