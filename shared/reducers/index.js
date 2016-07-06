/* @flow */

import {combineReducers} from 'redux'
import {List} from 'immutable'
import type {State} from '../constants/reducer'
import * as Constants from '../constants/dev'
import {resetStore} from '../constants/common.js'

import config from './config'
import devices from './devices'
import favorite from './favorite'
import login from './login'
import pinentry from './pinentry'
import notifications from './notifications'
import search from './search'
import serialize from './serialize'
import signup from './signup'
import tabbedRouter from './tabbed-router'
import tracker from './tracker'
import unlockFolders from './unlock-folders'
import devEdit from './dev-edit'
import dev from './dev'

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
  config,
  tracker,
  pinentry,
  favorite,
  signup,
  unlockFolders,
  notifications,
  dev,
})

let reducer
if (__DEV__) {
  reducer = function (state: State, action: any): State {
    return (
      devEdit(
        serialize(
          timeTravel(
            combinedReducer(state, action),
            action),
          action),
        action)
    )
  }
} else {
  reducer = combinedReducer
}

export default function (state: State, action: any): State {
  // Warn if any keys did not change after a resetStore action
  if (__DEV__ && action.type === resetStore) {
    const nextState = reducer(state, action)
    Object.keys(nextState).forEach(k => nextState[k] === state[k] && console.warn('Key %s did not change after resetStore action', k))
    return nextState
  }
  return reducer(state, action)
}
