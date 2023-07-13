import chat2 from './chat2'
import unlockFolders from './unlock-folders'
import wallets from './wallets'
// team building leftovers, TODO remove
// import crypto from './crypto'
// import teams from './teams'

export const reducers = {
  chat2,
  // crypto,
  // teams,
  unlockFolders,
  wallets,
}

export type TypedState = {
  chat2: ReturnType<typeof chat2>
  // crypto: ReturnType<typeof crypto>
  // teams: ReturnType<typeof teams>
  unlockFolders: ReturnType<typeof unlockFolders>
  wallets: ReturnType<typeof wallets>
}
