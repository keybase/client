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
import serialize from './serialize'
import tracker from './tracker'
import pinentry from './pinentry'
import favorite from './favorite'
import updateConfirm from './update-confirm'
import updatePaused from './update-paused'
import signup from './signup'
import unlockFolders from './unlock-folders.js'

import {resetStore} from '../constants/common.js'

import devEdit from './dev-edit'

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
  updateConfirm,
  updatePaused,
  signup,
  unlockFolders
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
