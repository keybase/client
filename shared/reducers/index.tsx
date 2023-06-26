import chat2 from './chat2'
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
// team building leftovers, TODO remove
import crypto from './crypto'

export const reducers = {
  chat2,
  crypto,
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
  crypto: ReturnType<typeof crypto>
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
