'use strict'
/* @flow */

import { combineReducers } from 'redux'
// $FlowFixMe login2 isnt typed
import login2 from './login2'
import devices from './devices'
import search from './search'
import profile from './profile'
import config from './config'
import tabbedRouter from './tabbed-router'
import {List} from 'immutable'
import type { State } from '../constants/reducer'
import { isDev } from '../constants/platform'
import serialize from './serialize'

import { TIME_TRAVEL, TIME_TRAVEL_BACK } from '../constants/dev'

let history = List()
let index = 0

function timeTravel (state: State, action: any): State {
  if (action.type !== TIME_TRAVEL) {
    history = history.slice(0, index + 1).push(state)
    index = history.size - 1
    return state
  } else {
    const { direction } = action.payload

    if (direction === TIME_TRAVEL_BACK) {
      return history.get(--index, state)
    }
    return history.get(++index, state)
  }
}

const combinedReducer = combineReducers({
  login2,
  devices,
  tabbedRouter,
  search,
  profile,
  config
})

let reducer
if (isDev) {
  reducer = function (state: State, action: any): State {
    return (
      serialize(
        timeTravel(
          combinedReducer(state, action),
          action),
        action)
    )
  }
} else {
  reducer = combinedReducer
}

export default reducer
