'use strict'

import { combineReducers } from 'redux'
import login from './login'
import login2 from './login2'
import devices from './devices'
import search from './search'
import profile from './profile'
import config from './config'
import tabbedRouter from './tabbed-router.js'
import {List} from 'immutable'

let history = List()
let index = 0

export default function (state, action) {
  if (action.type !== 'timetravel') {
    const nextState = combineReducers({
      login,
      login2,
      devices,
      tabbedRouter,
      search,
      profile,
      config
    })(state, action)

    history = history.slice(0, index + 1).push(nextState)
    index = history.size - 1

    return nextState
  } else {
    const { direction } = action.payload
    if (direction === 'back') {
      return history.get(--index, state)
    } else {
      return history.get(++index, state)
    }
  }
}
