import chat2 from './chat2'
import unlockFolders from './unlock-folders'
import users from './users'
import wallets from './wallets'
// team building leftovers, TODO remove
import crypto from './crypto'
import people from './people'
import teams from './teams'

export const reducers = {
  chat2,
  crypto,
  people,
  teams,
  unlockFolders,
  users,
  wallets,
}

export type TypedState = {
  chat2: ReturnType<typeof chat2>
  crypto: ReturnType<typeof crypto>
  people: ReturnType<typeof people>
  teams: ReturnType<typeof teams>
  unlockFolders: ReturnType<typeof unlockFolders>
  users: ReturnType<typeof users>
  wallets: ReturnType<typeof wallets>
}
