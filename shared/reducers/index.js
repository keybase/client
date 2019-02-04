// @flow
import chat2 from './chat2'
import config from './config'
import dev from './dev'
import devices from './devices'
import entities from './entities'
import fs from './fs'
import git from './git'
import gregor from './gregor'
import login from './login'
import notifications from './notifications'
import provision from './provision'
import people from './people'
import pinentry from './pinentry'
import profile from './profile'
import tracker2 from './tracker2'
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
import {reducerTimer} from '../util/user-timings'

import type {TypedState} from '../constants/reducer'

const reducers = {
  chat2,
  config,
  dev,
  devices,
  entities,
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
  tracker2,
  unlockFolders,
  users,
  waiting,
  wallets,
}

const reducer = reducerTimer ? reducerTimer(reducers) : combineReducers(reducers)

export default function(state: TypedState | void, action: any): TypedState {
  return reducer(state, action)
}
