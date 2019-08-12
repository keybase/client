import chat2 from './chat2'
import config from './config'
import deeplinks from './deeplinks'
import devices from './devices'
import entities from './entities'
import fs from './fs'
import git from './git'
import gregor from './gregor'
import login from './login'
import notifications from './notifications'
import people from './people'
import pinentry from './pinentry'
import profile from './profile'
import provision from './provision'
import push from './push'
import settings from './settings'
import signup from './signup'
import teams from './teams'
import tracker2 from './tracker2'
import unlockFolders from './unlock-folders'
import users from './users'
import waiting from './waiting'
import wallets from './wallets'
import {combineReducers} from 'redux'

const reducers = {
  chat2,
  config,
  deeplinks,
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
  settings,
  signup,
  teams,
  tracker2,
  unlockFolders,
  users,
  waiting,
  wallets,
}

const rootReducer = combineReducers(reducers)
export type TypedState = ReturnType<typeof rootReducer>

export default function(state: TypedState | undefined, action: any): TypedState {
  return rootReducer(state, action)
}
