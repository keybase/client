/* @flow */

import {combineReducers} from 'redux'
import login from './login'
import devices from './devices'
import search from './search'
import profile from './profile'
import config from './config'
import tabbedRouter from './tabbed-router'
import {List} from 'immutable'
import type {State} from '../constants/reducer'
import {isDev} from '../constants/platform'
import serialize from './serialize'
import tracker from './tracker'
import pinentry from './pinentry'
import favorite from './favorite'
import update from './update'

import * as Constants from '../constants/dev'

let history = List()
let index = 0

function timeTravel (state: State, action: any): State {
  if (action.type !== Constants.timeTravel) {
    history = history.slice(0, index + 1).push(state)
    index = history.size - 1
    return state
  } else {
    const {direction} = action.payload

    if (direction === Constants.timeTravelBack) {
      return history.get(--index, state)
    }
    return history.get(++index, state)
  }
}

const combinedReducer = combineReducers({
  login,
  devices,
  tabbedRouter,
  search,
  profile,
  config,
  tracker,
  pinentry,
  favorite,
  update
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
