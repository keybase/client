// @flow
// import * as Constants from '../constants/dev'
import chat from './chat'
import config from './config'
import dev from './dev'
import devEdit from './dev-edit'
import devices from './devices'
import engine from './engine'
import entities from './entities'
import favorite from './favorite'
import gregor from './gregor'
import login from './login'
import notifications from './notifications'
import pgp from './pgp'
import pinentry from './pinentry'
import planBilling from './plan-billing'
import profile from './profile'
import push from './push'
import routeTree from './route-tree'
import settings from './settings'
import search from './search'
import serialize from './serialize'
import signup from './signup'
import tracker from './tracker'
import type {State} from '../constants/reducer'
import unlockFolders from './unlock-folders'
// import {List} from 'immutable'
import {combineReducers} from 'redux'
import {resetStore} from '../constants/common.js'

// Disabling this for now. Causes us to leak all actions in a session
// let history = List()
// let index = 0

// function timeTravel (state: State, action: any): State {
// if (action.type !== Constants.timeTravel) {
// history = history.slice(0, index + 1).push(state)
// index = history.size - 1
// return state
// } else {
// const {direction} = action.payload

// if (direction === Constants.timeTravelBack) {
// return history.get(--index, state)
// }
// return history.get(++index, state)
// }
// }

const combinedReducer = combineReducers({
  chat,
  config,
  dev,
  devices,
  entities,
  engine,
  favorite,
  gregor,
  login,
  notifications,
  pgp,
  pinentry,
  planBilling,
  profile,
  push,
  routeTree,
  search,
  settings,
  signup,
  tracker,
  unlockFolders,
})

let reducer
if (__DEV__) {
  reducer = function(state: State, action: any): State {
    return devEdit(
      serialize(
        // timeTravel(
        combinedReducer(state, action),
        // action),
        action
      ),
      action
    )
  }
} else {
  reducer = combinedReducer
}

export default function(state: State, action: any): State {
  // Warn if any keys did not change after a resetStore action
  if (__DEV__ && action.type === resetStore) {
    const nextState = reducer(state, action)
    Object.keys(nextState).forEach(
      k => nextState[k] === state[k] && console.warn('Key %s did not change after resetStore action', k)
    )
    return nextState
  }
  return reducer(state, action)
}
