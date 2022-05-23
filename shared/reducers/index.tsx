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
import logger from '../logger'

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

// this is to help TS make this type more static so it emits cleanly
const rootReducer: any = combineReducers(reducers as any)

export type TypedState = {
  autoreset: ReturnType<typeof autoreset>
  chat2: ReturnType<typeof chat2>
  config: ReturnType<typeof config>
  crypto: ReturnType<typeof crypto>
  deeplinks: ReturnType<typeof deeplinks>
  devices: ReturnType<typeof devices>
  fs: ReturnType<typeof fs>
  git: ReturnType<typeof git>
  login: ReturnType<typeof login>
  notifications: ReturnType<typeof notifications>
  people: ReturnType<typeof people>
  pinentry: ReturnType<typeof pinentry>
  profile: ReturnType<typeof profile>
  provision: ReturnType<typeof provision>
  push: ReturnType<typeof push>
  recoverPassword: ReturnType<typeof recoverPassword>
  settings: ReturnType<typeof settings>
  signup: ReturnType<typeof signup>
  teams: ReturnType<typeof teams>
  tracker2: ReturnType<typeof tracker2>
  unlockFolders: ReturnType<typeof unlockFolders>
  users: ReturnType<typeof users>
  waiting: ReturnType<typeof waiting>
  wallets: ReturnType<typeof wallets>
}

export default function (state: TypedState | undefined, action: any): TypedState {
  try {
    return rootReducer(state, action)
  } catch (e) {
    logger.error('Reducer threw!', e)
    throw e
  }
}
