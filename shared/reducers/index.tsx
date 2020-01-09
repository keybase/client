import autoreset from './autoreset'
import chat2 from './chat2'
import config from './config'
import crypto from './crypto'
import deeplinks from './deeplinks'
import devices from './devices'
import fs from './fs'
import git from './git'
import login from './login'
import notifications from './notifications'
import people from './people'
import pinentry from './pinentry'
import profile from './profile'
import provision from './provision'
import push from './push'
import recoverPassword from './recover-password'
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
  autoreset,
  chat2,
  config,
  crypto,
  deeplinks,
  devices,
  fs,
  git,
  login,
  notifications,
  people,
  pinentry,
  profile,
  provision,
  push,
  recoverPassword,
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
