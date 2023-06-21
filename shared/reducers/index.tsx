import chat2 from './chat2'
import deeplinks from './deeplinks'
import fs from './fs'
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
import wallets from './wallets'

export const reducers = {
  chat2,
  deeplinks,
  fs,
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
  wallets,
}

export type TypedState = {
  chat2: ReturnType<typeof chat2>
  deeplinks: ReturnType<typeof deeplinks>
  fs: ReturnType<typeof fs>
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
  wallets: ReturnType<typeof wallets>
}
