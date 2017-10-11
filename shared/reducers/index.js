// @flow
// import * as Constants from '../constants/dev'
import chat from './chat'
import config from './config'
import dev from './dev'
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
import signup from './signup'
import tracker from './tracker'
import type {State} from '../constants/reducer'
import unlockFolders from './unlock-folders'
import {combineReducers} from 'redux'
import {resetStore} from '../constants/common.js'
import {reducerTimer} from '../dev/user-timings'

const reducers = {
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
  settings,
  signup,
  tracker,
  unlockFolders,
}

const reducer = reducerTimer ? reducerTimer(reducers) : combineReducers(reducers)

export default function(state: State, action: any): State {
  // Warn if any keys did not change after a resetStore action
  if (__DEV__ && action.type === resetStore) {
    // Don't give a false warning if the state is the same cause its the initial state
    const initialState = reducer(undefined, action)
    const nextState = reducer(state, action)
    Object.keys(nextState).forEach(
      k =>
        nextState[k] !== initialState &&
        nextState[k] === state[k] &&
        console.warn('Key %s did not change after resetStore action', k)
    )
    return nextState
  }
  return reducer(state, action)
}
