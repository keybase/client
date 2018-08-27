// @flow
import logger from '../logger'
import chat2 from './chat2'
import config from './config'
import dev from './dev'
import devices from './devices'
import entities from './entities'
import favorite from './favorite'
import fs from './fs'
import git from './git'
import gregor from './gregor'
import login from './login'
import notifications from './notifications'
import provision from './provision'
import people from './people'
import pinentry from './pinentry'
import profile from './profile'
import push from './push'
import routeTree from './route-tree'
import settings from './settings'
import signup from './signup'
import teams from './teams'
import tracker from './tracker'
import unlockFolders from './unlock-folders'
import users from './users'
import waiting from './waiting'
import wallets from './wallets'
import {combineReducers} from 'redux'
import {reducerTimer} from '../dev/user-timings'

import type {TypedState} from '../constants/reducer'

const reducers = {
  chat2,
  config,
  dev,
  devices,
  entities,
  favorite,
  fs,
  git,
  gregor,
  login,
  notifications,
  people,
  pinentry,
  profile,
  provision,
  push,
  routeTree,
  settings,
  signup,
  teams,
  tracker,
  unlockFolders,
  users,
  waiting,
  wallets,
}

const reducer = reducerTimer ? reducerTimer(reducers) : combineReducers(reducers)

export default function(state: TypedState | void, action: any): TypedState {
  // Warn if any keys did not change after a resetStore action
  if (__DEV__ && action.type === 'common:resetStore' && state) {
    // Don't give a false warning if the state is the same cause it's the initial state
    const initialState = reducer(undefined, action)
    const nextState = reducer(state, action)
    Object.keys(nextState).forEach(
      k =>
        nextState[k] !== initialState[k] &&
        nextState[k] === state[k] &&
        logger.warn('Key %s did not change after resetStore action', k)
    )
    return nextState
  }
  return reducer(state, action)
}
