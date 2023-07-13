import chat2 from './chat2'
import unlockFolders from './unlock-folders'
import wallets from './wallets'

export const reducers = {
  chat2,
  unlockFolders,
  wallets,
}

export type TypedState = {
  chat2: ReturnType<typeof chat2>
  unlockFolders: ReturnType<typeof unlockFolders>
  wallets: ReturnType<typeof wallets>
}
